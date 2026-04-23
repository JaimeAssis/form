import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../middleware/auth'
import { prisma } from '../lib/prisma'

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

async function uniqueSlug(base: string): Promise<string> {
  let slug = base
  let attempt = 0
  while (await prisma.user.findUnique({ where: { slug } })) {
    attempt++
    slug = `${base}-${attempt}`
  }
  return slug
}

const profileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  niche: z.string().optional(),
  avatarUrl: z.string().url().optional().nullable(),
})

const onboardingSchema = z.object({
  name: z.string().min(1).max(100),
  niche: z.string().min(1),
})

export async function userRoutes(app: FastifyInstance) {
  app.put('/users/profile', { preHandler: authenticate }, async (request, reply) => {
    const body = profileSchema.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() })

    const user = await prisma.user.update({
      where: { id: request.userId },
      data: body.data,
    })
    return reply.send(user)
  })

  app.post('/users/onboarding', { preHandler: authenticate }, async (request, reply) => {
    const body = onboardingSchema.safeParse(request.body)
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() })

    const existingUser = await prisma.user.findUnique({ where: { id: request.userId } })
    if (existingUser?.onboardingDone) {
      return reply.status(400).send({ error: 'Onboarding already completed' })
    }

    const baseSlug = toSlug(body.data.name)
    const slug = await uniqueSlug(baseSlug)

    const user = await prisma.user.update({
      where: { id: request.userId },
      data: {
        name: body.data.name,
        niche: body.data.niche,
        slug,
        onboardingDone: true,
      },
    })
    return reply.send(user)
  })

  app.get('/users/:slug/public', async (request, reply) => {
    const { slug } = request.params as { slug: string }
    const user = await prisma.user.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        niche: true,
        avatarUrl: true,
        forms: {
          where: { status: 'PUBLISHED' },
          select: { id: true, title: true, slug: true, description: true },
        },
      },
    })
    if (!user) return reply.status(404).send({ error: 'Profile not found' })
    return reply.send(user)
  })
}
