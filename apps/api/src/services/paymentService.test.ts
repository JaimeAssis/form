import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockPaymentIntentsCreate,
  mockPaymentCreate,
  mockPaymentFindUnique,
  mockPaymentUpdate,
  mockResponseUpdate,
  mockResponseFindMany,
  mockResponseUpdateMany,
  mockFormFindMany,
} = vi.hoisted(() => ({
  mockPaymentIntentsCreate: vi.fn(),
  mockPaymentCreate: vi.fn(),
  mockPaymentFindUnique: vi.fn(),
  mockPaymentUpdate: vi.fn(),
  mockResponseUpdate: vi.fn(),
  mockResponseFindMany: vi.fn(),
  mockResponseUpdateMany: vi.fn(),
  mockFormFindMany: vi.fn(),
}))

vi.mock('../lib/stripe', () => ({
  stripe: {
    paymentIntents: {
      create: mockPaymentIntentsCreate,
    },
  },
}))

vi.mock('../lib/prisma', () => ({
  prisma: {
    payment: {
      create: mockPaymentCreate,
      findUnique: mockPaymentFindUnique,
      update: mockPaymentUpdate,
    },
    response: {
      update: mockResponseUpdate,
      findMany: mockResponseFindMany,
      updateMany: mockResponseUpdateMany,
    },
    form: {
      findMany: mockFormFindMany,
    },
  },
}))

import {
  createOverageIntent,
  createOveragePack,
  handlePaymentSucceeded,
} from './paymentService'

beforeEach(() => vi.clearAllMocks())

describe('createOverageIntent', () => {
  it('creates PaymentIntent for R$3 and saves Payment record', async () => {
    mockPaymentIntentsCreate.mockResolvedValue({
      id: 'pi_test1',
      client_secret: 'pi_test1_secret_abc',
    })
    mockPaymentCreate.mockResolvedValue({})

    const result = await createOverageIntent('user-1', 'response-1')

    expect(mockPaymentIntentsCreate).toHaveBeenCalledWith({
      amount: 300,
      currency: 'brl',
      metadata: { responseId: 'response-1', userId: 'user-1', type: 'OVERAGE_SINGLE' },
    })
    expect(mockPaymentCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        responseId: 'response-1',
        type: 'OVERAGE_SINGLE',
        amount: 300,
        status: 'PENDING',
        stripePaymentIntentId: 'pi_test1',
      }),
    })
    expect(result).toEqual({ clientSecret: 'pi_test1_secret_abc' })
  })
})

describe('createOveragePack', () => {
  it('creates PaymentIntent for R$20 and saves Payment record', async () => {
    mockPaymentIntentsCreate.mockResolvedValue({
      id: 'pi_pack1',
      client_secret: 'pi_pack1_secret',
    })
    mockPaymentCreate.mockResolvedValue({})

    const result = await createOveragePack('user-2')

    expect(mockPaymentIntentsCreate).toHaveBeenCalledWith({
      amount: 2000,
      currency: 'brl',
      metadata: { userId: 'user-2', type: 'OVERAGE_PACK' },
    })
    expect(mockPaymentCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-2',
        type: 'OVERAGE_PACK',
        amount: 2000,
        status: 'PENDING',
      }),
    })
    expect(result).toEqual({ clientSecret: 'pi_pack1_secret' })
  })
})

describe('handlePaymentSucceeded', () => {
  it('does nothing when payment not found', async () => {
    mockPaymentFindUnique.mockResolvedValue(null)

    await handlePaymentSucceeded('pi_unknown')

    expect(mockPaymentUpdate).not.toHaveBeenCalled()
    expect(mockResponseUpdate).not.toHaveBeenCalled()
  })

  it('does nothing when payment already PAID (idempotent)', async () => {
    mockPaymentFindUnique.mockResolvedValue({
      id: 'pay-1',
      status: 'PAID',
      type: 'OVERAGE_SINGLE',
      responseId: 'resp-1',
      userId: 'user-1',
    })

    await handlePaymentSucceeded('pi_already')

    expect(mockPaymentUpdate).not.toHaveBeenCalled()
  })

  it('unlocks single response on OVERAGE_SINGLE payment', async () => {
    mockPaymentFindUnique.mockResolvedValue({
      id: 'pay-2',
      status: 'PENDING',
      type: 'OVERAGE_SINGLE',
      responseId: 'resp-2',
      userId: 'user-1',
    })
    mockPaymentUpdate.mockResolvedValue({})
    mockResponseUpdate.mockResolvedValue({})

    await handlePaymentSucceeded('pi_single')

    expect(mockPaymentUpdate).toHaveBeenCalledWith({
      where: { id: 'pay-2' },
      data: { status: 'PAID' },
    })
    expect(mockResponseUpdate).toHaveBeenCalledWith({
      where: { id: 'resp-2' },
      data: { status: 'UNLOCKED' },
    })
  })

  it('unlocks up to 20 oldest quarantined responses on OVERAGE_PACK payment', async () => {
    mockPaymentFindUnique.mockResolvedValue({
      id: 'pay-3',
      status: 'PENDING',
      type: 'OVERAGE_PACK',
      responseId: null,
      userId: 'user-1',
    })
    mockPaymentUpdate.mockResolvedValue({})
    mockFormFindMany.mockResolvedValue([{ id: 'form-1' }, { id: 'form-2' }])
    mockResponseFindMany.mockResolvedValue([{ id: 'resp-A' }, { id: 'resp-B' }])
    mockResponseUpdateMany.mockResolvedValue({})

    await handlePaymentSucceeded('pi_pack')

    expect(mockFormFindMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      select: { id: true },
    })
    expect(mockResponseFindMany).toHaveBeenCalledWith({
      where: { formId: { in: ['form-1', 'form-2'] }, status: 'QUARANTINED' },
      orderBy: { createdAt: 'asc' },
      take: 20,
    })
    expect(mockResponseUpdateMany).toHaveBeenCalledWith({
      where: { id: { in: ['resp-A', 'resp-B'] } },
      data: { status: 'UNLOCKED' },
    })
  })

  it('calls updateMany with empty array when no quarantined responses exist', async () => {
    mockPaymentFindUnique.mockResolvedValue({
      id: 'pay-4',
      status: 'PENDING',
      type: 'OVERAGE_PACK',
      responseId: null,
      userId: 'user-1',
    })
    mockPaymentUpdate.mockResolvedValue({})
    mockFormFindMany.mockResolvedValue([{ id: 'form-1' }])
    mockResponseFindMany.mockResolvedValue([])
    mockResponseUpdateMany.mockResolvedValue({})

    await handlePaymentSucceeded('pi_pack_empty')

    expect(mockResponseUpdateMany).toHaveBeenCalledWith({
      where: { id: { in: [] } },
      data: { status: 'UNLOCKED' },
    })
  })
})
