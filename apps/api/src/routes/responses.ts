import { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/auth'
import { planGuard } from '../middleware/planGuard'

export async function responseRoutes(app: FastifyInstance) {
  // GET /forms/:id/responses
  app.get('/forms/:id/responses', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }

    const form = await prisma.form.findFirst({
      where: { id, userId: request.userId },
    })
    if (!form) return reply.status(404).send({ error: 'Formulário não encontrado' })

    const responses = await prisma.response.findMany({
      where: { formId: id },
      orderBy: { createdAt: 'desc' },
      select: { id: true, respondentName: true, createdAt: true, status: true },
    })

    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const userForms = await prisma.form.findMany({
      where: { userId: request.userId },
      select: { id: true },
    })
    const formIds = userForms.map((f: { id: string }) => f.id)

    const [monthlyFreeUsed, quarantinedCount, accumulatedPayments] = await Promise.all([
      prisma.response.count({
        where: {
          formId: { in: formIds },
          status: 'UNLOCKED',
          createdAt: { gte: startOfMonth },
        },
      }),
      prisma.response.count({
        where: { formId: { in: formIds }, status: 'QUARANTINED' },
      }),
      prisma.payment.aggregate({
        where: {
          userId: request.userId,
          status: 'PAID',
          type: { in: ['OVERAGE_SINGLE', 'OVERAGE_PACK'] },
          createdAt: { gte: startOfMonth },
        },
        _sum: { amount: true },
      }),
    ])

    return reply.send({
      responses,
      meta: {
        plan: request.userPlan,
        monthlyFreeUsed,
        quarantinedCount,
        accumulatedCostCents: accumulatedPayments._sum.amount ?? 0,
      },
    })
  })

  // GET /forms/:id/responses/:rid
  app.get('/forms/:id/responses/:rid', { preHandler: authenticate }, async (request, reply) => {
    const { id, rid } = request.params as { id: string; rid: string }

    const form = await prisma.form.findFirst({
      where: { id, userId: request.userId },
      include: { questions: { orderBy: { order: 'asc' } } },
    })
    if (!form) return reply.status(404).send({ error: 'Formulário não encontrado' })

    const response = await prisma.response.findFirst({
      where: { id: rid, formId: id },
      include: { answers: true },
    })
    if (!response) return reply.status(404).send({ error: 'Resposta não encontrada' })

    if (response.status === 'QUARANTINED') {
      return reply.status(402).send({
        status: 'quarantined',
        paymentRequired: true,
        amount: 300,
        respondentName: response.respondentName,
        createdAt: response.createdAt,
      })
    }

    const answersWithInfo = response.answers.map((a: { questionId: string; value: string }) => {
      const q = form.questions.find((fq: { id: string; title: string; type: string }) => fq.id === a.questionId)
      return {
        questionId: a.questionId,
        questionTitle: q?.title ?? 'Pergunta removida',
        questionType: q?.type ?? 'SHORT_TEXT',
        value: a.value,
      }
    })

    return reply.send({
      id: response.id,
      respondentName: response.respondentName,
      respondentEmail: response.respondentEmail,
      createdAt: response.createdAt,
      status: response.status,
      questions: form.questions.map((q: { id: string; title: string; type: string; order: number }) => ({
        id: q.id,
        title: q.title,
        type: q.type,
        order: q.order,
      })),
      answers: answersWithInfo,
    })
  })

  // GET /forms/:id/responses/export — Pro/Agência only
  app.get(
    '/forms/:id/responses/export',
    { preHandler: [authenticate, planGuard(['PRO', 'AGENCY'])] },
    async (request, reply) => {
      const { id } = request.params as { id: string }

      const form = await prisma.form.findFirst({
        where: { id, userId: request.userId },
        include: {
          questions: { orderBy: { order: 'asc' } },
          responses: {
            where: { status: 'UNLOCKED' },
            include: { answers: true },
            orderBy: { createdAt: 'desc' },
          },
        },
      })
      if (!form) return reply.status(404).send({ error: 'Formulário não encontrado' })

      const headers = ['Data', 'Respondente', ...form.questions.map((q: { title: string }) => q.title)]
      const rows = form.responses.map((r: { createdAt: Date; respondentName: string | null; answers: { questionId: string; value: string }[] }) => {
        const answerMap = new Map(r.answers.map((a: { questionId: string; value: string }) => [a.questionId, a.value]))
        return [
          new Date(r.createdAt).toLocaleString('pt-BR'),
          r.respondentName ?? 'Anônimo',
          ...form.questions.map((q: { id: string }) => {
            const val = answerMap.get(q.id) ?? ''
            try {
              const parsed = JSON.parse(val)
              if (Array.isArray(parsed)) return parsed.join('; ')
            } catch {
              // não é JSON
            }
            return val
          }),
        ]
      })

      const csvLines = [headers, ...rows]
        .map((row: (string | undefined)[]) =>
          row.map((cell: string | undefined) => `"${String(cell).replace(/"/g, '""')}"`).join(','),
        )
        .join('\r\n')

      const bom = '\uFEFF'
      const date = new Date().toISOString().slice(0, 10)
      reply.header('Content-Type', 'text/csv; charset=utf-8')
      reply.header(
        'Content-Disposition',
        `attachment; filename="respostas-${form.title.slice(0, 30)}-${date}.csv"`,
      )
      return reply.send(bom + csvLines)
    },
  )

  // GET /forms/:id/responses/export/pdf — Pro/Agência only
  app.get(
    '/forms/:id/responses/export/pdf',
    { preHandler: [authenticate, planGuard(['PRO', 'AGENCY'])] },
    async (request, reply) => {
      const { id } = request.params as { id: string }

      const form = await prisma.form.findFirst({
        where: { id, userId: request.userId },
        include: {
          questions: { orderBy: { order: 'asc' } },
          responses: {
            where: { status: 'UNLOCKED' },
            include: { answers: true },
            orderBy: { createdAt: 'desc' },
          },
        },
      })
      if (!form) return reply.status(404).send({ error: 'Formulário não encontrado' })

      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const PDFDocument = require('pdfkit')
      const doc = new PDFDocument({ margin: 50, size: 'A4' })
      const date = new Date().toISOString().slice(0, 10)

      reply.header('Content-Type', 'application/pdf')
      reply.header(
        'Content-Disposition',
        `attachment; filename="respostas-${form.title.slice(0, 30).replace(/[^a-zA-Z0-9]/g, '-')}-${date}.pdf"`,
      )

      doc.pipe(reply.raw)

      // Cabeçalho
      doc
        .fontSize(18)
        .font('Helvetica-Bold')
        .text(form.title, { align: 'center' })
      doc
        .fontSize(10)
        .font('Helvetica')
        .fillColor('#666666')
        .text(
          `Exportado em ${new Date().toLocaleDateString('pt-BR')} · ${form.responses.length} respostas`,
          { align: 'center' },
        )
      doc.moveDown(1)

      if (form.responses.length === 0) {
        doc.fontSize(12).fillColor('#333333').text('Nenhuma resposta desbloqueada encontrada.')
        doc.end()
        return reply
      }

      form.responses.forEach((response: { respondentName: string | null; createdAt: Date; answers: { questionId: string; value: string }[] }, idx: number) => {
        if (idx > 0) doc.addPage()

        doc
          .fontSize(13)
          .font('Helvetica-Bold')
          .fillColor('#111111')
          .text(`Resposta ${idx + 1}: ${response.respondentName ?? 'Anônimo'}`)
        doc
          .fontSize(9)
          .font('Helvetica')
          .fillColor('#888888')
          .text(`Recebida em ${new Date(response.createdAt).toLocaleString('pt-BR')}`)
        doc.moveDown(0.5)

        const answerMap = new Map(response.answers.map((a: { questionId: string; value: string }) => [a.questionId, a.value]))

        form.questions.forEach((q: { id: string; title: string }) => {
          const raw = answerMap.get(q.id) ?? ''
          let value = raw
          try {
            const parsed = JSON.parse(raw)
            if (Array.isArray(parsed)) value = parsed.join(', ')
          } catch { /* não é JSON */ }

          doc
            .fontSize(10)
            .font('Helvetica-Bold')
            .fillColor('#333333')
            .text(q.title, { continued: false })
          doc
            .fontSize(10)
            .font('Helvetica')
            .fillColor('#555555')
            .text(value || '(não respondida)', { indent: 16 })
          doc.moveDown(0.3)
        })
      })

      doc.end()
      return reply
    },
  )
}
