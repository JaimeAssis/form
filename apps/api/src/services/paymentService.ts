import { stripe } from '../lib/stripe'
import { prisma } from '../lib/prisma'

const OVERAGE_SINGLE_PRICE_CENTS = 300
const OVERAGE_PACK_PRICE_CENTS = 2000
const OVERAGE_PACK_RESPONSE_LIMIT = 20

export async function createOverageIntent(
  userId: string,
  responseId: string,
): Promise<{ clientSecret: string }> {
  const intent = await stripe.paymentIntents.create({
    amount: OVERAGE_SINGLE_PRICE_CENTS,
    currency: 'brl',
    metadata: { responseId, userId, type: 'OVERAGE_SINGLE' },
  })

  try {
    await prisma.payment.create({
      data: {
        userId,
        responseId,
        type: 'OVERAGE_SINGLE',
        amount: OVERAGE_SINGLE_PRICE_CENTS,
        status: 'PENDING',
        stripePaymentIntentId: intent.id,
      },
    })
  } catch (err) {
    await stripe.paymentIntents.cancel(intent.id)
    throw err
  }

  if (!intent.client_secret) {
    throw new Error(`Missing client_secret on PaymentIntent ${intent.id}`)
  }
  return { clientSecret: intent.client_secret }
}

export async function createOveragePack(
  userId: string,
): Promise<{ clientSecret: string }> {
  const intent = await stripe.paymentIntents.create({
    amount: OVERAGE_PACK_PRICE_CENTS,
    currency: 'brl',
    metadata: { userId, type: 'OVERAGE_PACK' },
  })

  try {
    await prisma.payment.create({
      data: {
        userId,
        type: 'OVERAGE_PACK',
        amount: OVERAGE_PACK_PRICE_CENTS,
        status: 'PENDING',
        stripePaymentIntentId: intent.id,
      },
    })
  } catch (err) {
    await stripe.paymentIntents.cancel(intent.id)
    throw err
  }

  if (!intent.client_secret) {
    throw new Error(`Missing client_secret on PaymentIntent ${intent.id}`)
  }
  return { clientSecret: intent.client_secret }
}

export async function handlePaymentSucceeded(
  paymentIntentId: string,
): Promise<void> {
  const payment = await prisma.payment.findUnique({
    where: { stripePaymentIntentId: paymentIntentId },
  })
  if (!payment || payment.status === 'PAID') return

  await prisma.payment.update({
    where: { id: payment.id },
    data: { status: 'PAID' },
  })

  if (payment.type === 'OVERAGE_SINGLE' && payment.responseId) {
    await prisma.response.update({
      where: { id: payment.responseId },
      data: { status: 'UNLOCKED' },
    })
    return
  }

  if (payment.type === 'OVERAGE_PACK') {
    const userForms = await prisma.form.findMany({
      where: { userId: payment.userId },
      select: { id: true },
    })
    const formIds = userForms.map((f) => f.id)
    const quarantined = await prisma.response.findMany({
      where: { formId: { in: formIds }, status: 'QUARANTINED' },
      orderBy: { createdAt: 'asc' },
      take: OVERAGE_PACK_RESPONSE_LIMIT,
    })
    if (quarantined.length > 0) {
      await prisma.response.updateMany({
        where: { id: { in: quarantined.map((r) => r.id) } },
        data: { status: 'UNLOCKED' },
      })
    }
  }
}
