import { FastifyInstance } from 'fastify'
import { stripe } from '../lib/stripe'
import { handlePaymentSucceeded } from '../services/paymentService'
import { handleSubscriptionChange } from '../services/subscriptionService'
import { prisma } from '../lib/prisma'

export async function webhookRoutes(app: FastifyInstance) {
  // Override JSON parser in this scope only — needed to verify Stripe signature on raw body
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (_req, body, done) => done(null, body),
  )

  app.post('/webhooks/stripe', async (request, reply) => {
    const sig = request.headers['stripe-signature']
    if (!sig || typeof sig !== 'string') {
      return reply.status(400).send({ error: 'Missing stripe-signature' })
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
    if (!webhookSecret) {
      app.log.error('STRIPE_WEBHOOK_SECRET not set')
      return reply.status(500).send({ error: 'Webhook secret not configured' })
    }

    let event: ReturnType<typeof stripe.webhooks.constructEvent>
    try {
      event = stripe.webhooks.constructEvent(
        request.body as Buffer,
        sig,
        webhookSecret,
      )
    } catch {
      return reply.status(400).send({ error: 'Invalid signature' })
    }

    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object
      await handlePaymentSucceeded(paymentIntent.id)
    }

    if (
      event.type === 'customer.subscription.created' ||
      event.type === 'customer.subscription.updated' ||
      event.type === 'customer.subscription.deleted'
    ) {
      const subscription = event.data.object as {
        customer: string
        status: string
        items: { data: Array<{ price: { id: string } }> }
      }
      const customerId =
        typeof subscription.customer === 'string'
          ? subscription.customer
          : (subscription.customer as any).id
      const priceId = subscription.items.data[0]?.price?.id ?? ''
      const status = subscription.status
      await handleSubscriptionChange(customerId, priceId, status)
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as {
        customer: string | null
        metadata: { userId?: string }
      }
      if (session.customer && session.metadata?.userId) {
        const customerId =
          typeof session.customer === 'string'
            ? session.customer
            : (session.customer as any).id
        await prisma.user.update({
          where: { id: session.metadata.userId },
          data: { stripeCustomerId: customerId },
        })
      }
    }

    return reply.send({ received: true })
  })
}
