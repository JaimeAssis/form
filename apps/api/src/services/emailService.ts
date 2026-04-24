import { emailQueue } from '../lib/queue'

export async function enqueueNewResponseEmail(data: {
  to: string
  formTitle: string
  respondentName?: string | null
  formId: string
  responseId: string
  appUrl: string
}): Promise<void> {
  if (!emailQueue) return // Redis não disponível em dev
  await emailQueue.add('new-response', data, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
  })
}
