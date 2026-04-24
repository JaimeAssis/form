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
// webhookRoutes last: it overrides the JSON parser in its own scope for raw body access
server.register(webhookRoutes)

const start = async () => {
  try {
    await server.listen({ port: Number(process.env.PORT) || 3001, host: '0.0.0.0' })
  } catch (err) {
    server.log.error(err)
    process.exit(1)
  }
}

start()
