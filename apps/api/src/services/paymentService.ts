import { stripe } from '../lib/stripe'
import { prisma } from '../lib/prisma'

export async function createOverageIntent(
  userId: string,
  responseId: string,
): Promise<{ clientSecret: string }> {
  const intent = await stripe.paymentIntents.create({
    amount: 300,
    currency: 'brl',
    metadata: { responseId, userId, type: 'OVERAGE_SINGLE' },
  })
  await prisma.payment.create({
    data: {
      userId,
      responseId,
      type: 'OVERAGE_SINGLE',
      amount: 300,
      status: 'PENDING',
      stripePaymentIntentId: intent.id,
    },
  })
  return { clientSecret: intent.client_secret! }
}

export async function createOveragePack(
  userId: string,
): Promise<{ clientSecret: string }> {
  const intent = await stripe.paymentIntents.create({
    amount: 2000,
    currency: 'brl',
    metadata: { userId, type: 'OVERAGE_PACK' },
  })
  await prisma.payment.create({
    data: {
      userId,
      type: 'OVERAGE_PACK',
      amount: 2000,
      status: 'PENDING',
      stripePaymentIntentId: intent.id,
    },
  })
  return { clientSecret: intent.client_secret! }
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
      take: 20,
    })
    await prisma.response.updateMany({
      where: { id: { in: quarantined.map((r) => r.id) } },
      data: { status: 'UNLOCKED' },
    })
  }
}
