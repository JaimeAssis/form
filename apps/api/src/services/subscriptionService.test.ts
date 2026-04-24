import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCheckoutCreate = vi.fn()
const mockPortalCreate = vi.fn()

vi.mock('../lib/stripe', () => ({
  stripe: {
    checkout: { sessions: { create: (...a: unknown[]) => mockCheckoutCreate(...a) } },
    billingPortal: { sessions: { create: (...a: unknown[]) => mockPortalCreate(...a) } },
    customers: { retrieve: (...a: unknown[]) => vi.fn()(...a) },
  },
}))

vi.mock('../lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'user-1',
        email: 'a@b.com',
        stripeCustomerId: null,
        plan: 'FREE',
      }),
      update: vi.fn().mockResolvedValue({}),
    },
  },
}))

import {
  createCheckoutSession,
  createPortalSession,
  handleSubscriptionChange,
} from './subscriptionService'
import { prisma } from '../lib/prisma'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('createCheckoutSession', () => {
  it('retorna url de checkout', async () => {
    mockCheckoutCreate.mockResolvedValue({ url: 'https://checkout.stripe.com/pay/cs_test' })
    const result = await createCheckoutSession('user-1', 'price_pro_monthly', 'https://app.com')
    expect(result.url).toBe('https://checkout.stripe.com/pay/cs_test')
    expect(mockCheckoutCreate).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'subscription' }),
    )
  })

  it('lança erro se url for null', async () => {
    mockCheckoutCreate.mockResolvedValue({ url: null })
    await expect(
      createCheckoutSession('user-1', 'price_pro_monthly', 'https://app.com'),
    ).rejects.toThrow('Checkout URL not returned by Stripe')
  })

  it('lança erro se usuário não for encontrado', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
    await expect(
      createCheckoutSession('user-inexistente', 'price_pro_monthly', 'https://app.com'),
    ).rejects.toThrow('Usuário não encontrado: user-inexistente')
  })
})

describe('createPortalSession', () => {
  it('retorna url do portal', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      stripeCustomerId: 'cus_123',
    } as any)
    mockPortalCreate.mockResolvedValue({ url: 'https://billing.stripe.com/p/session_123' })
    const result = await createPortalSession('user-1', 'https://app.com')
    expect(result.url).toBe('https://billing.stripe.com/p/session_123')
  })

  it('lança erro se usuário não tiver stripeCustomerId', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ stripeCustomerId: null } as any)
    await expect(createPortalSession('user-1', 'https://app.com')).rejects.toThrow(
      'Usuário não possui assinatura ativa',
    )
  })
})

describe('handleSubscriptionChange', () => {
  it('atualiza plan para PRO quando status active e price_pro_monthly', async () => {
    await handleSubscriptionChange('cus_123', 'price_pro_monthly', 'active')
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { plan: 'PRO' } }),
    )
  })

  it('atualiza plan para AGENCY quando price_id_agency_monthly', async () => {
    await handleSubscriptionChange('cus_123', 'price_agency_monthly', 'active')
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { plan: 'AGENCY' } }),
    )
  })

  it('rebaixa para FREE quando status canceled', async () => {
    await handleSubscriptionChange('cus_123', 'price_pro_monthly', 'canceled')
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { plan: 'FREE' } }),
    )
  })
})
