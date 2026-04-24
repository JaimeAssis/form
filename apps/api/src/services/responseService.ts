// apps/api/src/services/responseService.ts
import { prisma } from '../lib/prisma'

export async function countMonthlyUnlockedResponses(formId: string): Promise<number> {
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  return prisma.response.count({
    where: {
      formId,
      status: 'UNLOCKED',
      createdAt: { gte: startOfMonth },
    },
  })
}

interface SaveResponseInput {
  formId: string
  ownerPlan: string
  respondentName?: string
  respondentEmail?: string
  answers: Array<{ questionId: string; value: string }>
}

export async function saveResponse(input: SaveResponseInput) {
  const { formId, ownerPlan, respondentName, respondentEmail, answers } = input

  let status: 'UNLOCKED' | 'QUARANTINED' = 'UNLOCKED'

  if (ownerPlan === 'FREE') {
    const count = await countMonthlyUnlockedResponses(formId)
    if (count >= 10) {
      status = 'QUARANTINED'
    }
  }

  return prisma.response.create({
    data: {
      formId,
      respondentName: respondentName ?? null,
      respondentEmail: respondentEmail ?? null,
      status,
      answers: {
        create: answers.map(a => ({ questionId: a.questionId, value: a.value })),
      },
    },
    include: { answers: true },
  })
}
