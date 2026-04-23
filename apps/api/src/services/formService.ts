import { prisma } from '../lib/prisma'

export function toSlug(title: string): string {
  const suffix = Math.random().toString(36).substring(2, 6)
  const base = title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
  return `${base}-${suffix}`
}

export async function generateUniqueSlug(title: string): Promise<string> {
  let slug = toSlug(title)
  let attempts = 0
  while (attempts < 10) {
    const existing = await prisma.form.findUnique({ where: { slug } })
    if (!existing) return slug
    slug = toSlug(title)
    attempts++
  }
  throw new Error('Não foi possível gerar slug único')
}

type QuestionLike = { id: string; condition: { triggerQuestionId: string } | null }

export function detectCircularCondition(
  questionId: string,
  triggerQuestionId: string,
  questions: QuestionLike[]
): boolean {
  const visited = new Set<string>()
  let current = triggerQuestionId
  while (current) {
    if (visited.has(current)) break
    if (current === questionId) return true
    visited.add(current)
    const q = questions.find(q => q.id === current)
    if (!q?.condition) break
    current = q.condition.triggerQuestionId
  }
  return false
}

export async function assertFreePlanPublishLimit(userId: string): Promise<void> {
  const published = await prisma.form.count({
    where: { userId, status: 'PUBLISHED' },
  })
  if (published >= 1) {
    throw { statusCode: 403, message: 'Plano Free permite apenas 1 formulário publicado. Faça upgrade para publicar mais.' }
  }
}
