import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/auth'
import { detectCircularCondition } from '../services/formService'

const CONDITION_ELIGIBLE_TYPES = ['MULTIPLE_CHOICE', 'MULTIPLE_SELECT', 'SCALE']

const createQuestionSchema = z.object({
  type: z.enum(['SHORT_TEXT', 'LONG_TEXT', 'MULTIPLE_CHOICE', 'MULTIPLE_SELECT', 'SCALE']),
  title: z.string().max(280).optional().default(''),
  description: z.string().max(500).optional().nullable(),
  required: z.boolean().optional().default(false),
  options: z.array(z.string()).optional().default([]),
  scaleMin: z.string().max(50).optional().nullable(),
  scaleMax: z.string().max(50).optional().nullable(),
})

const updateQuestionSchema = z.object({
  title: z.string().max(280).optional(),
  description: z.string().max(500).optional().nullable(),
  required: z.boolean().optional(),
  options: z.array(z.string()).max(10).optional(),
  scaleMin: z.string().max(50).optional().nullable(),
  scaleMax: z.string().max(50).optional().nullable(),
  condition: z.object({
    triggerQuestionId: z.string().uuid(),
    triggerValue: z.string(),
  }).optional().nullable(),
})

const reorderSchema = z.object({
  order: z.array(z.string().uuid()),
})

async function assertFormOwnership(formId: string, userId: string) {
  const form = await prisma.form.findFirst({ where: { id: formId, userId } })
  if (!form) throw { statusCode: 404, message: 'Formulário não encontrado' }
  return form
}

export async function questionRoutes(app: FastifyInstance) {
  // POST /forms/:id/questions
  app.post('/forms/:id/questions', { preHandler: authenticate }, async (request, reply) => {
    const { id: formId } = request.params as { id: string }
    try { await assertFormOwnership(formId, request.userId) }
    catch (err: any) { return reply.status(err.statusCode).send({ error: err.message }) }

    const body = createQuestionSchema.parse(request.body)

    const lastQuestion = await prisma.question.findFirst({
      where: { formId },
      orderBy: { order: 'desc' },
    })
    const order = (lastQuestion?.order ?? 0) + 1

    let { options, scaleMin, scaleMax } = body
    if (body.type === 'MULTIPLE_CHOICE' || body.type === 'MULTIPLE_SELECT') {
      options = options.length > 0 ? options : ['Opção 1', 'Opção 2']
    }
    if (body.type === 'SCALE') {
      scaleMin = scaleMin ?? 'Discordo'
      scaleMax = scaleMax ?? 'Concordo'
    }

    const question = await prisma.question.create({
      data: { formId, order, type: body.type, title: body.title, description: body.description, required: body.required, options, scaleMin, scaleMax },
      include: { condition: true },
    })
    return reply.status(201).send(question)
  })

  // PUT /forms/:id/questions/:qid
  app.put('/forms/:id/questions/:qid', { preHandler: authenticate }, async (request, reply) => {
    const { id: formId, qid } = request.params as { id: string; qid: string }
    try { await assertFormOwnership(formId, request.userId) }
    catch (err: any) { return reply.status(err.statusCode).send({ error: err.message }) }

    const body = updateQuestionSchema.parse(request.body)

    const question = await prisma.question.findFirst({ where: { id: qid, formId } })
    if (!question) return reply.status(404).send({ error: 'Pergunta não encontrada' })

    if (body.condition !== undefined) {
      if (body.condition !== null) {
        const trigger = await prisma.question.findFirst({ where: { id: body.condition.triggerQuestionId, formId } })
        if (!trigger) return reply.status(400).send({ error: 'Pergunta gatilho não encontrada neste formulário' })

        if (!CONDITION_ELIGIBLE_TYPES.includes(trigger.type)) {
          return reply.status(422).send({ error: 'Lógica condicional só é permitida em perguntas de múltipla escolha, múltipla seleção ou escala' })
        }

        const allQuestions = await prisma.question.findMany({
          where: { formId },
          include: { condition: true },
          orderBy: { order: 'asc' },
        })
        const questionsForCheck = allQuestions.map(q => ({
          id: q.id,
          condition: q.condition ? { triggerQuestionId: q.condition.triggerQuestionId } : null,
        }))
        if (detectCircularCondition(qid, body.condition.triggerQuestionId, questionsForCheck)) {
          return reply.status(422).send({ error: 'Referência circular detectada na lógica condicional' })
        }

        await prisma.condition.upsert({
          where: { questionId: qid },
          create: { questionId: qid, triggerQuestionId: body.condition.triggerQuestionId, triggerValue: body.condition.triggerValue },
          update: { triggerQuestionId: body.condition.triggerQuestionId, triggerValue: body.condition.triggerValue },
        })
      } else {
        await prisma.condition.deleteMany({ where: { questionId: qid } })
      }
    }

    const { condition: _c, ...questionData } = body
    const updated = await prisma.question.update({
      where: { id: qid },
      data: questionData,
      include: { condition: true },
    })
    return reply.send(updated)
  })

  // DELETE /forms/:id/questions/:qid
  app.delete('/forms/:id/questions/:qid', { preHandler: authenticate }, async (request, reply) => {
    const { id: formId, qid } = request.params as { id: string; qid: string }
    try { await assertFormOwnership(formId, request.userId) }
    catch (err: any) { return reply.status(err.statusCode).send({ error: err.message }) }

    const question = await prisma.question.findFirst({ where: { id: qid, formId } })
    if (!question) return reply.status(404).send({ error: 'Pergunta não encontrada' })

    // Remover conditions que apontam para esta pergunta como gatilho
    await prisma.condition.deleteMany({ where: { triggerQuestionId: qid } })
    await prisma.question.delete({ where: { id: qid } })

    return reply.status(204).send()
  })

  // PATCH /forms/:id/questions/reorder
  app.patch('/forms/:id/questions/reorder', { preHandler: authenticate }, async (request, reply) => {
    const { id: formId } = request.params as { id: string }
    try { await assertFormOwnership(formId, request.userId) }
    catch (err: any) { return reply.status(err.statusCode).send({ error: err.message }) }

    const { order } = reorderSchema.parse(request.body)

    await prisma.$transaction(
      order.map((questionId, index) =>
        prisma.question.update({ where: { id: questionId }, data: { order: index + 1 } })
      )
    )
    return reply.send({ ok: true })
  })
}
