import { Queue, Worker } from 'bullmq'
import IORedis from 'ioredis'
import { resend } from './resend'

let connection: IORedis | null = null

const redisUrl = process.env.REDIS_URL
const isValidRedisUrl = redisUrl && /^rediss?:\/\//.test(redisUrl)

if (isValidRedisUrl) {
  try {
    connection = new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
      lazyConnect: true,
    })
    connection.on('error', (err) => {
      console.error('[redis] connection error:', err.message)
    })
  } catch (err) {
    console.warn('[redis] failed to initialize, queue disabled:', err)
    connection = null
  }
} else {
  console.warn('[redis] REDIS_URL not set or invalid — email queue disabled')
}

export const emailQueue = connection
  ? new Queue('email-notifications', { connection })
  : null

if (connection) {
  new Worker(
    'email-notifications',
    async (job) => {
      const { to, formTitle, respondentName, formId, responseId, appUrl } = job.data

      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL ?? 'noreply@consorteform.com',
        to,
        subject: `Nova resposta em "${formTitle}"`,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:auto">
            <h2 style="color:#1a1a1a">Nova resposta recebida!</h2>
            <p>O formulário <strong>${formTitle}</strong> recebeu uma nova resposta
            ${respondentName ? `de <strong>${respondentName}</strong>` : ''}.</p>
            <a href="${appUrl}/forms/${formId}/responses"
               style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;margin-top:16px">
              Ver resposta →
            </a>
            <p style="color:#666;font-size:12px;margin-top:24px">
              Consorte Form · <a href="${appUrl}">consorteform.com</a>
            </p>
          </div>
        `,
      })
    },
    { connection },
  )
}
