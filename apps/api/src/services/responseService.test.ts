import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Plan } from '@consorte/types'
import { countMonthlyUnlockedResponses, saveResponse } from './responseService'

vi.mock('../lib/prisma', () => ({
  prisma: {
    response: {
      count: vi.fn(),
      create: vi.fn(),
    },
  },
}))

import { prisma } from '../lib/prisma'

const mockCount = vi.mocked(prisma.response.count)
const mockCreate = vi.mocked(prisma.response.create)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('countMonthlyUnlockedResponses', () => {
  it('conta apenas respostas UNLOCKED do mês corrente para o formulário', async () => {
    mockCount.mockResolvedValue(7)
    const result = await countMonthlyUnlockedResponses('form-123')
    expect(result).toBe(7)
    expect(mockCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          formId: 'form-123',
          status: 'UNLOCKED',
        }),
      })
    )
  })
})

describe('saveResponse', () => {
  it('salva como UNLOCKED quando plano é PRO', async () => {
    mockCount.mockResolvedValue(99)
    mockCreate.mockResolvedValue({ id: 'resp-1', status: 'UNLOCKED' } as any)

    const result = await saveResponse({
      formId: 'form-1',
      ownerPlan: Plan.PRO,
      answers: [{ questionId: 'q-1', value: 'Sim' }],
    })

    expect(mockCount).not.toHaveBeenCalled()
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'UNLOCKED' }),
      })
    )
    expect(result.status).toBe('UNLOCKED')
  })

  it('salva como UNLOCKED quando plano é AGENCY', async () => {
    mockCreate.mockResolvedValue({ id: 'resp-2', status: 'UNLOCKED' } as any)

    await saveResponse({
      formId: 'form-1',
      ownerPlan: Plan.AGENCY,
      answers: [],
    })

    expect(mockCount).not.toHaveBeenCalled()
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'UNLOCKED' }),
      })
    )
  })

  it('salva como UNLOCKED quando plano FREE e count < 10', async () => {
    mockCount.mockResolvedValue(5)
    mockCreate.mockResolvedValue({ id: 'resp-3', status: 'UNLOCKED' } as any)

    await saveResponse({
      formId: 'form-1',
      ownerPlan: Plan.FREE,
      answers: [{ questionId: 'q-1', value: 'Texto' }],
    })

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'UNLOCKED' }),
      })
    )
  })

  it('salva como QUARANTINED quando plano FREE e count >= 10', async () => {
    mockCount.mockResolvedValue(10)
    mockCreate.mockResolvedValue({ id: 'resp-4', status: 'QUARANTINED' } as any)

    await saveResponse({
      formId: 'form-1',
      ownerPlan: Plan.FREE,
      answers: [{ questionId: 'q-1', value: 'Texto' }],
    })

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'QUARANTINED' }),
      })
    )
  })

  it('inclui respondentName e respondentEmail quando fornecidos', async () => {
    mockCreate.mockResolvedValue({ id: 'resp-5', status: 'UNLOCKED' } as any)

    await saveResponse({
      formId: 'form-1',
      ownerPlan: Plan.PRO,
      respondentName: 'João Silva',
      respondentEmail: 'joao@exemplo.com',
      answers: [],
    })

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          respondentName: 'João Silva',
          respondentEmail: 'joao@exemplo.com',
        }),
      })
    )
  })

  it('persiste as answers vinculadas à resposta', async () => {
    mockCreate.mockResolvedValue({ id: 'resp-6', status: 'UNLOCKED' } as any)

    await saveResponse({
      formId: 'form-1',
      ownerPlan: Plan.PRO,
      answers: [
        { questionId: 'q-1', value: 'Sim' },
        { questionId: 'q-2', value: '["Opção 1","Opção 3"]' },
      ],
    })

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          answers: {
            create: [
              { questionId: 'q-1', value: 'Sim' },
              { questionId: 'q-2', value: '["Opção 1","Opção 3"]' },
            ],
          },
        }),
      })
    )
  })
})
