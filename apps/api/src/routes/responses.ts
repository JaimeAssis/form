import { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/auth'

export async function responseRoutes(app: FastifyInstance) {
  // GET /forms/:id/responses
  app.get('/forms/:id/responses', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const form = await prisma.form.findFirst({
      where: { id, userId: request.userId },
    })
    if (!form) return reply.status(404).send({ error: 'Formulário não encontrado' })

    const responses = await prisma.response.findMany({
      where: { formId: id },
      orderBy: { createdAt: 'desc' },
      select: { id: true, respondentName: true, createdAt: true, status: true },
    })

    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const userForms = await prisma.form.findMany({
      where: { userId: request.userId },
      select: { id: true },
    })
    const formIds = userForms.map((f) => f.id)

    const [monthlyFreeUsed, quarantinedCount, accumulatedPayments] = await Promise.all([
      prisma.response.count({
        where: {
          formId: { in: formIds },
          status: 'UNLOCKED',
          createdAt: { gte: startOfMonth },
        },
      }),
      prisma.response.count({
        where: { formId: { in: formIds }, status: 'QUARANTINED' },
      }),
      prisma.payment.aggregate({
        where: {
          userId: request.userId,
          status: 'PAID',
          type: { in: ['OVERAGE_SINGLE', 'OVERAGE_PACK'] },
          createdAt: { gte: startOfMonth },
        },
        _sum: { amount: true },
      }),
    ])

    return reply.send({
      responses,
      meta: {
        plan: request.userPlan,
        monthlyFreeUsed,
        quarantinedCount,
        accumulatedCostCents: accumulatedPayments._sum.amount ?? 0,
      },
    })
  })

  // GET /forms/:id/responses/:rid
  app.get('/forms/:id/responses/:rid', { preHandler: authenticate }, async (request, reply) => {
    const { id, rid } = request.params as { id: string; rid: string }

    const form = await prisma.form.findFirst({
      where: { id, userId: request.userId },
      include: { questions: { orderBy: { order: 'asc' } } },
    })
    if (!form) return reply.status(404).send({ error: 'Formulário não encontrado' })

    const response = await prisma.response.findFirst({
      where: { id: rid, formId: id },
      include: { answers: true },
    })
    if (!response) return reply.status(404).send({ error: 'Resposta não encontrada' })

    if (response.status === 'QUARANTINED') {
      return reply.status(402).send({
        status: 'quarantined',
        paymentRequired: true,
        amount: 300,
        respondentName: response.respondentName,
        createdAt: response.createdAt,
      })
    }

    const answersWithInfo = response.answers.map((a) => {
      const q = form.questions.find((q) => q.id === a.questionId)
      return {
        questionId: a.questionId,
        questionTitle: q?.title ?? 'Pergunta removida',
        questionType: q?.type ?? 'SHORT_TEXT',
        value: a.value,
      }
    })

    return reply.send({
      id: response.id,
      respondentName: response.respondentName,
      respondentEmail: response.respondentEmail,
      createdAt: response.createdAt,
      status: response.status,
      questions: form.questions.map((q) => ({
        id: q.id,
        title: q.title,
        type: q.type,
        order: q.order,
      })),
      answers: answersWithInfo,
    })
  })
}
