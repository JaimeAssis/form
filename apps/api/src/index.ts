import { initSentry, Sentry } from './lib/sentry'
initSentry()
import Fastify from 'fastify'
import cors from '@fastify/cors'
import 'dotenv/config'
import { authRoutes } from './routes/auth'
import { userRoutes } from './routes/users'
import { formRoutes } from './routes/forms'
import { questionRoutes } from './routes/questions'
import { publicRoutes } from './routes/public'
import { responseRoutes } from './routes/responses'
import { paymentRoutes } from './routes/payments'
import { subscriptionRoutes } from './routes/subscriptions'
import { webhookRoutes } from './routes/webhooks'

const server = Fastify({ logger: true })

server.register(cors, {
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
})

server.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }))

server.register(authRoutes)
server.register(userRoutes)
server.register(formRoutes)
server.register(questionRoutes)
server.register(publicRoutes)
server.register(responseRoutes)
server.register(paymentRoutes)
server.register(subscriptionRoutes)
// webhookRoutes last: it overrides the JSON parser in its own scope for raw body access
server.register(webhookRoutes)

server.setErrorHandler((error, request, reply) => {
  Sentry.captureException(error, {
    extra: { userId: (request as any).userId },
  })
  const statusCode = (error as any).statusCode ?? 500
  reply.status(statusCode).send({ error: error.message || 'Erro interno do servidor' })
})

const start = async () => {
  try {
    await server.listen({ port: Number(process.env.PORT) || 3001, host: '0.0.0.0' })
  } catch (err) {
    server.log.error(err)
    process.exit(1)
  }
}

start()
