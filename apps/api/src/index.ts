import Fastify from 'fastify'
import cors from '@fastify/cors'
import 'dotenv/config'
import { authRoutes } from './routes/auth'
import { userRoutes } from './routes/users'

const server = Fastify({ logger: true })

server.register(cors, {
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
})

server.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }))

server.register(authRoutes)
server.register(userRoutes)

const start = async () => {
  try {
    await server.listen({ port: Number(process.env.PORT) || 3001, host: '0.0.0.0' })
  } catch (err) {
    server.log.error(err)
    process.exit(1)
  }
}

start()
