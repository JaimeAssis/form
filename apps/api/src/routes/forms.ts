import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/auth'
import { generateUniqueSlug, assertFreePlanPublishLimit } from '../services/formService'

const createFormSchema = z.object({
  title: z.string().min(1).max(200).optional().default('Sem título'),
  templateId: z.string().uuid().optional(),
})

const updateFormSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(500).optional().nullable(),
  welcomeTitle: z.string().max(200).optional().nullable(),
  welcomeMessage: z.string().max(1000).optional().nullable(),
  thankYouTitle: z.string().max(200).optional().nullable(),
  thankYouMessage: z.string().max(1000).optional().nullable(),
})

const statusSchema = z.object({
  status: z.enum(['PUBLISHED', 'PAUSED', 'DRAFT']),
})

export async function formRoutes(app: FastifyInstance) {
  // GET /forms
  app.get('/forms', { preHandler: authenticate }, async (request, reply) => {
    const forms = await prisma.form.findMany({
      where: { userId: request.userId },
      include: { _count: { select: { responses: true } } },
      orderBy: { createdAt: 'desc' },
    })
    return reply.send(forms)
  })

  // POST /forms
  app.post('/forms', { preHandler: authenticate }, async (request, reply) => {
    const body = createFormSchema.parse(request.body)
    const slug = await generateUniqueSlug(body.title)

    if (body.templateId) {
      const template = await prisma.template.findUnique({ where: { id: body.templateId } })
      if (!template) return reply.status(404).send({ error: 'Template não encontrado' })

      const form = await prisma.form.create({
        data: { userId: request.userId, title: template.title, slug },
      })

      const questionsRaw = template.questions as Array<{
        order: number
        type: string
        title: string
        description: string | null
        required: boolean
        options: string[]
        scaleMin: string | null
        scaleMax: string | null
        condition: { triggerQuestionIndex: number; triggerValue: string } | null
      }>

      // Criar perguntas sem condition primeiro — precisamos dos IDs reais
      const createdIds: string[] = []
      for (const q of questionsRaw) {
        const created = await prisma.question.create({
          data: {
            formId: form.id,
            order: q.order,
            type: q.type as any,
            title: q.title,
            description: q.description,
            required: q.required,
            options: q.options,
            scaleMin: q.scaleMin,
            scaleMax: q.scaleMax,
          },
        })
        createdIds.push(created.id)
      }

      // Criar conditions usando os IDs reais
      for (let i = 0; i < questionsRaw.length; i++) {
        const q = questionsRaw[i]
        if (q.condition) {
          const triggerQId = createdIds[q.condition.triggerQuestionIndex]
          if (triggerQId) {
            await prisma.condition.create({
              data: {
                questionId: createdIds[i],
                triggerQuestionId: triggerQId,
                triggerValue: q.condition.triggerValue,
              },
            })
          }
        }
      }

      const fullForm = await prisma.form.findUnique({
        where: { id: form.id },
        include: { questions: { include: { condition: true }, orderBy: { order: 'asc' } } },
      })
      return reply.status(201).send(fullForm)
    }

    // Formulário vazio (comportamento original)
    const form = await prisma.form.create({
      data: { userId: request.userId, title: body.title, slug },
      include: { questions: { include: { condition: true }, orderBy: { order: 'asc' } } },
    })
    return reply.status(201).send(form)
  })

  // GET /forms/:id
  app.get('/forms/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const form = await prisma.form.findFirst({
      where: { id, userId: request.userId },
      include: { questions: { include: { condition: true }, orderBy: { order: 'asc' } } },
    })
    if (!form) return reply.status(404).send({ error: 'Formulário não encontrado' })
    return reply.send(form)
  })

  // PUT /forms/:id
  app.put('/forms/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = updateFormSchema.parse(request.body)
    const existing = await prisma.form.findFirst({ where: { id, userId: request.userId } })
    if (!existing) return reply.status(404).send({ error: 'Formulário não encontrado' })

    const updateData: Record<string, unknown> = { ...body }
    if (request.userPlan === 'FREE') {
      delete updateData.brandColor
      delete updateData.logoUrl
    }

    const form = await prisma.form.update({
      where: { id },
      data: updateData,
      include: { questions: { include: { condition: true }, orderBy: { order: 'asc' } } },
    })
    return reply.send(form)
  })

  // DELETE /forms/:id
  app.delete('/forms/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const existing = await prisma.form.findFirst({ where: { id, userId: request.userId } })
    if (!existing) return reply.status(404).send({ error: 'Formulário não encontrado' })
    await prisma.form.delete({ where: { id } })
    return reply.status(204).send()
  })

  // PATCH /forms/:id/status
  app.patch('/forms/:id/status', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { status } = statusSchema.parse(request.body)
    const existing = await prisma.form.findFirst({
      where: { id, userId: request.userId },
      include: { questions: true },
    })
    if (!existing) return reply.status(404).send({ error: 'Formulário não encontrado' })

    if (status === 'PUBLISHED') {
      if (!existing.title || existing.title.trim() === '' || existing.title === 'Sem título') {
        return reply.status(400).send({ error: 'O formulário precisa de um título para ser publicado' })
      }
      if (existing.questions.length === 0) {
        return reply.status(400).send({ error: 'O formulário precisa ter ao menos uma pergunta' })
      }
      if (request.userPlan === 'FREE') {
        try {
          await assertFreePlanPublishLimit(request.userId)
        } catch (err: any) {
          return reply.status(err.statusCode ?? 403).send({ error: err.message })
        }
      }
    }

    const form = await prisma.form.update({ where: { id }, data: { status } })
    return reply.send(form)
  })

  // GET /forms/:id/preview (sem autenticação)
  app.get('/forms/:id/preview', async (request, reply) => {
    const { id } = request.params as { id: string }
    const form = await prisma.form.findUnique({
      where: { id },
      include: { questions: { include: { condition: true }, orderBy: { order: 'asc' } } },
    })
    if (!form) return reply.status(404).send({ error: 'Formulário não encontrado' })
    return reply.send(form)
  })

  // GET /templates — lista templates ativos ordenados
  app.get('/templates', { preHandler: authenticate }, async (_request, reply) => {
    const templates = await prisma.template.findMany({
      where: { active: true },
      orderBy: { order: 'asc' },
      select: { id: true, niche: true, title: true, description: true, order: true },
    })
    return reply.send(templates)
  })
}
