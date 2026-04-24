// apps/api/src/routes/public.ts
import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { Plan } from '@consorte/types'
import { prisma } from '../lib/prisma'
import { saveResponse } from '../services/responseService'

// Rate limiter em memória: máx 10 submissões por IP por hora
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)
  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 3_600_000 })
    return true
  }
  if (entry.count >= 10) return false
  entry.count++
  return true
}

type QuestionWithCondition = {
  id: string
  required: boolean
  condition: { triggerQuestionId: string; triggerValue: string } | null
}

function isConditionMet(
  question: QuestionWithCondition,
  answersMap: Map<string, string>
): boolean {
  if (!question.condition) return true
  const raw = answersMap.get(question.condition.triggerQuestionId)
  if (raw === undefined) return false
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed.includes(question.condition.triggerValue)
  } catch {
    // não é JSON — comparação direta
  }
  return raw === question.condition.triggerValue
}

const submitSchema = z.object({
  respondentName: z.string().max(200).optional(),
  respondentEmail: z.string().email().max(200).optional().or(z.literal('')),
  answers: z.array(
    z.object({
      questionId: z.string().uuid(),
      value: z.string(),
    })
  ),
})

export async function publicRoutes(app: FastifyInstance) {
  // GET /p/:slug — retorna formulário publicado (sem autenticação)
  app.get('/p/:slug', async (request, reply) => {
    const { slug } = request.params as { slug: string }

    const form = await prisma.form.findUnique({
      where: { slug },
      include: {
        questions: {
          include: { condition: true },
          orderBy: { order: 'asc' },
        },
        user: { select: { name: true, avatarUrl: true, slug: true } },
      },
    })

    if (!form) {
      return reply.status(404).send({ error: 'Formulário não encontrado' })
    }

    if (form.status === 'PAUSED') {
      return reply.status(404).send({ error: 'Formulário pausado', paused: true })
    }

    if (form.status !== 'PUBLISHED') {
      return reply.status(404).send({ error: 'Formulário não disponível' })
    }

    return reply.send(form)
  })

  // POST /p/:slug/submit — recebe respostas do respondente
  app.post('/p/:slug/submit', async (request, reply) => {
    const { slug } = request.params as { slug: string }

    const ip = request.ip || 'unknown'
    if (!checkRateLimit(ip)) {
      return reply
        .status(429)
        .send({ error: 'Muitas submissões. Tente novamente em 1 hora.' })
    }

    const form = await prisma.form.findUnique({
      where: { slug },
      include: {
        questions: {
          include: { condition: true },
          orderBy: { order: 'asc' },
        },
        user: { select: { plan: true } },
      },
    })

    if (!form || form.status !== 'PUBLISHED') {
      return reply.status(404).send({ error: 'Formulário não disponível' })
    }

    let body: z.infer<typeof submitSchema>
    try {
      body = submitSchema.parse(request.body)
    } catch (err: any) {
      return reply.status(400).send({ error: 'Dados inválidos', details: err.errors })
    }

    const answersMap = new Map(body.answers.map(a => [a.questionId, a.value]))

    // Validar perguntas obrigatórias visíveis
    for (const question of form.questions) {
      if (!question.required) continue
      if (!isConditionMet(question, answersMap)) continue // oculta — não valida

      const answer = answersMap.get(question.id)
      const isEmpty = !answer || answer.trim() === '' || answer === '[]'
      if (isEmpty) {
        return reply
          .status(400)
          .send({ error: 'Pergunta obrigatória não respondida', questionId: question.id })
      }
    }

    await saveResponse({
      formId: form.id,
      ownerPlan: form.user.plan as Plan,
      respondentName: body.respondentName,
      respondentEmail: body.respondentEmail || undefined,
      answers: body.answers,
    })

    return reply.status(200).send({ ok: true })
  })
}
