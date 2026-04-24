import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/auth'
import { createOverageIntent, createOveragePack } from '../services/paymentService'

export async function paymentRoutes(app: FastifyInstance) {
  // POST /payments/overage/intent
  app.post('/payments/overage/intent', { preHandler: authenticate }, async (request, reply) => {
    const body = z.object({ responseId: z.string().uuid() }).parse(request.body)

    const response = await prisma.response.findFirst({
      where: {
        id: body.responseId,
        form: { userId: request.userId },
      },
    })
    if (!response) return reply.status(404).send({ error: 'Resposta não encontrada' })
    if (response.status !== 'QUARANTINED') {
      return reply.status(400).send({ error: 'Resposta já desbloqueada' })
    }

    const result = await createOverageIntent(request.userId, body.responseId)
    return reply.send(result)
  })

  // POST /payments/overage/pack
  app.post('/payments/overage/pack', { preHandler: authenticate }, async (request, reply) => {
    const result = await createOveragePack(request.userId)
    return reply.send(result)
  })
}
