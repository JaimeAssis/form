# Etapa 6 — Planos Pro/Agência, Templates e Notificações por E-mail

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar assinaturas Stripe Pro/Agência, seed dos 10 templates de nicho, tela de seleção de template, middleware de gate por plano, notificações de e-mail via Resend+BullMQ e personalização de marca no formulário público.

**Architecture:** O backend Fastify ganha rotas de subscription (checkout/portal) e handlers de webhook para `customer.subscription.*`; um `planGuard` middleware protege features Pro+. O seed idempotente popula a tabela `Template` com os 10 templates do framework. O frontend ganha a tela `/dashboard/upgrade`, a tela `/dashboard/forms/new` para seleção de template, e exibe logo/brandColor no formulário público quando disponíveis.

**Tech Stack:** Stripe SDK (já instalado), Resend SDK (novo), BullMQ + ioredis (novo), Next.js 14 App Router, Fastify 4, Prisma, Zod, TypeScript strict.

---

## Mapa de Arquivos

### Backend (`apps/api`)

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `src/services/subscriptionService.ts` | Criar | Criar Stripe Checkout Session, Customer Portal Session |
| `src/services/subscriptionService.test.ts` | Criar | Testes TDD do subscriptionService |
| `src/services/emailService.ts` | Criar | Enqueue de e-mail via BullMQ |
| `src/lib/queue.ts` | Criar | Instância BullMQ + worker de e-mail |
| `src/lib/resend.ts` | Criar | Cliente Resend configurado |
| `src/middleware/planGuard.ts` | Criar | Middleware que verifica plan do usuário |
| `src/routes/subscriptions.ts` | Criar | POST /payments/subscription/checkout, /portal, GET /payments/subscription |
| `src/routes/webhooks.ts` | Modificar | Adicionar handlers `customer.subscription.*` |
| `src/routes/public.ts` | Modificar | Enqueue email após salvar response UNLOCKED (Pro/Agency) |
| `src/routes/responses.ts` | Modificar | Aplicar planGuard em GET /forms/:id/responses/export |
| `src/index.ts` | Modificar | Registrar subscriptionRoutes |
| `prisma/seed.ts` | Modificar | Seed idempotente dos 10 templates |

### Frontend (`apps/web`)

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `src/app/(dashboard)/upgrade/page.tsx` | Criar | Tela de upgrade com cards dos 3 planos |
| `src/app/(dashboard)/forms/new/page.tsx` | Criar | Tela de seleção de template antes de criar formulário |
| `src/components/upgrade/PlanCard.tsx` | Criar | Card de plano reutilizável |
| `src/components/builder/BrandCustomizer.tsx` | Criar | Seção de personalização de marca no builder (Pro+) |
| `src/components/form-public/FormPublicClient.tsx` | Modificar | Aplicar brandColor e logoUrl quando disponíveis |
| `src/app/(dashboard)/forms/page.tsx` | Modificar | Botão "Novo formulário" redireciona para /forms/new |
| `src/app/(dashboard)/forms/[id]/edit/page.tsx` | Modificar | Incluir BrandCustomizer no builder |
| `src/lib/api.ts` | Modificar | Funções: createFormFromTemplate, getSubscription, createCheckout, createPortal, getTemplates |

---

## Task 1: subscriptionService — TDD (backend)

**Files:**
- Create: `apps/api/src/services/subscriptionService.ts`
- Create: `apps/api/src/services/subscriptionService.test.ts`

- [ ] **Step 1: Escrever os testes que falham**

```typescript
// apps/api/src/services/subscriptionService.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCreate = vi.fn()
const mockRetrieve = vi.fn()

vi.mock('../lib/stripe', () => ({
  stripe: {
    checkout: { sessions: { create: (...a: unknown[]) => mockCreate(...a) } },
    billingPortal: { sessions: { create: (...a: unknown[]) => mockCreate(...a) } },
    customers: { retrieve: (...a: unknown[]) => mockRetrieve(...a) },
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

beforeEach(() => vi.clearAllMocks())

describe('createCheckoutSession', () => {
  it('retorna url de checkout', async () => {
    mockCreate.mockResolvedValue({ url: 'https://checkout.stripe.com/pay/cs_test' })
    const result = await createCheckoutSession('user-1', 'price_pro_monthly', 'https://app.com')
    expect(result.url).toBe('https://checkout.stripe.com/pay/cs_test')
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'subscription' }),
    )
  })

  it('lança erro se url for null', async () => {
    mockCreate.mockResolvedValue({ url: null })
    await expect(
      createCheckoutSession('user-1', 'price_pro_monthly', 'https://app.com'),
    ).rejects.toThrow('Checkout URL not returned by Stripe')
  })
})

describe('createPortalSession', () => {
  it('retorna url do portal', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      stripeCustomerId: 'cus_123',
    } as any)
    mockCreate.mockResolvedValue({ url: 'https://billing.stripe.com/p/session_123' })
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
  it('atualiza plan para PRO quando status active e price_id_pro_monthly', async () => {
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
```

- [ ] **Step 2: Rodar testes para confirmar falha**

```bash
cd "apps/api" && npx vitest run src/services/subscriptionService.test.ts 2>&1 | tail -20
```
Esperado: `FAIL` — módulo não existe.

- [ ] **Step 3: Implementar subscriptionService**

```typescript
// apps/api/src/services/subscriptionService.ts
import { stripe } from '../lib/stripe'
import { prisma } from '../lib/prisma'

const PRICE_TO_PLAN: Record<string, 'PRO' | 'AGENCY'> = {
  price_pro_monthly: 'PRO',
  price_pro_annual: 'PRO',
  price_agency_monthly: 'AGENCY',
  price_agency_annual: 'AGENCY',
}

// Lê do env em runtime para que testes possam sobrescrever
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
```

- [ ] **Step 4: Rodar testes para confirmar passagem**

```bash
cd "apps/api" && npx vitest run src/services/subscriptionService.test.ts 2>&1 | tail -20
```
Esperado: `PASS` — 6 testes verdes.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/services/subscriptionService.ts apps/api/src/services/subscriptionService.test.ts
git commit -m "feat: subscriptionService — checkout, portal e handleSubscriptionChange TDD"
```

---

## Task 2: Rotas de subscription (backend)

**Files:**
- Create: `apps/api/src/routes/subscriptions.ts`
- Modify: `apps/api/src/index.ts`

- [ ] **Step 1: Criar arquivo de rotas**

```typescript
// apps/api/src/routes/subscriptions.ts
import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../middleware/auth'
import {
  createCheckoutSession,
  createPortalSession,
} from '../services/subscriptionService'
import { prisma } from '../lib/prisma'

const checkoutSchema = z.object({
  priceId: z.string().min(1),
})

export async function subscriptionRoutes(app: FastifyInstance) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  // POST /payments/subscription/checkout
  app.post(
    '/payments/subscription/checkout',
    { preHandler: authenticate },
    async (request, reply) => {
      const { priceId } = checkoutSchema.parse(request.body)
      const result = await createCheckoutSession(request.userId, priceId, appUrl)
      return reply.send(result)
    },
  )

  // POST /payments/subscription/portal
  app.post(
    '/payments/subscription/portal',
    { preHandler: authenticate },
    async (request, reply) => {
      try {
        const result = await createPortalSession(request.userId, appUrl)
        return reply.send(result)
      } catch (err: any) {
        return reply.status(400).send({ error: err.message })
      }
    },
  )

  // GET /payments/subscription
  app.get(
    '/payments/subscription',
    { preHandler: authenticate },
    async (request, reply) => {
      const user = await prisma.user.findUnique({
        where: { id: request.userId },
        select: { plan: true, stripeCustomerId: true },
      })
      return reply.send({ plan: user?.plan ?? 'FREE', hasCustomer: !!user?.stripeCustomerId })
    },
  )
}
```

- [ ] **Step 2: Registrar as rotas no index.ts**

Abrir `apps/api/src/index.ts` e adicionar import e registro. Procurar a linha onde `paymentRoutes` é registrado e adicionar logo abaixo:

```typescript
import { subscriptionRoutes } from './routes/subscriptions'
// ... dentro do app.register ou após paymentRoutes:
app.register(subscriptionRoutes)
```

- [ ] **Step 3: Type-check**

```bash
cd "apps/api" && npx tsc --noEmit 2>&1 | head -30
```
Esperado: sem erros.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/routes/subscriptions.ts apps/api/src/index.ts
git commit -m "feat: rotas de subscription — checkout, portal e GET plan"
```

---

## Task 3: Webhook handlers para subscription (backend)

**Files:**
- Modify: `apps/api/src/routes/webhooks.ts`

- [ ] **Step 1: Ler arquivo atual**

Verificar o handler existente em `apps/api/src/routes/webhooks.ts` (já lido — linha 36: só trata `payment_intent.succeeded`).

- [ ] **Step 2: Adicionar handlers de subscription**

Substituir o bloco `if (event.type === 'payment_intent.succeeded')` pelo bloco expandido:

```typescript
// No topo do arquivo, adicionar import:
import { handleSubscriptionChange } from '../services/subscriptionService'

// No handler do webhook, substituir o if existente:
if (event.type === 'payment_intent.succeeded') {
  const paymentIntent = event.data.object
  await handlePaymentSucceeded(paymentIntent.id)
}

if (
  event.type === 'customer.subscription.created' ||
  event.type === 'customer.subscription.updated' ||
  event.type === 'customer.subscription.deleted'
) {
  const subscription = event.data.object as {
    customer: string
    status: string
    items: { data: Array<{ price: { id: string } }> }
  }
  const customerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : (subscription.customer as any).id
  const priceId = subscription.items.data[0]?.price?.id ?? ''
  const status = subscription.status
  await handleSubscriptionChange(customerId, priceId, status)
}

if (event.type === 'checkout.session.completed') {
  const session = event.data.object as {
    customer: string | null
    metadata: { userId?: string }
  }
  if (session.customer && session.metadata?.userId) {
    await prisma.user.update({
      where: { id: session.metadata.userId },
      data: { stripeCustomerId: typeof session.customer === 'string' ? session.customer : (session.customer as any).id },
    })
  }
}
```

- [ ] **Step 3: Adicionar import do prisma no webhooks.ts**

```typescript
import { prisma } from '../lib/prisma'
```

- [ ] **Step 4: Type-check**

```bash
cd "apps/api" && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/webhooks.ts
git commit -m "feat: webhook handlers para subscription.created/updated/deleted e checkout.session.completed"
```

---

## Task 4: planGuard middleware e rota de exportação (backend)

**Files:**
- Create: `apps/api/src/middleware/planGuard.ts`
- Modify: `apps/api/src/routes/responses.ts`

- [ ] **Step 1: Criar planGuard**

```typescript
// apps/api/src/middleware/planGuard.ts
import { FastifyRequest, FastifyReply } from 'fastify'

type Plan = 'FREE' | 'PRO' | 'AGENCY'

export function planGuard(allowedPlans: Plan[]) {
  return async function (request: FastifyRequest, reply: FastifyReply) {
    const plan = request.userPlan as Plan
    if (!allowedPlans.includes(plan)) {
      return reply.status(403).send({
        error: 'PLAN_REQUIRED',
        requiredPlan: allowedPlans,
        currentPlan: plan,
      })
    }
  }
}
```

- [ ] **Step 2: Adicionar rota de exportação CSV em responses.ts**

Abrir `apps/api/src/routes/responses.ts` e adicionar no final, antes do fechamento do `export async function`:

```typescript
import { planGuard } from '../middleware/planGuard'

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

    const headers = ['Data', 'Respondente', ...form.questions.map(q => q.title)]
    const rows = form.responses.map(r => {
      const answerMap = new Map(r.answers.map(a => [a.questionId, a.value]))
      return [
        new Date(r.createdAt).toLocaleString('pt-BR'),
        r.respondentName ?? 'Anônimo',
        ...form.questions.map(q => {
          const val = answerMap.get(q.id) ?? ''
          try {
            const parsed = JSON.parse(val)
            if (Array.isArray(parsed)) return parsed.join('; ')
          } catch { /* não é JSON */ }
          return val
        }),
      ]
    })

    const csvLines = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\r\n')

    // UTF-8 BOM para Excel brasileiro
    const bom = '\uFEFF'
    const date = new Date().toISOString().slice(0, 10)
    reply.header('Content-Type', 'text/csv; charset=utf-8')
    reply.header('Content-Disposition', `attachment; filename="respostas-${form.title.slice(0, 30)}-${date}.csv"`)
    return reply.send(bom + csvLines)
  },
)
```

- [ ] **Step 3: Type-check**

```bash
cd "apps/api" && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/middleware/planGuard.ts apps/api/src/routes/responses.ts
git commit -m "feat: planGuard middleware e exportação CSV Pro/Agência"
```

---

## Task 5: Resend + BullMQ — fila de e-mail de nova resposta (backend)

**Files:**
- Create: `apps/api/src/lib/resend.ts`
- Create: `apps/api/src/lib/queue.ts`
- Create: `apps/api/src/services/emailService.ts`
- Modify: `apps/api/src/routes/public.ts`
- Modify: `apps/api/package.json`

- [ ] **Step 1: Instalar dependências**

```bash
cd "apps/api" && npm install resend bullmq ioredis
```
Esperado: adicionados `resend`, `bullmq`, `ioredis` em `dependencies`.

- [ ] **Step 2: Criar cliente Resend**

```typescript
// apps/api/src/lib/resend.ts
import { Resend } from 'resend'

if (!process.env.RESEND_API_KEY) {
  throw new Error('RESEND_API_KEY não configurado')
}

export const resend = new Resend(process.env.RESEND_API_KEY)
```

- [ ] **Step 3: Criar fila BullMQ**

```typescript
// apps/api/src/lib/queue.ts
import { Queue, Worker } from 'bullmq'
import IORedis from 'ioredis'
import { resend } from './resend'

const connection = new IORedis(process.env.UPSTASH_REDIS_REST_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
})

export const emailQueue = new Queue('email-notifications', { connection })

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
          <a href="${appUrl}/dashboard/forms/${formId}/responses/${responseId}"
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
```

- [ ] **Step 4: Criar emailService**

```typescript
// apps/api/src/services/emailService.ts
import { emailQueue } from '../lib/queue'

export async function enqueueNewResponseEmail(data: {
  to: string
  formTitle: string
  respondentName?: string | null
  formId: string
  responseId: string
  appUrl: string
}): Promise<void> {
  await emailQueue.add('new-response', data, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
  })
}
```

- [ ] **Step 5: Disparar e-mail após submit em public.ts**

Em `apps/api/src/routes/public.ts`, logo após `await saveResponse(...)` e antes do `return reply.status(200)`, adicionar:

```typescript
// Importar no topo do arquivo:
import { enqueueNewResponseEmail } from '../services/emailService'

// Após saveResponse, antes do return:
if (form.user.plan === 'PRO' || form.user.plan === 'AGENCY') {
  const ownerUser = await prisma.user.findUnique({
    where: { id: form.userId },
    select: { email: true },
  })
  if (ownerUser?.email) {
    // Não aguardar — retorna 200 imediatamente
    enqueueNewResponseEmail({
      to: ownerUser.email,
      formTitle: form.title,
      respondentName: body.respondentName,
      formId: form.id,
      responseId: 'pending', // será atualizado em próxima melhoria — suficiente para MVP
      appUrl: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
    }).catch((err) => {
      // Falha silenciosa — não bloqueia a resposta do respondente
      console.error('[emailQueue] falha ao enfileirar e-mail:', err)
    })
  }
}
```

> **Nota:** Para obter o responseId real, a função `saveResponse` precisaria retornar o id criado. Como não retorna atualmente, vamos corrigir isso em seguida.

- [ ] **Step 6: Fazer saveResponse retornar o id da Response criada**

Abrir `apps/api/src/services/responseService.ts` e alterar o retorno da função para incluir `{ id }`:

```typescript
// Localizar a linha final de saveResponse — algo como:
// await prisma.response.create({ ... })
// Alterar para:
const saved = await prisma.response.create({ ... })
return { id: saved.id, status: saved.status }
```

- [ ] **Step 7: Atualizar public.ts para usar o responseId retornado**

```typescript
const { id: savedResponseId } = await saveResponse({ ... })

if (form.user.plan === 'PRO' || form.user.plan === 'AGENCY') {
  // ... código existente com responseId: savedResponseId
  enqueueNewResponseEmail({
    // ...
    responseId: savedResponseId,
  }).catch(...)
}
```

- [ ] **Step 8: Type-check**

```bash
cd "apps/api" && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/lib/resend.ts apps/api/src/lib/queue.ts apps/api/src/services/emailService.ts apps/api/src/routes/public.ts apps/api/src/services/responseService.ts
git commit -m "feat: fila BullMQ + Resend para e-mail de nova resposta (Pro/Agência)"
```

---

## Task 6: Seed dos 10 templates (backend)

**Files:**
- Modify: `apps/api/prisma/seed.ts`

- [ ] **Step 1: Substituir seed.ts pelo seed completo**

```typescript
// apps/api/prisma/seed.ts
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

type TemplateQuestion = {
  order: number
  type: string
  title: string
  description?: string
  required: boolean
  options: string[]
  scaleMin?: string
  scaleMax?: string
  conditionOnPrevIndex?: number   // índice base-0 da pergunta gatilho
  conditionValue?: string
}

const templates: Array<{
  niche: string
  title: string
  description: string
  order: number
  questions: TemplateQuestion[]
}> = [
  {
    niche: 'influencer',
    title: 'Briefing de parceria publicitária',
    description: 'Para creators que recebem propostas de marcas e precisam coletar informações antes de aceitar ou dar um orçamento.',
    order: 1,
    questions: [
      { order: 1, type: 'SHORT_TEXT', title: 'Qual é o nome da sua marca/empresa?', required: true, options: [] },
      { order: 2, type: 'MULTIPLE_CHOICE', title: 'Como você conheceu meu trabalho?', required: false, options: ['Instagram', 'YouTube', 'Indicação de outro creator', 'Busca no Google', 'Agência de influência', 'Outro'] },
      { order: 3, type: 'SHORT_TEXT', title: 'Qual produto ou serviço deseja divulgar?', required: true, options: [] },
      { order: 4, type: 'MULTIPLE_SELECT', title: 'Qual formato de conteúdo você tem interesse?', required: true, options: ['Reels/TikTok', 'Story', 'Feed (foto/carrossel)', 'YouTube (vídeo longo)', 'YouTube Shorts', 'Blog/newsletter'] },
      { order: 5, type: 'MULTIPLE_SELECT', title: 'Para qual plataforma é o conteúdo?', required: true, options: ['Instagram', 'TikTok', 'YouTube', 'LinkedIn', 'Twitter/X', 'Mais de uma plataforma'] },
      { order: 6, type: 'LONG_TEXT', title: 'Qual é a mensagem principal que deve ser comunicada?', required: true, options: [] },
      { order: 7, type: 'MULTIPLE_CHOICE', title: 'Você tem alguma restrição de conteúdo ou concorrente exclusivo?', required: true, options: ['Sim', 'Não'] },
      { order: 8, type: 'LONG_TEXT', title: 'Descreva a restrição', required: true, options: [], conditionOnPrevIndex: 6, conditionValue: 'Sim' },
      { order: 9, type: 'SHORT_TEXT', title: 'Qual é o prazo de entrega desejado?', required: true, options: [] },
      { order: 10, type: 'MULTIPLE_CHOICE', title: 'Qual é o orçamento previsto para essa ação?', required: false, options: ['Até R$ 500', 'R$ 500–2.000', 'R$ 2.000–5.000', 'R$ 5.000–10.000', 'Acima de R$ 10.000', 'Prefiro negociar'] },
    ],
  },
  {
    niche: 'lawyer',
    title: 'Formulário de pré-atendimento jurídico',
    description: 'Para advogados que querem chegar à primeira consulta já com o contexto do caso — sem perder tempo coletando dados básicos.',
    order: 2,
    questions: [
      { order: 1, type: 'SHORT_TEXT', title: 'Qual é o seu nome completo?', required: true, options: [] },
      { order: 2, type: 'MULTIPLE_CHOICE', title: 'Qual área jurídica melhor descreve sua necessidade?', required: true, options: ['Trabalhista', 'Família e divórcio', 'Cível/contratos', 'Criminal', 'Imobiliário', 'Empresarial', 'Previdenciário', 'Outro'] },
      { order: 3, type: 'LONG_TEXT', title: 'Descreva brevemente a situação', required: true, options: [] },
      { order: 4, type: 'MULTIPLE_CHOICE', title: 'Já existe algum processo judicial em andamento?', required: true, options: ['Sim', 'Não', 'Não sei'] },
      { order: 5, type: 'SHORT_TEXT', title: 'Qual é o número do processo?', required: false, options: [], conditionOnPrevIndex: 3, conditionValue: 'Sim' },
      { order: 6, type: 'MULTIPLE_CHOICE', title: 'Há algum prazo urgente envolvido?', required: true, options: ['Sim — há uma data limite próxima', 'Não'] },
      { order: 7, type: 'SHORT_TEXT', title: 'Qual é o prazo?', required: true, options: [], conditionOnPrevIndex: 5, conditionValue: 'Sim — há uma data limite próxima' },
      { order: 8, type: 'MULTIPLE_CHOICE', title: 'Já teve advogado anterior nesse caso?', required: false, options: ['Sim', 'Não'] },
      { order: 9, type: 'MULTIPLE_CHOICE', title: 'Como prefere ser atendido?', required: true, options: ['Presencial', 'Online (videochamada)', 'Indiferente'] },
      { order: 10, type: 'SHORT_TEXT', title: 'Qual a sua disponibilidade para uma consulta inicial?', required: true, options: [] },
    ],
  },
  {
    niche: 'events',
    title: 'Briefing de evento',
    description: 'Para produtores que precisam coletar todas as informações antes de montar uma proposta — sem calls longas de levantamento.',
    order: 3,
    questions: [
      { order: 1, type: 'MULTIPLE_CHOICE', title: 'Qual é o tipo de evento?', required: true, options: ['Casamento', 'Aniversário', 'Corporativo/empresa', 'Formatura', 'Confraternização', 'Outro'] },
      { order: 2, type: 'SHORT_TEXT', title: 'Qual é a data prevista?', required: true, options: [] },
      { order: 3, type: 'MULTIPLE_CHOICE', title: 'A data é flexível?', required: true, options: ['Sim', 'Não — é uma data fixa'] },
      { order: 4, type: 'SHORT_TEXT', title: 'Qual cidade e local (se já tiver)?', required: true, options: [] },
      { order: 5, type: 'MULTIPLE_CHOICE', title: 'Número estimado de convidados', required: true, options: ['Até 50', '50–100', '100–200', '200–500', 'Acima de 500'] },
      { order: 6, type: 'LONG_TEXT', title: 'Qual é o perfil dos convidados?', required: false, options: [] },
      { order: 7, type: 'MULTIPLE_CHOICE', title: 'Qual é o orçamento total disponível?', required: true, options: ['Até R$ 5.000', 'R$ 5.000–15.000', 'R$ 15.000–30.000', 'R$ 30.000–80.000', 'Acima de R$ 80.000'] },
      { order: 8, type: 'MULTIPLE_SELECT', title: 'Quais serviços você precisa?', required: true, options: ['Buffet/catering', 'Decoração', 'Fotografia/vídeo', 'Som e iluminação', 'Animação/DJ', 'Convites', 'Segurança', 'Tudo incluso'] },
      { order: 9, type: 'MULTIPLE_CHOICE', title: 'Há alguma restrição alimentar ou acessibilidade a considerar?', required: true, options: ['Sim', 'Não'] },
      { order: 10, type: 'LONG_TEXT', title: 'Descreva as restrições', required: true, options: [], conditionOnPrevIndex: 8, conditionValue: 'Sim' },
      { order: 11, type: 'LONG_TEXT', title: 'Qual é o estilo/tema desejado?', required: false, options: [] },
      { order: 12, type: 'LONG_TEXT', title: 'Tem referências visuais (links ou descrição)?', required: false, options: [] },
    ],
  },
  {
    niche: 'marketing-agency',
    title: 'Onboarding de novo cliente',
    description: 'Para agências e gestores que precisam coletar tudo sobre marca, produto e objetivo antes de começar a gestão.',
    order: 4,
    questions: [
      { order: 1, type: 'SHORT_TEXT', title: 'Nome da empresa e segmento de atuação', required: true, options: [] },
      { order: 2, type: 'LONG_TEXT', title: 'Qual é o principal produto ou serviço que vamos divulgar?', required: true, options: [] },
      { order: 3, type: 'LONG_TEXT', title: 'Qual é o público-alvo principal?', required: true, options: [] },
      { order: 4, type: 'MULTIPLE_CHOICE', title: 'Qual é o principal objetivo da campanha?', required: true, options: ['Gerar leads', 'Aumentar vendas diretas', 'Reconhecimento de marca', 'Tráfego para site/loja', 'Retenção de clientes'] },
      { order: 5, type: 'MULTIPLE_SELECT', title: 'Quais canais serão trabalhados?', required: true, options: ['Instagram', 'Facebook', 'Google Ads', 'YouTube', 'TikTok', 'LinkedIn', 'Email marketing', 'WhatsApp'] },
      { order: 6, type: 'MULTIPLE_CHOICE', title: 'Qual é a verba mensal disponível para mídia paga?', required: true, options: ['Até R$ 1.000', 'R$ 1.000–3.000', 'R$ 3.000–8.000', 'R$ 8.000–20.000', 'Acima de R$ 20.000'] },
      { order: 7, type: 'MULTIPLE_CHOICE', title: 'Já tem campanhas rodando atualmente?', required: true, options: ['Sim', 'Não'] },
      { order: 8, type: 'LONG_TEXT', title: 'Qual plataforma e qual o resultado atual?', required: true, options: [], conditionOnPrevIndex: 6, conditionValue: 'Sim' },
      { order: 9, type: 'LONG_TEXT', title: 'Quais são os principais concorrentes?', required: false, options: [] },
      { order: 10, type: 'MULTIPLE_SELECT', title: 'Qual é o tom de voz da marca?', required: true, options: ['Formal e corporativo', 'Descontraído e próximo', 'Inspirador', 'Técnico e especialista', 'Irreverente/jovem'] },
      { order: 11, type: 'MULTIPLE_CHOICE', title: 'Tem identidade visual definida (logo, manual)?', required: true, options: ['Sim — tenho manual de marca', 'Sim — tenho logo mas sem manual', 'Não — precisamos criar'] },
      { order: 12, type: 'LONG_TEXT', title: 'Qual é a meta principal em 3 meses?', required: true, options: [] },
    ],
  },
  {
    niche: 'architect',
    title: 'Briefing de projeto de interiores',
    description: 'Para arquitetos e decoradores que querem chegar na visita técnica já com direção estética e funcional clara.',
    order: 5,
    questions: [
      { order: 1, type: 'MULTIPLE_CHOICE', title: 'Qual é o tipo de projeto?', required: true, options: ['Apartamento residencial', 'Casa residencial', 'Escritório comercial', 'Estabelecimento comercial', 'Reforma parcial'] },
      { order: 2, type: 'MULTIPLE_CHOICE', title: 'Qual é a metragem aproximada do espaço?', required: true, options: ['Até 50m²', '50–100m²', '100–200m²', 'Acima de 200m²'] },
      { order: 3, type: 'MULTIPLE_SELECT', title: 'Quais ambientes serão contemplados?', required: true, options: ['Sala de estar', 'Sala de jantar', 'Cozinha', 'Quarto principal', 'Quartos de filhos', 'Banheiros', 'Varanda', 'Escritório/home office', 'Área de serviço', 'Área externa'] },
      { order: 4, type: 'MULTIPLE_CHOICE', title: 'Quantas pessoas moram/trabalham no espaço?', required: true, options: ['1 pessoa', '2 pessoas', '3–4 pessoas', '5 ou mais'] },
      { order: 5, type: 'MULTIPLE_CHOICE', title: 'Há animais de estimação?', required: false, options: ['Sim', 'Não'] },
      { order: 6, type: 'MULTIPLE_SELECT', title: 'Qual é o estilo de decoração desejado?', required: true, options: ['Moderno/minimalista', 'Clássico/tradicional', 'Rústico/industrial', 'Escandinavo', 'Contemporâneo', 'Tropical/natural', 'Ainda não sei'] },
      { order: 7, type: 'LONG_TEXT', title: 'Tem referências visuais? (links Pinterest, Houzz ou Instagram)', required: false, options: [] },
      { order: 8, type: 'MULTIPLE_CHOICE', title: 'Qual é o orçamento disponível para o projeto?', required: true, options: ['Até R$ 20.000', 'R$ 20.000–50.000', 'R$ 50.000–100.000', 'R$ 100.000–300.000', 'Acima de R$ 300.000'] },
      { order: 9, type: 'MULTIPLE_CHOICE', title: 'Qual é o prazo desejado para conclusão?', required: true, options: ['Até 2 meses', '3–6 meses', '6–12 meses', 'Mais de 1 ano', 'Flexível'] },
      { order: 10, type: 'MULTIPLE_CHOICE', title: 'Há alguma necessidade de acessibilidade?', required: false, options: ['Sim', 'Não'] },
      { order: 11, type: 'LONG_TEXT', title: 'O que é mais importante para você nesse projeto?', required: true, options: [] },
    ],
  },
  {
    niche: 'nutritionist',
    title: 'Anamnese nutricional',
    description: 'Formulário de pré-consulta para coletar histórico alimentar, objetivos e saúde do paciente antes do primeiro atendimento.',
    order: 6,
    questions: [
      { order: 1, type: 'MULTIPLE_CHOICE', title: 'Qual é o seu principal objetivo?', required: true, options: ['Emagrecimento', 'Ganho de massa muscular', 'Saúde geral e bem-estar', 'Tratar condição específica', 'Reeducação alimentar', 'Performance esportiva'] },
      { order: 2, type: 'MULTIPLE_SELECT', title: 'Você tem alguma condição de saúde diagnosticada?', required: true, options: ['Diabetes', 'Hipertensão', 'Colesterol elevado', 'Hipotireoidismo/hipertireoidismo', 'Síndrome do intestino irritável', 'Doença renal', 'Nenhuma', 'Outra'] },
      { order: 3, type: 'LONG_TEXT', title: 'Descreva sua condição', required: true, options: [] },
      { order: 4, type: 'MULTIPLE_CHOICE', title: 'Você usa algum medicamento de uso contínuo?', required: true, options: ['Sim', 'Não'] },
      { order: 5, type: 'SHORT_TEXT', title: 'Qual(is)?', required: true, options: [], conditionOnPrevIndex: 3, conditionValue: 'Sim' },
      { order: 6, type: 'MULTIPLE_CHOICE', title: 'Tem alguma alergia ou intolerância alimentar?', required: true, options: ['Sim', 'Não'] },
      { order: 7, type: 'SHORT_TEXT', title: 'Qual(is)?', required: true, options: [], conditionOnPrevIndex: 5, conditionValue: 'Sim' },
      { order: 8, type: 'SCALE', title: 'Como você descreveria sua alimentação atual?', required: true, options: [], scaleMin: 'Muito ruim', scaleMax: 'Muito boa' },
      { order: 9, type: 'MULTIPLE_CHOICE', title: 'Quantas refeições faz por dia em média?', required: true, options: ['1–2', '3', '4', '5 ou mais'] },
      { order: 10, type: 'MULTIPLE_CHOICE', title: 'Pratica atividade física?', required: true, options: ['Sim', 'Não'] },
      { order: 11, type: 'SHORT_TEXT', title: 'Qual atividade, frequência e duração?', required: true, options: [], conditionOnPrevIndex: 9, conditionValue: 'Sim' },
      { order: 12, type: 'MULTIPLE_CHOICE', title: 'Qual é a sua disponibilidade de tempo para cozinhar?', required: true, options: ['Menos de 30 min por dia', '30–60 min por dia', 'Mais de 1 hora por dia', 'Prefiro refeições prontas'] },
    ],
  },
  {
    niche: 'personal-trainer',
    title: 'Anamnese de treino',
    description: 'Para personal trainers que querem montar o treino antes da primeira sessão — já com objetivos, histórico e limitações do aluno.',
    order: 7,
    questions: [
      { order: 1, type: 'MULTIPLE_CHOICE', title: 'Qual é o seu principal objetivo com o treino?', required: true, options: ['Emagrecimento', 'Ganho de massa', 'Condicionamento físico', 'Saúde e qualidade de vida', 'Performance esportiva', 'Reabilitação'] },
      { order: 2, type: 'SCALE', title: 'Qual é o seu nível de condicionamento atual?', required: true, options: [], scaleMin: 'Sedentário', scaleMax: 'Atleta' },
      { order: 3, type: 'MULTIPLE_CHOICE', title: 'Já treinou com personal anteriormente?', required: false, options: ['Sim', 'Não'] },
      { order: 4, type: 'MULTIPLE_CHOICE', title: 'Tem alguma lesão ou limitação física?', required: true, options: ['Sim', 'Não'] },
      { order: 5, type: 'LONG_TEXT', title: 'Descreva a lesão ou limitação', required: true, options: [], conditionOnPrevIndex: 3, conditionValue: 'Sim' },
      { order: 6, type: 'MULTIPLE_CHOICE', title: 'Quantos dias por semana pode treinar?', required: true, options: ['2x', '3x', '4x', '5x', '6x'] },
      { order: 7, type: 'MULTIPLE_CHOICE', title: 'Qual a duração ideal de cada treino?', required: true, options: ['30 min', '45 min', '1 hora', 'Mais de 1 hora'] },
      { order: 8, type: 'MULTIPLE_CHOICE', title: 'Onde vai treinar?', required: true, options: ['Academia', 'Em casa', 'Ao ar livre', 'Misto'] },
      { order: 9, type: 'MULTIPLE_SELECT', title: 'Quais equipamentos tem disponíveis?', required: false, options: ['Halteres', 'Barras', 'Elásticos', 'Colchonete', 'Bicicleta ergométrica', 'Esteira', 'Sem equipamento'], conditionOnPrevIndex: 7, conditionValue: 'Em casa' },
      { order: 10, type: 'SHORT_TEXT', title: 'Tem alguma restrição alimentar relevante para o treino?', required: false, options: [] },
    ],
  },
  {
    niche: 'video-editor',
    title: 'Briefing de edição de vídeo',
    description: 'Para editores que precisam de todas as informações antes de iniciar o projeto — plataforma, estilo, referências e entregas.',
    order: 8,
    questions: [
      { order: 1, type: 'MULTIPLE_SELECT', title: 'Para qual plataforma são os vídeos?', required: true, options: ['YouTube', 'Instagram Reels', 'TikTok', 'YouTube Shorts', 'LinkedIn', 'Mais de uma plataforma'] },
      { order: 2, type: 'MULTIPLE_CHOICE', title: 'Qual é o estilo de edição desejado?', required: true, options: ['Dinâmico com muitos cortes', 'Limpo e minimalista', 'Cinematográfico', 'Educativo/explicativo', 'Vlog/natural', 'Outro'] },
      { order: 3, type: 'LONG_TEXT', title: 'Tem referências de canais ou vídeos que gosta?', required: false, options: [] },
      { order: 4, type: 'MULTIPLE_CHOICE', title: 'Qual é a duração média de cada vídeo?', required: true, options: ['Menos de 1 min (shorts)', '1–5 min', '5–15 min', '15–30 min', 'Acima de 30 min'] },
      { order: 5, type: 'MULTIPLE_CHOICE', title: 'Quantos vídeos por mês?', required: true, options: ['1–2', '3–5', '6–10', 'Acima de 10', 'Sob demanda'] },
      { order: 6, type: 'MULTIPLE_CHOICE', title: 'Você fornece o roteiro/script?', required: true, options: ['Sim', 'Não — preciso de ajuda com roteiro também'] },
      { order: 7, type: 'MULTIPLE_CHOICE', title: 'Você fornece as imagens e gravações brutas?', required: true, options: ['Sim', 'Não — preciso de captação também'] },
      { order: 8, type: 'MULTIPLE_CHOICE', title: 'Precisa de legenda?', required: true, options: ['Sim', 'Não'] },
      { order: 9, type: 'MULTIPLE_CHOICE', title: 'Qual idioma?', required: true, options: ['Português', 'Inglês', 'Espanhol', 'Mais de um idioma'], conditionOnPrevIndex: 7, conditionValue: 'Sim' },
      { order: 10, type: 'MULTIPLE_CHOICE', title: 'Tem identidade visual (cores, fontes, logo)?', required: true, options: ['Sim', 'Não — precisamos criar'] },
      { order: 11, type: 'MULTIPLE_CHOICE', title: 'Qual é o prazo de entrega esperado por vídeo?', required: true, options: ['24 horas', '2–3 dias', '1 semana', 'Combinamos caso a caso'] },
      { order: 12, type: 'SHORT_TEXT', title: 'Tem alguma música ou estilo de trilha preferido?', required: false, options: [] },
    ],
  },
  {
    niche: 'designer',
    title: 'Briefing de design',
    description: 'Para designers que precisam de direção visual clara antes de criar — referências, estilo, objetivo e entregas.',
    order: 9,
    questions: [
      { order: 1, type: 'MULTIPLE_CHOICE', title: 'Qual é o tipo de projeto?', required: true, options: ['Posts para redes sociais', 'Identidade visual completa', 'Logo', 'Apresentação', 'Flyer/cartaz', 'Banner digital', 'Embalagem', 'Outro'] },
      { order: 2, type: 'MULTIPLE_CHOICE', title: 'Qual é o objetivo principal da peça?', required: true, options: ['Vender um produto/serviço', 'Informar/educar', 'Engajamento nas redes', 'Reconhecimento de marca', 'Evento/promoção'] },
      { order: 3, type: 'MULTIPLE_CHOICE', title: 'Você já tem identidade visual (logo, cores, fontes)?', required: true, options: ['Sim', 'Não — precisamos criar junto'] },
      { order: 4, type: 'LONG_TEXT', title: 'Descreva ou envie link da identidade visual', required: true, options: [], conditionOnPrevIndex: 2, conditionValue: 'Sim' },
      { order: 5, type: 'MULTIPLE_SELECT', title: 'Qual é o estilo visual desejado?', required: true, options: ['Moderno/minimalista', 'Colorido/vibrante', 'Elegante/sofisticado', 'Divertido/descontraído', 'Corporativo/sério', 'Ainda não sei'] },
      { order: 6, type: 'LONG_TEXT', title: 'Tem referências visuais? (links ou descrição)', required: false, options: [] },
      { order: 7, type: 'SHORT_TEXT', title: 'Quem é o público-alvo da peça?', required: true, options: [] },
      { order: 8, type: 'LONG_TEXT', title: 'Qual é o texto/copy que deve aparecer na peça?', required: false, options: [] },
      { order: 9, type: 'MULTIPLE_SELECT', title: 'Para qual formato/tamanho precisa?', required: true, options: ['Feed Instagram (1080×1080)', 'Stories/Reels (1080×1920)', 'Post LinkedIn', 'Banner site', 'Múltiplos formatos'] },
      { order: 10, type: 'MULTIPLE_SELECT', title: 'Precisa do arquivo em qual formato final?', required: true, options: ['PNG', 'JPG', 'PDF', 'AI/EPS (editável)', 'Todos os formatos'] },
      { order: 11, type: 'SHORT_TEXT', title: 'Qual é o prazo de entrega?', required: true, options: [] },
    ],
  },
  {
    niche: 'photographer',
    title: 'Briefing de ensaio fotográfico',
    description: 'Para fotógrafos que precisam alinhar expectativas de estilo, locação e entrega antes do dia do ensaio.',
    order: 10,
    questions: [
      { order: 1, type: 'MULTIPLE_CHOICE', title: 'Qual é o tipo de ensaio?', required: true, options: ['Ensaio individual', 'Casal', 'Família', 'Gestante', 'Newborn', 'Corporativo/headshot', 'Produto', 'Evento'] },
      { order: 2, type: 'SHORT_TEXT', title: 'Qual é a data desejada?', required: true, options: [] },
      { order: 3, type: 'MULTIPLE_CHOICE', title: 'Qual é a locação preferida?', required: true, options: ['Estúdio', 'Ambiente externo (parque, praia, rua)', 'Local específico', 'Sem preferência'] },
      { order: 4, type: 'SHORT_TEXT', title: 'Descreva o local ou endereço', required: true, options: [], conditionOnPrevIndex: 2, conditionValue: 'Local específico' },
      { order: 5, type: 'MULTIPLE_CHOICE', title: 'Quantas pessoas serão fotografadas?', required: true, options: ['1 pessoa', '2 pessoas', '3–5 pessoas', '6 ou mais'] },
      { order: 6, type: 'MULTIPLE_CHOICE', title: 'Quantos looks/trocas de roupa?', required: true, options: ['1 look', '2 looks', '3 looks', '4 ou mais'] },
      { order: 7, type: 'MULTIPLE_SELECT', title: 'Qual é o estilo fotográfico desejado?', required: true, options: ['Natural e espontâneo', 'Editorial/fashion', 'Claro e clean', 'Escuro e dramático', 'Vintage/retrô', 'Colorido e vibrante'] },
      { order: 8, type: 'LONG_TEXT', title: 'Tem referências? (links ou perfis do Instagram)', required: false, options: [] },
      { order: 9, type: 'MULTIPLE_SELECT', title: 'Para qual finalidade serão usadas as fotos?', required: true, options: ['Redes sociais', 'Impressão', 'Uso pessoal/memória', 'Site/portfólio profissional', 'Uso comercial'] },
      { order: 10, type: 'MULTIPLE_CHOICE', title: 'Quantas fotos editadas você precisa?', required: true, options: ['Até 20 fotos', '20–50 fotos', '50–100 fotos', 'Acima de 100 fotos'] },
      { order: 11, type: 'MULTIPLE_CHOICE', title: 'Tem alguma preferência de horário?', required: false, options: ['Manhã (golden hour)', 'Meio do dia', 'Final de tarde (pôr do sol)', 'Sem preferência'] },
    ],
  },
]

async function main() {
  console.log('🌱 Iniciando seed de templates...')

  for (const tpl of templates) {
    const existing = await prisma.template.findFirst({ where: { niche: tpl.niche } })
    if (existing) {
      console.log(`  ⏭  Template "${tpl.title}" já existe — pulando`)
      continue
    }

    // Montar questões com lógica condicional embutida
    const questionsJson = tpl.questions.map((q, idx) => {
      const result: Record<string, unknown> = {
        order: q.order,
        type: q.type,
        title: q.title,
        description: q.description ?? null,
        required: q.required,
        options: q.options,
        scaleMin: q.scaleMin ?? null,
        scaleMax: q.scaleMax ?? null,
        condition: null as null | { triggerQuestionIndex: number; triggerValue: string },
      }
      if (q.conditionOnPrevIndex !== undefined && q.conditionValue !== undefined) {
        result.condition = {
          triggerQuestionIndex: q.conditionOnPrevIndex,
          triggerValue: q.conditionValue,
        }
      }
      return result
    })

    await prisma.template.create({
      data: {
        niche: tpl.niche,
        title: tpl.title,
        description: tpl.description,
        order: tpl.order,
        questions: questionsJson,
        active: true,
      },
    })
    console.log(`  ✅ Template "${tpl.title}" criado`)
  }

  console.log('✅ Seed concluído!')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
```

- [ ] **Step 2: Rodar o seed**

```bash
cd "apps/api" && npm run db:seed 2>&1
```
Esperado: 10 linhas `✅ Template "..." criado` sem erros.

- [ ] **Step 3: Verificar idempotência**

```bash
cd "apps/api" && npm run db:seed 2>&1
```
Esperado: 10 linhas `⏭  Template "..." já existe — pulando`.

- [ ] **Step 4: Commit**

```bash
git add apps/api/prisma/seed.ts
git commit -m "feat: seed idempotente com os 10 templates de nicho"
```

---

## Task 7: Rota POST /forms com suporte a templateId (backend)

**Files:**
- Modify: `apps/api/src/routes/forms.ts`

- [ ] **Step 1: Atualizar createFormSchema e handler POST /forms**

Localizar em `apps/api/src/routes/forms.ts` o `createFormSchema` e o handler `POST /forms`:

```typescript
// Substituir createFormSchema:
const createFormSchema = z.object({
  title: z.string().min(1).max(200).optional().default('Sem título'),
  templateId: z.string().uuid().optional(),
})

// Substituir handler POST /forms completo:
app.post('/forms', { preHandler: authenticate }, async (request, reply) => {
  const body = createFormSchema.parse(request.body)
  const slug = await generateUniqueSlug(body.title)

  if (body.templateId) {
    const template = await prisma.template.findUnique({ where: { id: body.templateId } })
    if (!template) return reply.status(404).send({ error: 'Template não encontrado' })

    const form = await prisma.form.create({
      data: {
        userId: request.userId,
        title: template.title,
        slug,
      },
    })

    // Copiar questions do template, gerando novos IDs
    const questionsRaw = template.questions as Array<{
      order: number
      type: string
      title: string
      description: string | null
      required: boolean
      options: string[]
      scaleMin: string | null
      scaleMax: string | null
      condition: { triggerQuestionIndex: number; triggerValue: string } | null
    }>

    // Criar questions sem condition primeiro
    const createdIds: string[] = []
    for (const q of questionsRaw) {
      const created = await prisma.question.create({
        data: {
          formId: form.id,
          order: q.order,
          type: q.type as any,
          title: q.title,
          description: q.description,
          required: q.required,
          options: q.options,
          scaleMin: q.scaleMin,
          scaleMax: q.scaleMax,
        },
      })
      createdIds.push(created.id)
    }

    // Criar conditions com os IDs reais
    for (let i = 0; i < questionsRaw.length; i++) {
      const q = questionsRaw[i]
      if (q.condition) {
        const triggerQId = createdIds[q.condition.triggerQuestionIndex]
        if (triggerQId) {
          await prisma.condition.create({
            data: {
              questionId: createdIds[i],
              triggerQuestionId: triggerQId,
              triggerValue: q.condition.triggerValue,
            },
          })
        }
      }
    }

    const fullForm = await prisma.form.findUnique({
      where: { id: form.id },
      include: { questions: { include: { condition: true }, orderBy: { order: 'asc' } } },
    })
    return reply.status(201).send(fullForm)
  }

  // Criar formulário vazio (comportamento original)
  const form = await prisma.form.create({
    data: { userId: request.userId, title: body.title, slug },
    include: { questions: { include: { condition: true }, orderBy: { order: 'asc' } } },
  })
  return reply.status(201).send(form)
})
```

- [ ] **Step 2: Type-check**

```bash
cd "apps/api" && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 3: Adicionar rota GET /templates**

Adicionar no final do arquivo `apps/api/src/routes/forms.ts`, antes do fechamento do `export async function formRoutes`:

```typescript
// GET /templates — lista templates ativos
app.get('/templates', { preHandler: authenticate }, async (_request, reply) => {
  const templates = await prisma.template.findMany({
    where: { active: true },
    orderBy: { order: 'asc' },
    select: { id: true, niche: true, title: true, description: true, order: true },
  })
  return reply.send(templates)
})
```

- [ ] **Step 4: Type-check novamente**

```bash
cd "apps/api" && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/forms.ts
git commit -m "feat: POST /forms suporta templateId e GET /templates lista templates ativos"
```

---

## Task 8: Frontend — funções de API para subscription e templates (web)

**Files:**
- Modify: `apps/web/src/lib/api.ts`

- [ ] **Step 1: Adicionar funções no final de api.ts**

```typescript
// ─── Templates ────────────────────────────────────────────────────────────────

export interface TemplateSummary {
  id: string
  niche: string
  title: string
  description: string
  order: number
}

export async function getTemplates(): Promise<TemplateSummary[]> {
  return apiFetch<TemplateSummary[]>('/templates')
}

export async function createFormFromTemplate(templateId: string): Promise<Form> {
  return apiFetch<Form>('/forms', {
    method: 'POST',
    body: JSON.stringify({ templateId }),
  })
}

// ─── Subscription ─────────────────────────────────────────────────────────────

export interface SubscriptionInfo {
  plan: 'FREE' | 'PRO' | 'AGENCY'
  hasCustomer: boolean
}

export async function getSubscription(): Promise<SubscriptionInfo> {
  return apiFetch<SubscriptionInfo>('/payments/subscription')
}

export async function createCheckoutSession(priceId: string): Promise<{ url: string }> {
  return apiFetch<{ url: string }>('/payments/subscription/checkout', {
    method: 'POST',
    body: JSON.stringify({ priceId }),
  })
}

export async function createPortalSession(): Promise<{ url: string }> {
  return apiFetch<{ url: string }>('/payments/subscription/portal', {
    method: 'POST',
  })
}
```

- [ ] **Step 2: Type-check web**

```bash
cd "apps/web" && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/api.ts
git commit -m "feat: funções de API para templates e subscription no frontend"
```

---

## Task 9: Tela de seleção de template `/forms/new` (web)

**Files:**
- Create: `apps/web/src/app/(dashboard)/forms/new/page.tsx`
- Modify: `apps/web/src/app/(dashboard)/forms/page.tsx`

- [ ] **Step 1: Criar mapa de ícones por nicho**

```typescript
// dentro de apps/web/src/app/(dashboard)/forms/new/page.tsx
const NICHE_ICONS: Record<string, string> = {
  'influencer': '🎬',
  'lawyer': '⚖️',
  'events': '🎉',
  'marketing-agency': '📣',
  'architect': '🏠',
  'nutritionist': '🥗',
  'personal-trainer': '💪',
  'video-editor': '🎞️',
  'designer': '🎨',
  'photographer': '📷',
}
```

- [ ] **Step 2: Criar a página completa**

```tsx
// apps/web/src/app/(dashboard)/forms/new/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getTemplates, createFormFromTemplate, createForm, TemplateSummary } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { ArrowLeft, Plus } from 'lucide-react'

const NICHE_ICONS: Record<string, string> = {
  influencer: '🎬',
  lawyer: '⚖️',
  events: '🎉',
  'marketing-agency': '📣',
  architect: '🏠',
  nutritionist: '🥗',
  'personal-trainer': '💪',
  'video-editor': '🎞️',
  designer: '🎨',
  photographer: '📷',
}

export default function NewFormPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [templates, setTemplates] = useState<TemplateSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    getTemplates()
      .then(setTemplates)
      .catch(() => toast({ title: 'Erro ao carregar templates', variant: 'destructive' }))
      .finally(() => setLoading(false))
  }, [])

  async function handleTemplate(templateId: string) {
    setCreating(true)
    try {
      const form = await createFormFromTemplate(templateId)
      router.push(`/dashboard/forms/${form.id}/edit`)
    } catch {
      toast({ title: 'Erro ao criar formulário', variant: 'destructive' })
      setCreating(false)
    }
  }

  async function handleScratch() {
    setCreating(true)
    try {
      const form = await createForm({ title: 'Sem título' })
      router.push(`/dashboard/forms/${form.id}/edit`)
    } catch {
      toast({ title: 'Erro ao criar formulário', variant: 'destructive' })
      setCreating(false)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <button
        onClick={() => router.push('/dashboard/forms')}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-6"
      >
        <ArrowLeft className="w-4 h-4" /> Voltar
      </button>

      <h1 className="text-xl font-semibold mb-1">Como quer começar?</h1>
      <p className="text-sm text-gray-500 mb-6">
        Escolha um template pré-configurado pelo seu nicho ou crie do zero.
      </p>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-28 rounded-xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {/* Card criar do zero */}
          <button
            onClick={handleScratch}
            disabled={creating}
            className="flex flex-col items-center justify-center gap-2 p-5 border-2 border-dashed border-gray-300 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-colors text-center disabled:opacity-50"
          >
            <Plus className="w-6 h-6 text-gray-400" />
            <span className="font-medium text-sm">Criar do zero</span>
            <span className="text-xs text-gray-400">Formulário em branco</span>
          </button>

          {/* Cards de template */}
          {templates.map((tpl) => (
            <button
              key={tpl.id}
              onClick={() => handleTemplate(tpl.id)}
              disabled={creating}
              className="flex flex-col items-start gap-1 p-5 border border-gray-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-colors text-left disabled:opacity-50"
            >
              <span className="text-2xl">{NICHE_ICONS[tpl.niche] ?? '📋'}</span>
              <span className="font-medium text-sm leading-tight">{tpl.title}</span>
              <span className="text-xs text-gray-500 leading-snug line-clamp-2">{tpl.description}</span>
            </button>
          ))}
        </div>
      )}

      {creating && (
        <p className="text-center text-sm text-gray-500 mt-6 animate-pulse">
          Criando formulário...
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Atualizar forms/page.tsx para redirecionar para /forms/new**

Localizar a função `handleCreate` em `apps/web/src/app/(dashboard)/forms/page.tsx`:

```typescript
// Substituir handleCreate:
async function handleCreate() {
  router.push('/dashboard/forms/new')
}
```

- [ ] **Step 4: Type-check web**

```bash
cd "apps/web" && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/\(dashboard\)/forms/new/page.tsx apps/web/src/app/\(dashboard\)/forms/page.tsx
git commit -m "feat: tela de seleção de template /forms/new com grid de cards por nicho"
```

---

## Task 10: Tela de upgrade `/upgrade` (web)

**Files:**
- Create: `apps/web/src/components/upgrade/PlanCard.tsx`
- Create: `apps/web/src/app/(dashboard)/upgrade/page.tsx`

- [ ] **Step 1: Criar PlanCard**

```tsx
// apps/web/src/components/upgrade/PlanCard.tsx
'use client'

import { Button } from '@/components/ui/button'
import { Check } from 'lucide-react'

interface PlanCardProps {
  name: string
  price: number
  annualPrice: number
  isAnnual: boolean
  description: string
  features: string[]
  isCurrent: boolean
  isHighlighted?: boolean
  priceId: string
  onSelect: (priceId: string) => void
  loading: boolean
}

export function PlanCard({
  name, price, annualPrice, isAnnual, description, features,
  isCurrent, isHighlighted, priceId, onSelect, loading,
}: PlanCardProps) {
  const displayPrice = isAnnual ? annualPrice : price

  return (
    <div className={`relative flex flex-col p-6 rounded-2xl border-2 ${
      isHighlighted ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'
    }`}>
      {isHighlighted && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-xs font-semibold px-3 py-0.5 rounded-full">
          Mais popular
        </span>
      )}
      <h3 className="font-semibold text-lg mb-1">{name}</h3>
      <p className="text-xs text-gray-500 mb-4">{description}</p>
      <div className="mb-6">
        <span className="text-3xl font-bold">R$ {displayPrice}</span>
        <span className="text-sm text-gray-500">/mês</span>
        {isAnnual && price !== annualPrice && (
          <p className="text-xs text-green-600 mt-0.5">
            Economize R$ {(price - annualPrice) * 12}/ano
          </p>
        )}
      </div>
      <ul className="space-y-2 mb-6 flex-1">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm">
            <Check className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
            {f}
          </li>
        ))}
      </ul>
      {isCurrent ? (
        <Button variant="outline" disabled className="w-full">
          Plano atual
        </Button>
      ) : (
        <Button
          className="w-full"
          variant={isHighlighted ? 'default' : 'outline'}
          onClick={() => onSelect(priceId)}
          disabled={loading}
        >
          {loading ? 'Aguarde...' : `Assinar ${name}`}
        </Button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Criar página de upgrade**

```tsx
// apps/web/src/app/(dashboard)/upgrade/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  getSubscription,
  createCheckoutSession,
  createPortalSession,
  SubscriptionInfo,
} from '@/lib/api'
import { PlanCard } from '@/components/upgrade/PlanCard'
import { useToast } from '@/components/ui/use-toast'
import { Button } from '@/components/ui/button'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

const PLANS = [
  {
    name: 'Free',
    price: 0,
    annualPrice: 0,
    description: 'Para começar e testar',
    features: [
      '1 formulário ativo',
      '10 respostas gratuitas/mês',
      'Overage R$ 3,00/resposta',
    ],
    priceIdMonthly: '',
    priceIdAnnual: '',
    plan: 'FREE',
  },
  {
    name: 'Pro',
    price: 57,
    annualPrice: 47,
    description: 'Para freelancers que levam o processo a sério',
    features: [
      'Formulários ilimitados',
      'Respostas ilimitadas',
      'Notificações por e-mail',
      'Exportar CSV',
      'Logo e cor personalizada',
      'Lógica condicional',
    ],
    priceIdMonthly: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY ?? 'price_pro_monthly',
    priceIdAnnual: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_ANNUAL ?? 'price_pro_annual',
    plan: 'PRO',
    highlighted: true,
  },
  {
    name: 'Agência',
    price: 127,
    annualPrice: 107,
    description: 'Para quem gerencia múltiplos clientes',
    features: [
      'Tudo do Pro',
      'White-label',
      'Múltiplos workspaces',
      'Até 5 colaboradores',
      'Domínio personalizado',
      'Suporte prioritário',
    ],
    priceIdMonthly: process.env.NEXT_PUBLIC_STRIPE_PRICE_AGENCY_MONTHLY ?? 'price_agency_monthly',
    priceIdAnnual: process.env.NEXT_PUBLIC_STRIPE_PRICE_AGENCY_ANNUAL ?? 'price_agency_annual',
    plan: 'AGENCY',
  },
]

export default function UpgradePage() {
  const { toast } = useToast()
  const searchParams = useSearchParams()
  const [isAnnual, setIsAnnual] = useState(false)
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    getSubscription().then(setSubscription).catch(() => null)

    if (searchParams.get('upgraded') === 'true') {
      toast({ title: '🎉 Bem-vindo ao Pro! Seu plano foi ativado.' })
    }
  }, [])

  async function handleSelect(priceId: string) {
    if (!priceId) return
    setLoading(true)
    try {
      const { url } = await createCheckoutSession(priceId)
      window.location.href = url
    } catch {
      toast({ title: 'Erro ao iniciar checkout', variant: 'destructive' })
      setLoading(false)
    }
  }

  async function handlePortal() {
    setLoading(true)
    try {
      const { url } = await createPortalSession()
      window.location.href = url
    } catch {
      toast({ title: 'Você ainda não possui assinatura ativa', variant: 'destructive' })
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-xl font-semibold mb-1">Planos</h1>
      <p className="text-sm text-gray-500 mb-6">
        Escolha o plano ideal para o seu volume de respostas.
      </p>

      {/* Toggle mensal/anual */}
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={() => setIsAnnual(false)}
          className={`text-sm px-3 py-1 rounded-full transition-colors ${!isAnnual ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Mensal
        </button>
        <button
          onClick={() => setIsAnnual(true)}
          className={`text-sm px-3 py-1 rounded-full transition-colors ${isAnnual ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Anual <span className="text-green-600 font-medium">-17%</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {PLANS.map((p) => (
          <PlanCard
            key={p.plan}
            name={p.name}
            price={p.price}
            annualPrice={p.annualPrice}
            isAnnual={isAnnual}
            description={p.description}
            features={p.features}
            isCurrent={subscription?.plan === p.plan}
            isHighlighted={p.highlighted}
            priceId={isAnnual ? p.priceIdAnnual : p.priceIdMonthly}
            onSelect={handleSelect}
            loading={loading}
          />
        ))}
      </div>

      {subscription?.hasCustomer && (
        <div className="text-center">
          <p className="text-sm text-gray-500 mb-2">Quer alterar ou cancelar sua assinatura?</p>
          <Button variant="outline" size="sm" onClick={handlePortal} disabled={loading}>
            Gerenciar assinatura
          </Button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Adicionar variáveis de ambiente no .env.example**

```bash
# Adicionar ao apps/web/.env.local (ou .env.example):
# NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY=price_...
# NEXT_PUBLIC_STRIPE_PRICE_PRO_ANNUAL=price_...
# NEXT_PUBLIC_STRIPE_PRICE_AGENCY_MONTHLY=price_...
# NEXT_PUBLIC_STRIPE_PRICE_AGENCY_ANNUAL=price_...
```

- [ ] **Step 4: Type-check web**

```bash
cd "apps/web" && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/upgrade/ apps/web/src/app/\(dashboard\)/upgrade/
git commit -m "feat: tela de upgrade com cards de plano, toggle mensal/anual e portal de assinatura"
```

---

## Task 11: Personalização de marca no formulário público (web)

**Files:**
- Create: `apps/web/src/components/builder/BrandCustomizer.tsx`
- Modify: `apps/web/src/components/form-public/FormPublicClient.tsx`
- Modify: `apps/web/src/app/(dashboard)/forms/[id]/edit/page.tsx`

- [ ] **Step 1: Criar BrandCustomizer**

```tsx
// apps/web/src/components/builder/BrandCustomizer.tsx
'use client'

interface BrandCustomizerProps {
  brandColor: string
  logoUrl: string
  isPro: boolean
  onChange: (field: 'brandColor' | 'logoUrl', value: string) => void
}

export function BrandCustomizer({ brandColor, logoUrl, isPro, onChange }: BrandCustomizerProps) {
  if (!isPro) {
    return (
      <div className="p-4 border border-dashed rounded-lg bg-gray-50 text-center">
        <p className="text-sm text-gray-500">
          🔒 Personalização de marca disponível no plano <strong>Pro</strong>.
        </p>
        <a href="/dashboard/upgrade" className="text-sm text-blue-600 hover:underline mt-1 inline-block">
          Ver planos →
        </a>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Cor principal</label>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={brandColor || '#2563eb'}
            onChange={(e) => onChange('brandColor', e.target.value)}
            className="w-10 h-10 rounded cursor-pointer border border-gray-200"
          />
          <span className="text-sm text-gray-500 font-mono">{brandColor || '#2563eb'}</span>
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">URL do logo</label>
        <input
          type="url"
          placeholder="https://..."
          value={logoUrl || ''}
          onChange={(e) => onChange('logoUrl', e.target.value)}
          className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        {logoUrl && (
          <img src={logoUrl} alt="Logo preview" className="mt-2 h-10 object-contain" />
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Integrar BrandCustomizer na página de edição**

Abrir `apps/web/src/app/(dashboard)/forms/[id]/edit/page.tsx`. Localizar onde o formulário é exibido e adicionar uma seção de personalização de marca. O padrão atual usa um painel lateral — adicionar no painel de configurações do formulário (área de título/descrição):

```tsx
// Importar no topo:
import { BrandCustomizer } from '@/components/builder/BrandCustomizer'

// Adicionar no JSX, após os campos de título/descrição do formulário:
<div className="mt-6 pt-6 border-t">
  <h3 className="text-sm font-medium text-gray-700 mb-3">Personalização de marca</h3>
  <BrandCustomizer
    brandColor={form.brandColor ?? ''}
    logoUrl={form.logoUrl ?? ''}
    isPro={userPlan === 'PRO' || userPlan === 'AGENCY'}
    onChange={(field, value) => {
      handleFormUpdate({ [field]: value })
    }}
  />
</div>
```

> **Nota:** `userPlan` deve ser obtido via `GET /payments/subscription` ou passado via Server Component. Se a página de edição já tem acesso ao `form`, pode-se obter o plano do usuário de `GET /auth/me` que retorna `{ plan }`. Adicionar chamada `getSubscription()` no `useEffect` inicial da página, junto com `getForm`.

- [ ] **Step 3: Aplicar brandColor e logoUrl em FormPublicClient.tsx**

Localizar em `apps/web/src/components/form-public/FormPublicClient.tsx` onde a tela de boas-vindas e o botão "Próximo" são renderizados. Adicionar suporte a CSS custom property e logo:

```tsx
// No componente raiz (FormPublicClient), adicionar style no container principal:
<div
  style={{ '--brand-color': form.brandColor ?? '#2563eb' } as React.CSSProperties}
  className="min-h-screen bg-white"
>

// No WelcomeScreen ou no componente pai, passar logoUrl:
// (Verificar props atuais de WelcomeScreen e adicionar logoUrl se não existir)

// Nos botões de navegação (Próximo/Enviar), trocar a cor:
// Substituir a classe Tailwind de cor fixa por inline style:
<button
  style={{ backgroundColor: form.brandColor ?? '#2563eb' }}
  className="px-6 py-3 rounded-lg text-white font-medium"
>
  Próximo →
</button>
```

- [ ] **Step 4: Atualizar WelcomeScreen para exibir logo**

Abrir `apps/web/src/components/form-public/WelcomeScreen.tsx`. Verificar props atuais e adicionar `logoUrl`:

```tsx
// Se props atuais não têm logoUrl, adicionar:
interface WelcomeScreenProps {
  // ... props existentes ...
  logoUrl?: string | null
  brandColor?: string | null
}

// No JSX, antes do título:
{logoUrl && (
  <img src={logoUrl} alt="Logo" className="h-12 object-contain mb-4 mx-auto" />
)}
```

- [ ] **Step 5: Type-check web**

```bash
cd "apps/web" && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/builder/BrandCustomizer.tsx apps/web/src/components/form-public/ apps/web/src/app/\(dashboard\)/forms/\[id\]/edit/
git commit -m "feat: personalização de marca no builder (Pro+) e aplicação no formulário público"
```

---

## Task 12: Build final e testes de regressão

**Files:**
- Todos os arquivos modificados na etapa

- [ ] **Step 1: Rodar todos os testes do backend**

```bash
cd "apps/api" && npx vitest run 2>&1 | tail -30
```
Esperado: todos os testes existentes (19) + novos de subscriptionService (6) = 25 testes passando.

- [ ] **Step 2: Build do backend**

```bash
cd "apps/api" && npm run build 2>&1 | tail -20
```
Esperado: `0 errors`.

- [ ] **Step 3: Build do frontend**

```bash
cd "apps/web" && npm run build 2>&1 | tail -20
```
Esperado: `✓ Compiled successfully` sem erros de tipo.

- [ ] **Step 4: Rodar seed em ambiente limpo (verificar idempotência)**

```bash
cd "apps/api" && npm run db:seed 2>&1
```
Esperado: 10 linhas `⏭  ... já existe` (seed rodou na Task 6).

- [ ] **Step 5: Commit final**

```bash
git add .
git commit -m "chore: etapa 6 concluída — planos Pro/Agência, templates, e-mail e personalização de marca"
```

---

## Checklist de verificação final

Antes de declarar a etapa concluída, verificar:

- [ ] `POST /payments/subscription/checkout` retorna URL do Stripe e redireciona para checkout
- [ ] Webhook `customer.subscription.created` atualiza `User.plan` para `PRO`
- [ ] Webhook `customer.subscription.deleted` rebaixa `User.plan` para `FREE`
- [ ] `GET /templates` retorna os 10 templates ordenados
- [ ] `POST /forms` com `templateId` cria formulário com todas as perguntas e condições corretas
- [ ] Seed é idempotente (segunda execução não duplica templates)
- [ ] `GET /forms/:id/responses/export` retorna 403 para Free e CSV correto para Pro
- [ ] Tela `/forms/new` exibe grid com 10 templates + card "Criar do zero"
- [ ] Tela `/upgrade` exibe os 3 planos com toggle mensal/anual e preços corretos
- [ ] Formulário público exibe logo e aplica brandColor quando configurados (Pro)
- [ ] Builder mostra "🔒" com link para upgrade para usuários Free na seção de marca
- [ ] E-mail de nova resposta é enfileirado no BullMQ para formulários Pro/Agência
- [ ] Build backend e frontend passam sem erros de tipo
- [ ] 25 testes passando no backend

---

## Notas de ambiente

Para testar assinaturas localmente:
```bash
stripe listen --forward-to localhost:3001/webhooks/stripe
stripe trigger customer.subscription.created
```

Variáveis de ambiente necessárias nesta etapa:
```env
# Backend
STRIPE_PRICE_PRO_MONTHLY=price_...
STRIPE_PRICE_PRO_ANNUAL=price_...
STRIPE_PRICE_AGENCY_MONTHLY=price_...
STRIPE_PRICE_AGENCY_ANNUAL=price_...
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=noreply@consorteform.com
UPSTASH_REDIS_REST_URL=redis://...

# Frontend
NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY=price_...
NEXT_PUBLIC_STRIPE_PRICE_PRO_ANNUAL=price_...
NEXT_PUBLIC_STRIPE_PRICE_AGENCY_MONTHLY=price_...
NEXT_PUBLIC_STRIPE_PRICE_AGENCY_ANNUAL=price_...
```
