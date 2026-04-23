import { FastifyInstance } from 'fastify'
import { authenticate } from '../middleware/auth'
import { prisma } from '../lib/prisma'

export async function authRoutes(app: FastifyInstance) {
  app.get('/auth/me', { preHandler: authenticate }, async (request, reply) => {
    const user = await prisma.user.findUnique({ where: { id: request.userId } })
    if (!user) return reply.status(404).send({ error: 'User not found' })
    return reply.send(user)
  })
}
