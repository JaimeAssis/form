import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../middleware/auth'
import {
  createCheckoutSession,
  createPortalSession,
} from '../services/subscriptionService'
import { prisma } from '../lib/prisma'

const checkoutSchema = z.object({
  priceId: z.string().min(1),
})

export async function subscriptionRoutes(app: FastifyInstance) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  // POST /payments/subscription/checkout
  app.post(
    '/payments/subscription/checkout',
    { preHandler: authenticate },
    async (request, reply) => {
      const { priceId } = checkoutSchema.parse(request.body)
      const result = await createCheckoutSession(request.userId, priceId, appUrl)
      return reply.send(result)
    },
  )

  // POST /payments/subscription/portal
  app.post(
    '/payments/subscription/portal',
    { preHandler: authenticate },
    async (request, reply) => {
      try {
        const result = await createPortalSession(request.userId, appUrl)
        return reply.send(result)
      } catch (err: any) {
        return reply.status(400).send({ error: err.message })
      }
    },
  )

  // GET /payments/subscription
  app.get(
    '/payments/subscription',
    { preHandler: authenticate },
    async (request, reply) => {
      const user = await prisma.user.findUnique({
        where: { id: request.userId },
        select: { plan: true, stripeCustomerId: true },
      })
      return reply.send({ plan: user?.plan ?? 'FREE', hasCustomer: !!user?.stripeCustomerId })
    },
  )
}
