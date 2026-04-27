# Etapa 5 — Dashboard de Respostas + Overage/Stripe — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar o dashboard completo de respostas (lista, visualização individual, quarentena) e toda a mecânica de overage com Stripe (PaymentIntent para R$3,00 por resposta + pacote R$20 por 20 respostas + webhook para desbloquear).

**Architecture:** API Fastify com 3 novas rotas (`responses`, `payments`, `webhooks`) e um serviço `paymentService` com lógica isolada e testável. Frontend Next.js com componentes de cliente para a tabela, visualização individual, banner de custo acumulado e modal de pagamento com Stripe Payment Element embutido.

**Tech Stack:** Stripe SDK (backend), @stripe/stripe-js + @stripe/react-stripe-js (frontend), Fastify plugin-scoped raw body parser para webhook, Vitest para TDD do paymentService, Tailwind + shadcn/ui para UI.

---

## Mapa de Arquivos

### API (`apps/api/`)
| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `src/lib/stripe.ts` | Criar | Singleton do cliente Stripe |
| `src/services/paymentService.ts` | Criar | createOverageIntent, createOveragePack, handlePaymentSucceeded |
| `src/services/paymentService.test.ts` | Criar | Testes Vitest com vi.mock de stripe e prisma |
| `src/routes/responses.ts` | Criar | GET /forms/:id/responses, GET /forms/:id/responses/:rid |
| `src/routes/payments.ts` | Criar | POST /payments/overage/intent, POST /payments/overage/pack |
| `src/routes/webhooks.ts` | Criar | POST /webhooks/stripe (buffer body parser scoped) |
| `src/index.ts` | Modificar | Registrar os 3 novos plugins |
| `package.json` | Modificar | Adicionar dependência `stripe` |

### Web (`apps/web/`)
| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `src/lib/api.ts` | Modificar | Exportar `apiFetch`, adicionar funções de respostas e pagamentos, tipos de resposta |
| `src/components/responses/OverageBanner.tsx` | Criar | Banner de custo acumulado para plano FREE |
| `src/components/responses/ResponsesTable.tsx` | Criar | Tabela de respostas com status visual |
| `src/components/responses/ResponseDetail.tsx` | Criar | Visualização individual de resposta desbloqueada |
| `src/components/responses/QuarantineModal.tsx` | Criar | Modal de pagamento com Stripe Payment Element + polling |
| `src/app/(dashboard)/forms/[id]/responses/page.tsx` | Criar | Página principal que orquestra todos os componentes |
| `src/app/(dashboard)/forms/page.tsx` | Modificar | Adicionar botão "Ver respostas" em cada card |
| `package.json` | Modificar | Adicionar @stripe/stripe-js e @stripe/react-stripe-js |

---

## Task 1: Stripe lib + paymentService (TDD)

**Files:**
- Create: `apps/api/src/lib/stripe.ts`
- Create: `apps/api/src/services/paymentService.ts`
- Create: `apps/api/src/services/paymentService.test.ts`
- Modify: `apps/api/package.json`

- [ ] **Step 1: Instalar o Stripe SDK**

```bash
cd apps/api && npm install stripe
```

Verificar que `stripe` aparece em `dependencies` no `apps/api/package.json`.

- [ ] **Step 2: Criar `apps/api/src/lib/stripe.ts`**

```typescript
import Stripe from 'stripe'

const key = process.env.STRIPE_SECRET_KEY
if (!key) throw new Error('STRIPE_SECRET_KEY is not set')

export const stripe = new Stripe(key, {
  apiVersion: '2023-10-16',
})
```

- [ ] **Step 3: Escrever os testes com falha para paymentService**

Criar `apps/api/src/services/paymentService.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockPaymentIntentsCreate = vi.fn()
const mockPaymentCreate = vi.fn()
const mockPaymentFindUnique = vi.fn()
const mockPaymentUpdate = vi.fn()
const mockResponseUpdate = vi.fn()
const mockResponseFindMany = vi.fn()
const mockResponseUpdateMany = vi.fn()
const mockFormFindMany = vi.fn()

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
```

- [ ] **Step 4: Rodar testes — confirmar que falham**

```bash
cd apps/api && npm test
```

Esperado: `Cannot find module './paymentService'` ou similar.

- [ ] **Step 5: Implementar `apps/api/src/services/paymentService.ts`**

```typescript
import Stripe from 'stripe'
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
```

- [ ] **Step 6: Rodar testes — confirmar que todos passam**

```bash
cd apps/api && npm test
```

Esperado: `6/6 tests passed` (ou número equivalente).

- [ ] **Step 7: Commit**

```bash
git add apps/api/package.json apps/api/src/lib/stripe.ts apps/api/src/services/paymentService.ts apps/api/src/services/paymentService.test.ts
git commit -m "feat: Stripe client e paymentService com TDD (overage single + pack + webhook handler)"
```

---

## Task 2: Responses API Routes

**Files:**
- Create: `apps/api/src/routes/responses.ts`

- [ ] **Step 1: Criar `apps/api/src/routes/responses.ts`**

```typescript
import { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/auth'

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
    const formIds = userForms.map((f) => f.id)

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

    const answersWithInfo = response.answers.map((a) => {
      const q = form.questions.find((q) => q.id === a.questionId)
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
      questions: form.questions.map((q) => ({
        id: q.id,
        title: q.title,
        type: q.type,
        order: q.order,
      })),
      answers: answersWithInfo,
    })
  })
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
cd apps/api && npm run type-check
```

Esperado: sem erros.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/routes/responses.ts
git commit -m "feat: rotas GET /forms/:id/responses e GET /forms/:id/responses/:rid"
```

---

## Task 3: Payment + Webhook Routes + Registrar no Servidor

**Files:**
- Create: `apps/api/src/routes/payments.ts`
- Create: `apps/api/src/routes/webhooks.ts`
- Modify: `apps/api/src/index.ts`

- [ ] **Step 1: Criar `apps/api/src/routes/payments.ts`**

```typescript
import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/auth'
import { createOverageIntent, createOveragePack } from '../services/paymentService'

export async function paymentRoutes(app: FastifyInstance) {
  // POST /payments/overage/intent
  app.post('/payments/overage/intent', { preHandler: authenticate }, async (request, reply) => {
    const body = z.object({ responseId: z.string().uuid() }).parse(request.body)

    const response = await prisma.response.findFirst({
      where: {
        id: body.responseId,
        form: { userId: request.userId },
      },
    })
    if (!response) return reply.status(404).send({ error: 'Resposta não encontrada' })
    if (response.status !== 'QUARANTINED') {
      return reply.status(400).send({ error: 'Resposta já desbloqueada' })
    }

    const result = await createOverageIntent(request.userId, body.responseId)
    return reply.send(result)
  })

  // POST /payments/overage/pack
  app.post('/payments/overage/pack', { preHandler: authenticate }, async (_request, reply) => {
    const result = await createOveragePack(_request.userId)
    return reply.send(result)
  })
}
```

- [ ] **Step 2: Criar `apps/api/src/routes/webhooks.ts`**

Nota: `addContentTypeParser('application/json', { parseAs: 'buffer' })` dentro de um plugin Fastify é **scoped** — afeta apenas rotas dentro deste plugin, não interfere no JSON parser global dos demais plugins.

```typescript
import { FastifyInstance } from 'fastify'
import Stripe from 'stripe'
import { stripe } from '../lib/stripe'
import { handlePaymentSucceeded } from '../services/paymentService'

export async function webhookRoutes(app: FastifyInstance) {
  // Sobrescrever parser de JSON neste escopo para receber body raw (necessário para verificar assinatura Stripe)
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (_req, body, done) => done(null, body),
  )

  app.post('/webhooks/stripe', async (request, reply) => {
    const sig = request.headers['stripe-signature']
    if (!sig || typeof sig !== 'string') {
      return reply.status(400).send({ error: 'Missing stripe-signature' })
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
    if (!webhookSecret) {
      app.log.error('STRIPE_WEBHOOK_SECRET not set')
      return reply.status(500).send({ error: 'Webhook secret not configured' })
    }

    let event: Stripe.Event
    try {
      event = stripe.webhooks.constructEvent(
        request.body as Buffer,
        sig,
        webhookSecret,
      )
    } catch {
      return reply.status(400).send({ error: 'Invalid signature' })
    }

    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent
      await handlePaymentSucceeded(paymentIntent.id)
    }

    return reply.send({ received: true })
  })
}
```

- [ ] **Step 3: Modificar `apps/api/src/index.ts` para registrar as 3 novas rotas**

Adicionar os imports e registros — o arquivo completo deve ficar assim:

```typescript
import Fastify from 'fastify'
import cors from '@fastify/cors'
import 'dotenv/config'
import { authRoutes } from './routes/auth'
import { userRoutes } from './routes/users'
import { formRoutes } from './routes/forms'
import { questionRoutes } from './routes/questions'
import { publicRoutes } from './routes/public'
import { responseRoutes } from './routes/responses'
import { paymentRoutes } from './routes/payments'
import { webhookRoutes } from './routes/webhooks'

const server = Fastify({ logger: true })

server.register(cors, {
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
})

server.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }))

server.register(authRoutes)
server.register(userRoutes)
server.register(formRoutes)
server.register(questionRoutes)
server.register(publicRoutes)
server.register(responseRoutes)
server.register(paymentRoutes)
// IMPORTANTE: webhookRoutes deve ser registrado por último pois sobrescreve o parser JSON no seu escopo
server.register(webhookRoutes)

const start = async () => {
  try {
    await server.listen({ port: Number(process.env.PORT) || 3001, host: '0.0.0.0' })
  } catch (err) {
    server.log.error(err)
    process.exit(1)
  }
}

start()
```

- [ ] **Step 4: Rodar type-check e testes**

```bash
cd apps/api && npm run type-check && npm test
```

Esperado: sem erros de TypeScript, todos os testes passando.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/payments.ts apps/api/src/routes/webhooks.ts apps/api/src/index.ts
git commit -m "feat: rotas de pagamentos, webhook Stripe e registro no servidor"
```

---

## Task 4: Web — Tipos de API + Funções de Cliente

**Files:**
- Modify: `apps/web/package.json`
- Modify: `apps/web/src/lib/api.ts`

- [ ] **Step 1: Instalar pacotes Stripe no frontend**

```bash
cd apps/web && npm install @stripe/stripe-js @stripe/react-stripe-js
```

- [ ] **Step 2: Verificar que aparecem em `apps/web/package.json` em `dependencies`**

- [ ] **Step 3: Modificar `apps/web/src/lib/api.ts` — exportar `apiFetch` e adicionar funções de resposta/pagamento**

Adicionar `export` na linha da função `apiFetch` (atualmente não está exportada mas é necessária no QuarantineModal para o polling):

```typescript
// Linha 11 — trocar:
// async function apiFetch<T>
// por:
export async function apiFetch<T>
```

Adicionar ao final do arquivo os novos tipos e funções:

```typescript
// ─── Responses ────────────────────────────────────────────────────────────────

export interface ResponseSummary {
  id: string
  respondentName: string | null
  createdAt: string
  status: 'UNLOCKED' | 'QUARANTINED'
}

export interface ResponsesMeta {
  plan: string
  monthlyFreeUsed: number
  quarantinedCount: number
  accumulatedCostCents: number
}

export interface ResponsesListResult {
  responses: ResponseSummary[]
  meta: ResponsesMeta
}

export interface AnswerWithInfo {
  questionId: string
  questionTitle: string
  questionType: string
  value: string
}

export interface ResponseQuestion {
  id: string
  title: string
  type: string
  order: number
}

export interface ResponseDetail {
  id: string
  respondentName: string | null
  respondentEmail: string | null
  createdAt: string
  status: 'UNLOCKED'
  questions: ResponseQuestion[]
  answers: AnswerWithInfo[]
}

export async function getFormResponses(formId: string): Promise<ResponsesListResult> {
  return apiFetch<ResponsesListResult>(`/forms/${formId}/responses`)
}

export async function getResponseById(
  formId: string,
  responseId: string,
): Promise<ResponseDetail> {
  return apiFetch<ResponseDetail>(`/forms/${formId}/responses/${responseId}`)
}

// ─── Payments ─────────────────────────────────────────────────────────────────

export async function createOverageIntent(
  responseId: string,
): Promise<{ clientSecret: string }> {
  return apiFetch<{ clientSecret: string }>('/payments/overage/intent', {
    method: 'POST',
    body: JSON.stringify({ responseId }),
  })
}

export async function createOveragePack(): Promise<{ clientSecret: string }> {
  return apiFetch<{ clientSecret: string }>('/payments/overage/pack', {
    method: 'POST',
  })
}
```

- [ ] **Step 4: Verificar TypeScript**

```bash
cd apps/web && npm run type-check
```

Esperado: sem erros.

- [ ] **Step 5: Commit**

```bash
git add apps/web/package.json apps/web/src/lib/api.ts
git commit -m "feat: instalar @stripe/stripe-js, exportar apiFetch e adicionar funções de respostas/pagamentos"
```

---

## Task 5: OverageBanner Component

**Files:**
- Create: `apps/web/src/components/responses/OverageBanner.tsx`

- [ ] **Step 1: Criar `apps/web/src/components/responses/OverageBanner.tsx`**

```typescript
'use client'

interface OverageBannerProps {
  plan: string
  monthlyFreeUsed: number
  quarantinedCount: number
  accumulatedCostCents: number
}

export function OverageBanner({
  plan,
  monthlyFreeUsed,
  quarantinedCount,
  accumulatedCostCents,
}: OverageBannerProps) {
  if (plan !== 'FREE') return null

  const accumulatedBRL = (accumulatedCostCents / 100).toFixed(2).replace('.', ',')
  const progressPercent = Math.min((monthlyFreeUsed / 10) * 100, 100)
  const showUpgradeHint = accumulatedCostCents >= 4000 // R$ 40,00 — próximo do Pro

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 mb-6">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-amber-800">
          Você usou {monthlyFreeUsed} de 10 respostas gratuitas este mês
        </span>
        {quarantinedCount > 0 && (
          <span className="text-xs text-amber-700">
            {quarantinedCount} {quarantinedCount === 1 ? 'bloqueada' : 'bloqueadas'} ·{' '}
            Custo acumulado: R$ {accumulatedBRL}
          </span>
        )}
      </div>

      <div className="w-full bg-amber-200 rounded-full h-1.5">
        <div
          className="bg-amber-500 h-1.5 rounded-full transition-all"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {showUpgradeHint && (
        <p className="mt-2 text-xs text-amber-700">
          Você está perto do valor do Pro. Assine por R$ 57/mês e libere tudo.{' '}
          <a href="/dashboard/upgrade" className="underline font-medium">
            Ver planos
          </a>
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
cd apps/web && npm run type-check
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/responses/OverageBanner.tsx
git commit -m "feat: OverageBanner — custo acumulado e progresso mensal para plano Free"
```

---

## Task 6: ResponsesTable Component

**Files:**
- Create: `apps/web/src/components/responses/ResponsesTable.tsx`

- [ ] **Step 1: Criar `apps/web/src/components/responses/ResponsesTable.tsx`**

```typescript
'use client'

import { ResponseSummary } from '@/lib/api'
import { LockOpen, Lock } from 'lucide-react'

interface ResponsesTableProps {
  responses: ResponseSummary[]
  onSelectUnlocked: (id: string) => void
  onSelectQuarantined: (id: string) => void
}

export function ResponsesTable({
  responses,
  onSelectUnlocked,
  onSelectQuarantined,
}: ResponsesTableProps) {
  if (responses.length === 0) {
    return (
      <div className="text-center py-16 border-2 border-dashed rounded-xl">
        <p className="text-sm text-gray-500 mb-1">Nenhuma resposta recebida ainda.</p>
        <p className="text-xs text-gray-400">Compartilhe o link do formulário para começar a receber respostas.</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">#</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Nome</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Data</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {responses.map((r, i) => (
            <tr
              key={r.id}
              onClick={() =>
                r.status === 'UNLOCKED'
                  ? onSelectUnlocked(r.id)
                  : onSelectQuarantined(r.id)
              }
              className="cursor-pointer hover:bg-gray-50 transition-colors"
            >
              <td className="px-4 py-3 text-gray-400">{responses.length - i}</td>
              <td className="px-4 py-3 font-medium text-gray-800">
                {r.respondentName ?? 'Anônimo'}
              </td>
              <td className="px-4 py-3 text-gray-500">
                {new Date(r.createdAt).toLocaleString('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </td>
              <td className="px-4 py-3">
                {r.status === 'UNLOCKED' ? (
                  <span className="inline-flex items-center gap-1 text-green-700 bg-green-50 px-2 py-0.5 rounded-full text-xs font-medium">
                    <LockOpen className="w-3 h-3" /> Desbloqueada
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-orange-700 bg-orange-50 px-2 py-0.5 rounded-full text-xs font-medium">
                    <Lock className="w-3 h-3" /> Quarentena
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
cd apps/web && npm run type-check
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/responses/ResponsesTable.tsx
git commit -m "feat: ResponsesTable com status visual e empty state"
```

---

## Task 7: ResponseDetail Component

**Files:**
- Create: `apps/web/src/components/responses/ResponseDetail.tsx`

- [ ] **Step 1: Criar `apps/web/src/components/responses/ResponseDetail.tsx`**

```typescript
'use client'

import { useState, useEffect } from 'react'
import { getResponseById, ResponseDetail as ResponseDetailType } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

interface ResponseDetailProps {
  formId: string
  responseId: string
  onBack: () => void
}

function formatAnswer(value: string, type: string): string {
  if (type === 'MULTIPLE_SELECT') {
    try {
      const arr: unknown = JSON.parse(value)
      if (Array.isArray(arr)) return (arr as string[]).join(', ')
    } catch { /* not JSON */ }
  }
  return value
}

export function ResponseDetail({ formId, responseId, onBack }: ResponseDetailProps) {
  const [data, setData] = useState<ResponseDetailType | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    getResponseById(formId, responseId)
      .then(setData)
      .catch(() => setError('Erro ao carregar resposta. Tente novamente.'))
      .finally(() => setLoading(false))
  }, [formId, responseId])

  if (loading) {
    return <div className="text-sm text-gray-400 py-8 text-center">Carregando…</div>
  }
  if (error) {
    return <div className="text-sm text-red-500 py-8 text-center">{error}</div>
  }
  if (!data) return null

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Voltar para lista
        </Button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="mb-5 pb-4 border-b border-gray-100">
          <p className="font-semibold text-gray-800">{data.respondentName ?? 'Anônimo'}</p>
          {data.respondentEmail && (
            <p className="text-xs text-gray-500 mt-0.5">{data.respondentEmail}</p>
          )}
          <p className="text-xs text-gray-400 mt-0.5">
            {new Date(data.createdAt).toLocaleString('pt-BR', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>

        <div className="space-y-5">
          {data.questions.map((q) => {
            const answer = data.answers.find((a) => a.questionId === q.id)
            return (
              <div key={q.id}>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                  {q.order}. {q.title}
                </p>
                {answer ? (
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">
                    {formatAnswer(answer.value, answer.questionType)}
                  </p>
                ) : (
                  <p className="text-sm text-gray-400 italic">não respondida</p>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
cd apps/web && npm run type-check
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/responses/ResponseDetail.tsx
git commit -m "feat: ResponseDetail — visualização completa de resposta desbloqueada"
```

---

## Task 8: QuarantineModal com Stripe Payment Element

**Files:**
- Create: `apps/web/src/components/responses/QuarantineModal.tsx`

Variável de ambiente necessária: `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (deve estar no `.env.local` da web).

- [ ] **Step 1: Criar `apps/web/src/components/responses/QuarantineModal.tsx`**

```typescript
'use client'

import { useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js'
import { apiFetch, createOverageIntent, createOveragePack } from '@/lib/api'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

// Carregar Stripe uma vez fora do componente para evitar recriação
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

// ─── Polling após pagamento confirmado ────────────────────────────────────────
async function pollForUnlock(
  formId: string,
  responseId: string,
  maxAttempts = 15,
): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise<void>((resolve) => setTimeout(resolve, 2000))
    try {
      await apiFetch(`/forms/${formId}/responses/${responseId}`)
      return true // 200 = UNLOCKED
    } catch (err: unknown) {
      // 402 = ainda em quarentena — continuar polling
      if (err instanceof Error && (err as { status?: number }).status === 402) continue
      throw err // outro erro
    }
  }
  return false // timeout após 30 segundos
}

// ─── Formulário de pagamento (dentro de <Elements>) ───────────────────────────
interface PaymentFormProps {
  formId: string
  responseId: string
  onUnlocked: () => void
  onError: (msg: string) => void
}

function PaymentForm({ formId, responseId, onUnlocked, onError }: PaymentFormProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [paying, setPaying] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return

    setPaying(true)
    try {
      const result = await stripe.confirmPayment({
        elements,
        redirect: 'if_required',
        confirmParams: { return_url: window.location.href },
      })

      if (result.error) {
        onError(result.error.message ?? 'Erro no pagamento')
        return
      }

      const unlocked = await pollForUnlock(formId, responseId)
      if (unlocked) {
        onUnlocked()
      } else {
        onError(
          'Pagamento confirmado! A resposta será desbloqueada em instantes. Tente recarregar.',
        )
      }
    } catch {
      onError('Erro inesperado no pagamento. Tente novamente.')
    } finally {
      setPaying(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 mt-4">
      <PaymentElement />
      <Button
        type="submit"
        disabled={paying || !stripe}
        className="w-full bg-blue-600 hover:bg-blue-700"
      >
        {paying ? 'Processando…' : 'Confirmar pagamento'}
      </Button>
    </form>
  )
}

// ─── Modal principal ──────────────────────────────────────────────────────────
interface QuarantineModalProps {
  open: boolean
  formId: string
  responseId: string
  respondentName: string | null
  createdAt: string
  accumulatedCostCents: number
  onUnlocked: () => void
  onClose: () => void
}

export function QuarantineModal({
  open,
  formId,
  responseId,
  respondentName,
  createdAt,
  accumulatedCostCents,
  onUnlocked,
  onClose,
}: QuarantineModalProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [loadingIntent, setLoadingIntent] = useState(false)

  const accumulatedBRL = (accumulatedCostCents / 100).toFixed(2).replace('.', ',')
  const showProHint = accumulatedCostCents >= 4000 // R$ 40

  function resetState() {
    setClientSecret(null)
    setPaymentError(null)
    setLoadingIntent(false)
  }

  function handleClose() {
    resetState()
    onClose()
  }

  function handleUnlocked() {
    resetState()
    onUnlocked()
    onClose()
  }

  async function handlePaySingle() {
    setLoadingIntent(true)
    setPaymentError(null)
    try {
      const { clientSecret: cs } = await createOverageIntent(responseId)
      setClientSecret(cs)
    } catch {
      setPaymentError('Erro ao iniciar pagamento. Tente novamente.')
    } finally {
      setLoadingIntent(false)
    }
  }

  async function handlePayPack() {
    setLoadingIntent(true)
    setPaymentError(null)
    try {
      const { clientSecret: cs } = await createOveragePack()
      setClientSecret(cs)
    } catch {
      setPaymentError('Erro ao iniciar pagamento. Tente novamente.')
    } finally {
      setLoadingIntent(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Resposta bloqueada</DialogTitle>
        </DialogHeader>

        {/* Nome + data — sempre visíveis */}
        <div className="text-sm mb-3">
          <p className="font-medium text-gray-800">{respondentName ?? 'Anônimo'}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {new Date(createdAt).toLocaleString('pt-BR', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>

        {/* Conteúdo borrado */}
        <div className="bg-gray-50 rounded-lg p-4 mb-4 select-none" aria-hidden>
          {[1, 2, 3].map((i) => (
            <div key={i} className="blur-sm text-gray-400 text-sm mb-2">
              ●●●●● ●●●●●●●● ●●●●●●●
            </div>
          ))}
        </div>

        <p className="text-sm font-medium text-amber-700 mb-1">
          Você atingiu o limite de 10 respostas gratuitas este mês.
        </p>
        <p className="text-xs text-gray-500 mb-1">
          Custo acumulado este mês: R$ {accumulatedBRL}
        </p>
        <p className="text-xs text-gray-400 mb-4">
          A partir de 22 respostas/mês, o plano Pro (R$ 57) é mais econômico.
        </p>

        {paymentError && (
          <p className="text-sm text-red-500 mb-3" role="alert">
            {paymentError}
          </p>
        )}

        {!clientSecret ? (
          <div className="space-y-2">
            <Button
              onClick={handlePaySingle}
              disabled={loadingIntent}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              {loadingIntent ? 'Aguarde…' : 'Pagar R$ 3,00 para ver esta resposta'}
            </Button>
            <Button
              variant="outline"
              onClick={handlePayPack}
              disabled={loadingIntent}
              className="w-full"
            >
              Ou adquira 20 respostas por R$ 20,00
            </Button>
            {showProHint && (
              <Button variant="ghost" className="w-full text-xs text-gray-500" asChild>
                <a href="/dashboard/upgrade">Ver plano Pro →</a>
              </Button>
            )}
          </div>
        ) : (
          <Elements stripe={stripePromise} options={{ clientSecret }}>
            <PaymentForm
              formId={formId}
              responseId={responseId}
              onUnlocked={handleUnlocked}
              onError={setPaymentError}
            />
          </Elements>
        )}
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
cd apps/web && npm run type-check
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/responses/QuarantineModal.tsx
git commit -m "feat: QuarantineModal com Stripe Payment Element, polling e pacote de 20 respostas"
```

---

## Task 9: Página de Respostas + Link "Ver respostas" na Lista

**Files:**
- Create: `apps/web/src/app/(dashboard)/forms/[id]/responses/page.tsx`
- Modify: `apps/web/src/app/(dashboard)/forms/page.tsx`

- [ ] **Step 1: Criar `apps/web/src/app/(dashboard)/forms/[id]/responses/page.tsx`**

```typescript
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  getFormResponses,
  ResponseSummary,
  ResponsesMeta,
} from '@/lib/api'
import { OverageBanner } from '@/components/responses/OverageBanner'
import { ResponsesTable } from '@/components/responses/ResponsesTable'
import { ResponseDetail } from '@/components/responses/ResponseDetail'
import { QuarantineModal } from '@/components/responses/QuarantineModal'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

interface QuarantinedTarget {
  id: string
  respondentName: string | null
  createdAt: string
}

export default function ResponsesPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [responses, setResponses] = useState<ResponseSummary[]>([])
  const [meta, setMeta] = useState<ResponsesMeta | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedUnlockedId, setSelectedUnlockedId] = useState<string | null>(null)
  const [quarantinedTarget, setQuarantinedTarget] = useState<QuarantinedTarget | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    getFormResponses(id)
      .then(({ responses: r, meta: m }) => {
        setResponses(r)
        setMeta(m)
      })
      .catch(() => router.push(`/dashboard/forms/${id}/edit`))
      .finally(() => setLoading(false))
  }, [id, router])

  useEffect(() => {
    load()
  }, [load])

  function handleSelectQuarantined(responseId: string) {
    const r = responses.find((r) => r.id === responseId)
    if (!r) return
    setQuarantinedTarget({
      id: r.id,
      respondentName: r.respondentName,
      createdAt: r.createdAt,
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        Carregando respostas…
      </div>
    )
  }

  // Visualização individual de resposta desbloqueada
  if (selectedUnlockedId) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <ResponseDetail
          formId={id}
          responseId={selectedUnlockedId}
          onBack={() => setSelectedUnlockedId(null)}
        />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/dashboard/forms/${id}/edit`)}
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> Voltar ao editor
        </Button>
        <h1 className="text-lg font-semibold text-gray-800">Respostas</h1>
      </div>

      {/* Banner de overage (só para FREE) */}
      {meta && (
        <OverageBanner
          plan={meta.plan}
          monthlyFreeUsed={meta.monthlyFreeUsed}
          quarantinedCount={meta.quarantinedCount}
          accumulatedCostCents={meta.accumulatedCostCents}
        />
      )}

      {/* Tabela de respostas */}
      <ResponsesTable
        responses={responses}
        onSelectUnlocked={setSelectedUnlockedId}
        onSelectQuarantined={handleSelectQuarantined}
      />

      {/* Modal de quarentena */}
      {quarantinedTarget && meta && (
        <QuarantineModal
          open={!!quarantinedTarget}
          formId={id}
          responseId={quarantinedTarget.id}
          respondentName={quarantinedTarget.respondentName}
          createdAt={quarantinedTarget.createdAt}
          accumulatedCostCents={meta.accumulatedCostCents}
          onUnlocked={load}
          onClose={() => setQuarantinedTarget(null)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Modificar `apps/web/src/app/(dashboard)/forms/page.tsx` — adicionar botão "Ver respostas"**

Localizar o bloco de imports e adicionar `BarChart2` ao import do lucide-react:
```typescript
import { Plus, Edit2, Copy, Trash2, Globe, PauseCircle, BarChart2 } from 'lucide-react'
```

Localizar o bloco de botões de ação (que já tem Edit2, Copy, etc.) e adicionar um botão antes do Edit2:
```typescript
<Button variant="ghost" size="sm" onClick={() => router.push(`/dashboard/forms/${form.id}/responses`)}>
  <BarChart2 className="w-4 h-4" />
</Button>
```

O bloco de botões completo deve ficar assim:
```tsx
<div className="flex items-center gap-1">
  <Button variant="ghost" size="sm" onClick={() => router.push(`/dashboard/forms/${form.id}/responses`)}>
    <BarChart2 className="w-4 h-4" />
  </Button>
  <Button variant="ghost" size="sm" onClick={() => router.push(`/dashboard/forms/${form.id}/edit`)}>
    <Edit2 className="w-4 h-4" />
  </Button>
  {form.status === FormStatus.PUBLISHED && (
    <Button variant="ghost" size="sm" onClick={() => handleCopyLink(form.slug)}>
      <Copy className="w-4 h-4" />
    </Button>
  )}
  <Button
    variant="ghost"
    size="sm"
    onClick={() => handleToggleStatus(form)}
    className={form.status === FormStatus.PUBLISHED ? 'text-orange-500' : 'text-green-600'}
  >
    {form.status === FormStatus.PUBLISHED ? <PauseCircle className="w-4 h-4" /> : <Globe className="w-4 h-4" />}
  </Button>
  <Button variant="ghost" size="sm" onClick={() => handleDelete(form.id)} className="text-red-400 hover:text-red-600">
    <Trash2 className="w-4 h-4" />
  </Button>
</div>
```

- [ ] **Step 3: Rodar type-check e build**

```bash
cd apps/web && npm run type-check && npm run build
```

Esperado: sem erros. Se houver erro de TypeScript relacionado a `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` sendo `undefined`, é esperado em dev sem as variáveis configuradas — o build deve passar mesmo assim.

- [ ] **Step 4: Rodar build da API também**

```bash
cd apps/api && npm run build
```

Esperado: sem erros.

- [ ] **Step 5: Rodar todos os testes**

```bash
cd apps/api && npm test
```

Esperado: todos os testes passando (incluindo os 6 novos de paymentService + os anteriores).

- [ ] **Step 6: Commit final**

```bash
git add apps/web/src/app/\(dashboard\)/forms/\[id\]/responses/page.tsx apps/web/src/app/\(dashboard\)/forms/page.tsx
git commit -m "feat: página de respostas completa e botão de acesso na lista de formulários"
```

---

## Self-Review

### Spec Coverage

| Requisito | Task |
|---|---|
| GET /forms/:id/responses — lista com status | Task 2 |
| GET /forms/:id/responses/:rid — individual com 402 se QUARANTINED | Task 2 |
| POST /payments/overage/intent — Stripe PaymentIntent R$3 | Task 3 |
| POST /payments/overage/pack — Stripe PaymentIntent R$20 | Task 3 |
| POST /webhooks/stripe — verificar assinatura, liberar resposta | Task 3 |
| Dashboard: tabela com seq, nome, data, status visual | Task 6 |
| Dashboard: clicar desbloqueada → visualização completa | Task 7 + Task 9 |
| Dashboard: clicar quarentena → modal com conteúdo bloqueado | Task 8 + Task 9 |
| Modal: nome + data sempre visíveis, conteúdo borrado | Task 8 |
| Modal: custo acumulado, comparativo Pro | Task 8 |
| Modal: botão R$3 + botão pacote R$20 + Stripe Payment Element | Task 8 |
| Polling após pagamento até UNLOCKED | Task 8 |
| Banner de custo acumulado para FREE | Task 5 |
| Barra de progresso das 10 respostas gratuitas | Task 5 |
| Hint de upgrade quando custo >= R$40 | Task 5 |
| Vitest para paymentService | Task 1 |
| Stripe webhook com verificação de assinatura | Task 3 |

### Checklist de Segurança
- ✅ GET /forms/:id/responses filtra por `userId` — não retorna dados de outros usuários
- ✅ POST /payments/overage/intent valida que a resposta pertence a um form do userId
- ✅ Webhook verifica `stripe-signature` antes de processar qualquer evento
- ✅ `handlePaymentSucceeded` é idempotente — ignora pagamentos já PAID
- ✅ Status QUARANTINED/UNLOCKED só é determinado no backend — frontend nunca envia status
