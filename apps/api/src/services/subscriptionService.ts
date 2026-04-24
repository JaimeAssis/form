import { stripe } from '../lib/stripe'
import { prisma } from '../lib/prisma'

const PRICE_TO_PLAN: Record<string, 'PRO' | 'AGENCY'> = {
  price_pro_monthly: 'PRO',
  price_pro_annual: 'PRO',
  price_agency_monthly: 'AGENCY',
  price_agency_annual: 'AGENCY',
}

function priceIds() {
  return {
    price_pro_monthly: process.env.STRIPE_PRICE_PRO_MONTHLY ?? 'price_pro_monthly',
    price_pro_annual: process.env.STRIPE_PRICE_PRO_ANNUAL ?? 'price_pro_annual',
    price_agency_monthly: process.env.STRIPE_PRICE_AGENCY_MONTHLY ?? 'price_agency_monthly',
    price_agency_annual: process.env.STRIPE_PRICE_AGENCY_ANNUAL ?? 'price_agency_annual',
  }
}

function resolvePlan(priceId: string, status: string): 'FREE' | 'PRO' | 'AGENCY' {
  if (status === 'canceled' || status === 'unpaid' || status === 'incomplete_expired') {
    return 'FREE'
  }
  const ids = priceIds()
  for (const [key, plan] of Object.entries(PRICE_TO_PLAN)) {
    const resolved = ids[key as keyof typeof ids] ?? key
    if (resolved === priceId || key === priceId) return plan
  }
  return 'FREE'
}

export async function createCheckoutSession(
  userId: string,
  priceId: string,
  appUrl: string,
): Promise<{ url: string }> {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) throw new Error(`Usuário não encontrado: ${userId}`)

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/dashboard?upgraded=true`,
    cancel_url: `${appUrl}/dashboard/upgrade`,
    customer: user?.stripeCustomerId ?? undefined,
    customer_email: !user?.stripeCustomerId ? user?.email : undefined,
    metadata: { userId },
  })

  if (!session.url) throw new Error('Checkout URL not returned by Stripe')
  return { url: session.url }
}

export async function createPortalSession(
  userId: string,
  appUrl: string,
): Promise<{ url: string }> {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user?.stripeCustomerId) throw new Error('Usuário não possui assinatura ativa')

  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${appUrl}/dashboard/upgrade`,
  })

  if (!session.url) throw new Error('Portal URL not returned by Stripe')
  return { url: session.url }
}

export async function handleSubscriptionChange(
  customerId: string,
  priceId: string,
  status: string,
): Promise<void> {
  const plan = resolvePlan(priceId, status)
  await prisma.user.update({
    where: { stripeCustomerId: customerId },
    data: { plan },
  })
}
