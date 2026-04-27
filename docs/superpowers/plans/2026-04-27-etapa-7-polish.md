# Etapa 7 — Polish, Observabilidade e Exportação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar Sentry (erros), PostHog (analytics), exportação PDF, pré-visualização ao vivo no builder, melhorias de UX (skeletons, empty states, 404/500, meta tags) e README.md final.

**Architecture:** Sentry captura exceções não tratadas em ambos os apps; PostHog identifica o usuário após login e dispara eventos em pontos-chave; PDF é gerado no backend com `pdfkit`; live preview é um painel lateral isolado no builder que re-renderiza uma versão read-only da pergunta selecionada.

**Tech Stack:** @sentry/nextjs, @sentry/node, posthog-js, pdfkit, Next.js 14 App Router, Fastify 4, Vitest

---

## Mapa de Arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `apps/api/src/lib/sentry.ts` | Criar | Inicialização Sentry Node |
| `apps/api/src/index.ts` | Modificar | Integrar Sentry no Fastify |
| `apps/api/src/routes/responses.ts` | Modificar | Adicionar exportação PDF |
| `apps/web/sentry.client.config.ts` | Criar | Config Sentry lado cliente |
| `apps/web/sentry.server.config.ts` | Criar | Config Sentry lado servidor |
| `apps/web/sentry.edge.config.ts` | Criar | Config Sentry edge runtime |
| `apps/web/next.config.js` | Modificar | Envolver com `withSentryConfig` |
| `apps/web/src/lib/posthog.ts` | Criar | Cliente PostHog + hook usePostHog |
| `apps/web/src/app/layout.tsx` | Modificar | PostHogProvider + favicon + meta OG |
| `apps/web/src/app/(dashboard)/layout.tsx` | Modificar | PostHog identify após login |
| `apps/web/src/app/(dashboard)/forms/page.tsx` | Modificar | Evento form_created, empty state melhorado |
| `apps/web/src/app/(dashboard)/forms/[id]/edit/page.tsx` | Modificar | Eventos form_published, pré-visualização ao vivo |
| `apps/web/src/app/(dashboard)/forms/[id]/responses/page.tsx` | Modificar | Botão exportar PDF, evento overage_paid |
| `apps/web/src/app/(dashboard)/upgrade/page.tsx` | Modificar | Eventos upgrade_started, upgrade_completed |
| `apps/web/src/app/(dashboard)/forms/new/page.tsx` | Modificar | Evento template_selected |
| `apps/web/src/components/builder/LivePreview.tsx` | Criar | Painel de pré-visualização ao vivo |
| `apps/web/src/app/not-found.tsx` | Criar | 404 global customizado |
| `apps/web/src/app/error.tsx` | Criar | 500 global customizado |
| `apps/web/src/app/(dashboard)/loading.tsx` | Criar | Loader global do dashboard |
| `apps/web/src/app/(dashboard)/forms/loading.tsx` | Criar | Skeleton da lista de formulários |
| `apps/web/src/app/(dashboard)/forms/[id]/responses/loading.tsx` | Criar | Skeleton do dashboard de respostas |
| `apps/web/public/favicon.ico` | Criar | Favicon do produto |
| `README.md` | Criar | Documentação final na raiz |

---

## Task 1: Sentry — Backend (apps/api)

**Files:**
- Create: `apps/api/src/lib/sentry.ts`
- Modify: `apps/api/src/index.ts`

- [ ] **Step 1: Instalar @sentry/node**

```bash
cd apps/api && npm install @sentry/node
```

- [ ] **Step 2: Criar lib/sentry.ts**

```typescript
// apps/api/src/lib/sentry.ts
import * as Sentry from '@sentry/node'

export function initSentry() {
  const dsn = process.env.SENTRY_DSN
  if (!dsn) return

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    tracesSampleRate: 0.1,
  })
}

export { Sentry }
```

- [ ] **Step 3: Integrar Sentry no apps/api/src/index.ts**

Abrir `apps/api/src/index.ts`. Adicionar logo no topo (antes de qualquer import de rotas):

```typescript
import { initSentry, Sentry } from './lib/sentry'
initSentry()
```

Depois de registrar todas as rotas, adicionar handler de erro do Sentry:

```typescript
app.setErrorHandler((error, request, reply) => {
  Sentry.captureException(error, {
    extra: { userId: (request as any).userId },
  })
  reply.status(500).send({ error: 'Erro interno do servidor' })
})
```

- [ ] **Step 4: Adicionar SENTRY_DSN no .env.example**

Abrir `.env.example` na raiz e confirmar que a linha existe:
```
SENTRY_DSN=
```

Se não existir, adicionar ao final do arquivo.

- [ ] **Step 5: Verificar que o build não quebra**

```bash
cd apps/api && npm run type-check
```

Expected: nenhum erro de tipo.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/lib/sentry.ts apps/api/src/index.ts
git commit -m "feat: integrar Sentry no backend (apps/api)"
```

---

## Task 2: Sentry — Frontend (apps/web)

**Files:**
- Create: `apps/web/sentry.client.config.ts`
- Create: `apps/web/sentry.server.config.ts`
- Create: `apps/web/sentry.edge.config.ts`
- Modify: `apps/web/next.config.js`

- [ ] **Step 1: Instalar @sentry/nextjs**

```bash
cd apps/web && npm install @sentry/nextjs
```

- [ ] **Step 2: Criar sentry.client.config.ts**

```typescript
// apps/web/sentry.client.config.ts
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.01,
  integrations: [Sentry.replayIntegration()],
})
```

- [ ] **Step 3: Criar sentry.server.config.ts**

```typescript
// apps/web/sentry.server.config.ts
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
})
```

- [ ] **Step 4: Criar sentry.edge.config.ts**

```typescript
// apps/web/sentry.edge.config.ts
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
})
```

- [ ] **Step 5: Verificar/criar next.config.js**

Verificar se existe `apps/web/next.config.js` ou `next.config.mjs`. Se existir, envolver com `withSentryConfig`. Se não existir, criar:

```javascript
// apps/web/next.config.js
const { withSentryConfig } = require('@sentry/nextjs')

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.r2.cloudflarestorage.com' },
      { protocol: 'https', hostname: '**.supabase.co' },
    ],
  },
}

module.exports = withSentryConfig(nextConfig, {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  widenClientFileUpload: true,
  hideSourceMaps: true,
  disableLogger: true,
})
```

> **Nota:** Se já existia um `next.config.js`, preserve a configuração existente e apenas envolva com `withSentryConfig`.

- [ ] **Step 6: Verificar build**

```bash
cd apps/web && npm run type-check
```

Expected: sem erros de tipo.

- [ ] **Step 7: Commit**

```bash
git add apps/web/sentry.client.config.ts apps/web/sentry.server.config.ts apps/web/sentry.edge.config.ts apps/web/next.config.js
git commit -m "feat: integrar Sentry no frontend (apps/web)"
```

---

## Task 3: PostHog — Inicialização e Identify

**Files:**
- Create: `apps/web/src/lib/posthog.ts`
- Modify: `apps/web/src/app/layout.tsx`
- Modify: `apps/web/src/app/(dashboard)/layout.tsx`

- [ ] **Step 1: Instalar posthog-js**

```bash
cd apps/web && npm install posthog-js
```

- [ ] **Step 2: Criar apps/web/src/lib/posthog.ts**

```typescript
// apps/web/src/lib/posthog.ts
import posthog from 'posthog-js'

let initialized = false

export function initPostHog() {
  if (initialized || typeof window === 'undefined') return
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://app.posthog.com'
  if (!key) return
  posthog.init(key, { api_host: host, capture_pageview: true })
  initialized = true
}

export function identifyUser(userId: string, props: { plan: string; nicho?: string }) {
  posthog.identify(userId, props)
}

export function trackEvent(event: string, properties?: Record<string, unknown>) {
  posthog.capture(event, properties)
}

export function resetUser() {
  posthog.reset()
}
```

- [ ] **Step 3: Inicializar PostHog no layout raiz**

Abrir `apps/web/src/app/layout.tsx` e adicionar a chamada de inicialização. Como o layout raiz é um Server Component, criar um componente cliente separado:

```typescript
// apps/web/src/app/layout.tsx
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Inter } from 'next/font/google'
import './globals.css'
import { PostHogInit } from '@/components/PostHogInit'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: { default: 'Consorte Form', template: '%s | Consorte Form' },
  description: 'Formulários interativos passo a passo para prestadores de serviço',
  openGraph: {
    title: 'Consorte Form',
    description: 'Crie formulários de briefing profissionais e receba clientes mais preparados.',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        <PostHogInit />
        {children}
      </body>
    </html>
  )
}
```

- [ ] **Step 4: Criar apps/web/src/components/PostHogInit.tsx**

```typescript
// apps/web/src/components/PostHogInit.tsx
'use client'
import { useEffect } from 'react'
import { initPostHog } from '@/lib/posthog'

export function PostHogInit() {
  useEffect(() => { initPostHog() }, [])
  return null
}
```

- [ ] **Step 5: Identificar usuário no layout do dashboard**

Abrir `apps/web/src/app/(dashboard)/layout.tsx`. Adicionar PostHog identify após obter os dados do usuário. Verificar como o layout já busca o usuário (provavelmente via Supabase). Adicionar:

```typescript
// Dentro do componente cliente ou após fetch de /auth/me
// Exemplo de integração no componente cliente do layout:
'use client'
import { useEffect } from 'react'
import { identifyUser } from '@/lib/posthog'

// No useEffect que já carrega o usuário:
useEffect(() => {
  if (user) {
    identifyUser(user.id, { plan: user.plan, nicho: user.nicho })
  }
}, [user])
```

> **Nota:** Ler o arquivo `apps/web/src/app/(dashboard)/layout.tsx` atual para integrar sem quebrar a estrutura existente. Adicionar apenas o `identifyUser` no callback onde o usuário já é carregado.

- [ ] **Step 6: Adicionar NEXT_PUBLIC_POSTHOG_KEY no .env.example**

Confirmar que as linhas existem no `.env.example`:
```
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com
```

- [ ] **Step 7: Verificar build**

```bash
cd apps/web && npm run type-check
```

Expected: sem erros.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/lib/posthog.ts apps/web/src/components/PostHogInit.tsx apps/web/src/app/layout.tsx apps/web/src/app/(dashboard)/layout.tsx
git commit -m "feat: inicializar PostHog e identificar usuário no dashboard"
```

---

## Task 4: PostHog — Eventos de Produto

**Files:**
- Modify: `apps/web/src/app/(dashboard)/forms/page.tsx`
- Modify: `apps/web/src/app/(dashboard)/forms/[id]/edit/page.tsx`
- Modify: `apps/web/src/app/(dashboard)/forms/[id]/responses/page.tsx`
- Modify: `apps/web/src/app/(dashboard)/upgrade/page.tsx`
- Modify: `apps/web/src/app/(dashboard)/forms/new/page.tsx`

Os 7 eventos a instrumentar:

| Evento | Onde disparar | Propriedades |
|---|---|---|
| `form_created` | `forms/page.tsx` após POST /forms | `{ templateId, from: 'scratch' \| templateSlug }` |
| `form_published` | `forms/[id]/edit/page.tsx` após PATCH status=PUBLISHED | `{ formId, questionCount }` |
| `response_received` | N/A frontend — já acontece no backend; não instrumentar aqui |  |
| `overage_paid` | `forms/[id]/responses/page.tsx` após polling confirmar UNLOCKED | `{ amount: 300, responseId }` |
| `upgrade_started` | `upgrade/page.tsx` ao clicar botão de assinar | `{ fromPlan, toPlan, billing: 'monthly'\|'annual' }` |
| `upgrade_completed` | `dashboard/page.tsx` se `?upgraded=true` na URL | `{ plan, billing }` |
| `template_selected` | `forms/new/page.tsx` ao clicar em template | `{ templateSlug }` |

- [ ] **Step 1: Adicionar evento form_created em forms/page.tsx**

Abrir `apps/web/src/app/(dashboard)/forms/page.tsx`. Na função `handleCreate` (ou equivalente que redireciona para /forms/new), não é possível saber o template ainda. O evento `form_created` deve ser disparado em `forms/new/page.tsx` no momento do POST. Pular o evento neste arquivo.

- [ ] **Step 2: Adicionar eventos em forms/new/page.tsx**

Abrir `apps/web/src/app/(dashboard)/forms/new/page.tsx`. Na função que faz POST /forms, adicionar após a resposta:

```typescript
import { trackEvent } from '@/lib/posthog'

// Após chamada bem-sucedida de POST /forms:
trackEvent('form_created', {
  templateId: selectedTemplateId ?? null,
  from: selectedTemplateId ? templateSlug : 'scratch',
})
```

- [ ] **Step 3: Adicionar evento template_selected em forms/new/page.tsx**

No mesmo arquivo, na função que trata o clique em um card de template (antes de chamar POST):

```typescript
trackEvent('template_selected', { templateSlug: template.slug })
```

- [ ] **Step 4: Adicionar evento form_published em forms/[id]/edit/page.tsx**

Abrir `apps/web/src/app/(dashboard)/forms/[id]/edit/page.tsx`. Encontrar a função que chama `updateFormStatus` com `PUBLISHED`. Após sucesso:

```typescript
import { trackEvent } from '@/lib/posthog'

// Após PATCH status = PUBLISHED com sucesso:
trackEvent('form_published', {
  formId: id,
  questionCount: form?.questions?.length ?? 0,
})
```

- [ ] **Step 5: Adicionar evento overage_paid em responses/page.tsx**

Abrir `apps/web/src/app/(dashboard)/forms/[id]/responses/page.tsx`. No loop de polling que detecta `status === 'UNLOCKED'` (após pagamento), adicionar:

```typescript
import { trackEvent } from '@/lib/posthog'

// Após polling confirmar UNLOCKED:
trackEvent('overage_paid', { amount: 300, responseId: rid })
```

- [ ] **Step 6: Adicionar eventos upgrade_started em upgrade/page.tsx**

Abrir `apps/web/src/app/(dashboard)/upgrade/page.tsx`. Na função que chama POST /payments/subscription/checkout:

```typescript
import { trackEvent } from '@/lib/posthog'

// Antes de redirecionar para Stripe Checkout:
trackEvent('upgrade_started', {
  fromPlan: currentPlan,
  toPlan: selectedPlan,
  billing: billingCycle, // 'monthly' | 'annual'
})
```

- [ ] **Step 7: Adicionar evento upgrade_completed em dashboard/page.tsx**

Abrir `apps/web/src/app/(dashboard)/dashboard/page.tsx`. Detectar `?upgraded=true` na URL e disparar o evento uma vez:

```typescript
'use client'
import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { trackEvent } from '@/lib/posthog'

// No componente:
const searchParams = useSearchParams()
useEffect(() => {
  if (searchParams.get('upgraded') === 'true') {
    trackEvent('upgrade_completed', { plan: userPlan, billing: 'unknown' })
    // Limpar o query param para não re-disparar
    window.history.replaceState({}, '', '/dashboard')
  }
}, [searchParams, userPlan])
```

- [ ] **Step 8: Verificar build**

```bash
cd apps/web && npm run type-check
```

Expected: sem erros.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/app/
git commit -m "feat: instrumentar 7 eventos PostHog nos pontos-chave do produto"
```

---

## Task 5: Exportação PDF

**Files:**
- Modify: `apps/api/src/routes/responses.ts`
- Modify: `apps/web/src/app/(dashboard)/forms/[id]/responses/page.tsx`

- [ ] **Step 1: Instalar pdfkit no backend**

```bash
cd apps/api && npm install pdfkit && npm install --save-dev @types/pdfkit
```

- [ ] **Step 2: Implementar rota de exportação PDF**

Abrir `apps/api/src/routes/responses.ts`. Adicionar nova rota logo após a rota de exportação CSV existente:

```typescript
import PDFDocument from 'pdfkit'

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

    const doc = new PDFDocument({ margin: 50, size: 'A4' })
    const date = new Date().toISOString().slice(0, 10)

    reply.header('Content-Type', 'application/pdf')
    reply.header(
      'Content-Disposition',
      `attachment; filename="respostas-${form.title.slice(0, 30)}-${date}.pdf"`,
    )

    // Pipe do PDF para o reply como stream
    doc.pipe(reply.raw)

    // Cabeçalho do documento
    doc
      .fontSize(18)
      .font('Helvetica-Bold')
      .text(form.title, { align: 'center' })
    doc
      .fontSize(10)
      .font('Helvetica')
      .fillColor('#666666')
      .text(`Exportado em ${new Date().toLocaleDateString('pt-BR')} · ${form.responses.length} respostas`, { align: 'center' })
    doc.moveDown(1)

    if (form.responses.length === 0) {
      doc.fontSize(12).fillColor('#333333').text('Nenhuma resposta desbloqueada encontrada.')
      doc.end()
      return reply
    }

    form.responses.forEach((response, idx) => {
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

      const answerMap = new Map(response.answers.map((a) => [a.questionId, a.value]))

      form.questions.forEach((q) => {
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
```

- [ ] **Step 3: Adicionar botão de exportar PDF no frontend**

Abrir `apps/web/src/app/(dashboard)/forms/[id]/responses/page.tsx`. Encontrar o botão de exportar CSV existente e adicionar opção PDF. Se não houver ainda, adicionar dropdown:

```typescript
// Adicionar função de download PDF:
async function handleExportPdf() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) return

  const res = await fetch(`${apiUrl}/forms/${formId}/responses/export/pdf`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    toast({ title: 'Erro ao exportar PDF', variant: 'destructive' })
    return
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `respostas-${formId}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}

// No JSX, substituir ou complementar o botão de exportar:
// Para usuários Free: botão visível + desabilitado com tooltip
// Para Pro/Agência: dropdown com CSV e PDF
```

> **Nota:** Se o plano for FREE, mostrar botão desabilitado com tooltip "Disponível no plano Pro". Verificar `userPlan` já carregado na página.

- [ ] **Step 4: Verificar type-check do backend**

```bash
cd apps/api && npm run type-check
```

Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/responses.ts apps/web/src/app/'(dashboard)'/forms/'[id]'/responses/page.tsx
git commit -m "feat: exportação PDF de respostas (Pro/Agência)"
```

---

## Task 6: Pré-visualização ao Vivo no Builder

**Files:**
- Create: `apps/web/src/components/builder/LivePreview.tsx`
- Modify: `apps/web/src/app/(dashboard)/forms/[id]/edit/page.tsx`

- [ ] **Step 1: Criar componente LivePreview.tsx**

```typescript
// apps/web/src/components/builder/LivePreview.tsx
'use client'

import { Question, QuestionType } from '@consorte/types'

interface LivePreviewProps {
  question: Question | null
  isPro: boolean
}

function AnswerPreview({ type }: { type: QuestionType }) {
  switch (type) {
    case QuestionType.SHORT_TEXT:
      return (
        <div className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-400 bg-gray-50">
          Resposta curta...
        </div>
      )
    case QuestionType.LONG_TEXT:
      return (
        <div className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-400 bg-gray-50 h-20 resize-none">
          Resposta longa...
        </div>
      )
    case QuestionType.MULTIPLE_CHOICE:
      return (
        <div className="space-y-2">
          {['Opção A', 'Opção B', 'Opção C'].map((opt) => (
            <div key={opt} className="flex items-center gap-3 p-3 border rounded-lg text-sm text-gray-600">
              <div className="w-4 h-4 rounded-full border-2 border-gray-300 flex-shrink-0" />
              {opt}
            </div>
          ))}
        </div>
      )
    case QuestionType.MULTIPLE_SELECT:
      return (
        <div className="space-y-2">
          {['Opção A', 'Opção B', 'Opção C'].map((opt) => (
            <div key={opt} className="flex items-center gap-3 p-3 border rounded-lg text-sm text-gray-600">
              <div className="w-4 h-4 rounded border-2 border-gray-300 flex-shrink-0" />
              {opt}
            </div>
          ))}
        </div>
      )
    case QuestionType.SCALE:
      return (
        <div className="flex gap-2 justify-center pt-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} className="w-12 h-12 rounded-lg border-2 border-gray-200 text-gray-600 font-medium text-sm hover:border-blue-400 transition-colors">
              {n}
            </button>
          ))}
        </div>
      )
    default:
      return null
  }
}

export function LivePreview({ question, isPro }: LivePreviewProps) {
  if (!isPro) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <p className="text-sm font-medium text-gray-700 mb-1">Pré-visualização ao vivo</p>
        <p className="text-xs text-gray-400 mb-3">Disponível no plano Pro</p>
        <a
          href="/dashboard/upgrade"
          className="text-xs text-blue-600 hover:underline"
        >
          Fazer upgrade →
        </a>
      </div>
    )
  }

  if (!question) {
    return (
      <div className="flex items-center justify-center h-full p-6 text-center">
        <p className="text-sm text-gray-400">Selecione uma pergunta para ver a pré-visualização</p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto p-6 bg-gray-50">
      <p className="text-xs text-gray-400 uppercase tracking-wide mb-4 font-medium">Pré-visualização</p>

      <div className="bg-white rounded-xl border p-6 space-y-4">
        {/* Barra de progresso simulada */}
        <div className="h-1 bg-gray-100 rounded-full">
          <div className="h-1 bg-blue-500 rounded-full w-1/2" />
        </div>

        <div>
          <p className="text-xs text-gray-400 mb-1">Pergunta X de Y</p>
          <h2 className="text-base font-semibold text-gray-900">
            {question.title || 'Sem título'}
            {question.required && <span className="text-red-500 ml-1">*</span>}
          </h2>
          {question.description && (
            <p className="text-sm text-gray-500 mt-1">{question.description}</p>
          )}
        </div>

        <AnswerPreview type={question.type} />

        <div className="flex justify-between pt-2">
          <button className="text-sm text-gray-400 hover:text-gray-600">← Voltar</button>
          <button className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700">
            Próximo →
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Integrar LivePreview no builder**

Abrir `apps/web/src/app/(dashboard)/forms/[id]/edit/page.tsx`. O builder já tem layout de duas colunas. Adicionar uma terceira coluna (painel direito) com o LivePreview.

Localizar o JSX do layout principal e adicionar:

```typescript
import { LivePreview } from '@/components/builder/LivePreview'

// Na área de retorno do JSX, adicionar coluna de preview:
// O layout existente tem: lista de perguntas (esquerda) | editor da pergunta selecionada (centro/direita)
// Novo layout: lista (esquerda) | editor (centro) | preview (direita, apenas se Pro)

// Substituir o div container principal por grid de 3 colunas quando Pro:
<div className={`grid gap-4 h-full ${userPlan !== 'FREE' ? 'grid-cols-[260px,1fr,300px]' : 'grid-cols-[260px,1fr]'}`}>
  {/* coluna esquerda: lista de perguntas — sem alteração */}
  {/* coluna central: editor da pergunta — sem alteração */}
  {userPlan !== 'FREE' && (
    <div className="border-l bg-white overflow-hidden">
      <LivePreview
        question={selectedQuestion ?? null}
        isPro={userPlan !== 'FREE'}
      />
    </div>
  )}
</div>
```

> **Nota:** `selectedQuestion` é a pergunta cujo id é `selectedId`. Derivar com `form?.questions?.find(q => q.id === selectedId) ?? null`.

- [ ] **Step 3: Verificar type-check**

```bash
cd apps/web && npm run type-check
```

Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/builder/LivePreview.tsx apps/web/src/app/'(dashboard)'/forms/'[id]'/edit/page.tsx
git commit -m "feat: pré-visualização ao vivo no builder (Pro/Agência)"
```

---

## Task 7: Skeleton Loading e loading.tsx

**Files:**
- Create: `apps/web/src/app/(dashboard)/loading.tsx`
- Create: `apps/web/src/app/(dashboard)/forms/loading.tsx`
- Create: `apps/web/src/app/(dashboard)/forms/[id]/responses/loading.tsx`

- [ ] **Step 1: Criar loading.tsx global do dashboard**

```typescript
// apps/web/src/app/(dashboard)/loading.tsx
export default function DashboardLoading() {
  return (
    <div className="p-6 max-w-4xl mx-auto animate-pulse space-y-4">
      <div className="h-8 bg-gray-100 rounded w-48" />
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-gray-100 rounded-xl" />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Criar loading.tsx da lista de formulários**

```typescript
// apps/web/src/app/(dashboard)/forms/loading.tsx
export default function FormsLoading() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6 animate-pulse">
        <div className="h-7 bg-gray-100 rounded w-40" />
        <div className="h-9 bg-gray-100 rounded w-36" />
      </div>
      <div className="space-y-3 animate-pulse">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-4 p-4 bg-white border rounded-xl">
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-100 rounded w-48" />
              <div className="h-3 bg-gray-100 rounded w-24" />
            </div>
            <div className="flex gap-2">
              {[1, 2, 3].map((j) => (
                <div key={j} className="w-8 h-8 bg-gray-100 rounded" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Criar loading.tsx do dashboard de respostas**

```typescript
// apps/web/src/app/(dashboard)/forms/[id]/responses/loading.tsx
export default function ResponsesLoading() {
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6 animate-pulse">
        <div className="w-8 h-8 bg-gray-100 rounded" />
        <div className="h-7 bg-gray-100 rounded w-56" />
      </div>
      {/* Skeleton do banner */}
      <div className="h-16 bg-gray-100 rounded-xl mb-6 animate-pulse" />
      {/* Skeleton das linhas */}
      <div className="space-y-2 animate-pulse">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-4 p-4 bg-white border rounded-xl">
            <div className="w-6 h-4 bg-gray-100 rounded" />
            <div className="flex-1 h-4 bg-gray-100 rounded" />
            <div className="w-24 h-4 bg-gray-100 rounded" />
            <div className="w-6 h-6 bg-gray-100 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/'(dashboard)'/loading.tsx apps/web/src/app/'(dashboard)'/forms/loading.tsx apps/web/src/app/'(dashboard)'/forms/'[id]'/responses/loading.tsx
git commit -m "feat: skeleton loading com loading.tsx nos segmentos do dashboard"
```

---

## Task 8: Empty States, 404 e 500 Globais

**Files:**
- Create: `apps/web/src/app/not-found.tsx`
- Create: `apps/web/src/app/error.tsx`
- Modify: `apps/web/src/app/(dashboard)/forms/[id]/responses/page.tsx` (empty state de respostas)

- [ ] **Step 1: Criar apps/web/src/app/not-found.tsx**

```typescript
// apps/web/src/app/not-found.tsx
import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-4">
      <p className="text-6xl font-bold text-gray-200 mb-4">404</p>
      <h1 className="text-xl font-semibold text-gray-800 mb-2">Página não encontrada</h1>
      <p className="text-gray-500 mb-6">O endereço que você acessou não existe ou foi removido.</p>
      <Link
        href="/dashboard"
        className="bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
      >
        Voltar ao dashboard
      </Link>
    </div>
  )
}
```

- [ ] **Step 2: Criar apps/web/src/app/error.tsx**

```typescript
// apps/web/src/app/error.tsx
'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import * as Sentry from '@sentry/nextjs'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-4">
      <p className="text-6xl font-bold text-gray-200 mb-4">500</p>
      <h1 className="text-xl font-semibold text-gray-800 mb-2">Algo deu errado</h1>
      <p className="text-gray-500 mb-6">Ocorreu um erro inesperado. Já fomos notificados.</p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          Tentar novamente
        </button>
        <Link
          href="/dashboard"
          className="border border-gray-200 px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          Voltar ao dashboard
        </Link>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Adicionar empty state de respostas melhorado**

Abrir `apps/web/src/app/(dashboard)/forms/[id]/responses/page.tsx`. Encontrar o estado atual de "sem respostas" (lista vazia) e substituir por:

```typescript
// Quando responses.length === 0, exibir:
<div className="text-center py-16 border-2 border-dashed rounded-xl">
  <div className="text-4xl mb-3">📭</div>
  <h3 className="font-medium text-gray-700 mb-1">Nenhuma resposta ainda</h3>
  <p className="text-sm text-gray-400 mb-4">
    Compartilhe o link do formulário para começar a receber respostas.
  </p>
  {form?.slug && (
    <button
      onClick={() => {
        navigator.clipboard.writeText(`${appUrl}/f/${form.slug}`)
        toast({ title: 'Link copiado!' })
      }}
      className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"
    >
      <Copy className="w-4 h-4" /> Copiar link do formulário
    </button>
  )}
</div>
```

- [ ] **Step 4: Verificar type-check**

```bash
cd apps/web && npm run type-check
```

Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/not-found.tsx apps/web/src/app/error.tsx apps/web/src/app/'(dashboard)'/forms/'[id]'/responses/page.tsx
git commit -m "feat: 404/500 customizados e empty state de respostas melhorado"
```

---

## Task 9: Favicon e Meta Tags OG para Páginas Públicas

**Files:**
- Modify: `apps/web/src/app/layout.tsx` (já atualizado na Task 3)
- Modify: `apps/web/src/app/f/[slug]/page.tsx`
- Modify: `apps/web/src/app/p/[slug]/page.tsx`

- [ ] **Step 1: Criar favicon placeholder**

Criar um arquivo SVG simples como favicon. O Next.js aceita `/public/favicon.ico` ou `/app/favicon.ico`:

```bash
# Verificar se já existe:
ls apps/web/public/ 2>/dev/null || ls apps/web/src/app/
```

Se não existir `favicon.ico`, criar um SVG temporário em `apps/web/src/app/icon.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="8" fill="#2563EB"/>
  <text x="16" y="22" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="18" fill="white">C</text>
</svg>
```

> **Nota:** Next.js 14 detecta automaticamente `app/icon.svg` e o serve como favicon. Apenas criar o arquivo na pasta `apps/web/src/app/`.

- [ ] **Step 2: Adicionar metadata dinâmica no formulário público**

Abrir `apps/web/src/app/f/[slug]/page.tsx`. Adicionar função `generateMetadata`:

```typescript
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'

export async function generateMetadata(
  { params }: { params: { slug: string } }
): Promise<Metadata> {
  // Buscar título do formulário via fetch SSR (mesma lógica já existente na página)
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
  try {
    const res = await fetch(`${apiUrl}/p/${params.slug}`, { next: { revalidate: 60 } })
    if (!res.ok) return { title: 'Formulário | Consorte Form' }
    const data = await res.json()
    const title = data.form?.title ?? 'Formulário'
    const ownerName = data.owner?.name ?? ''
    return {
      title: `${title}${ownerName ? ` — ${ownerName}` : ''}`,
      description: data.form?.welcomeMessage ?? 'Responda ao formulário interativo.',
      openGraph: {
        title,
        description: data.form?.welcomeMessage ?? 'Responda ao formulário interativo.',
      },
    }
  } catch {
    return { title: 'Formulário | Consorte Form' }
  }
}
```

- [ ] **Step 3: Adicionar metadata dinâmica no perfil público**

Abrir `apps/web/src/app/p/[slug]/page.tsx`. Adicionar função `generateMetadata` similar:

```typescript
export async function generateMetadata(
  { params }: { params: { slug: string } }
): Promise<Metadata> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
  try {
    const res = await fetch(`${apiUrl}/users/${params.slug}/public`, { next: { revalidate: 60 } })
    if (!res.ok) return { title: 'Perfil | Consorte Form' }
    const data = await res.json()
    const name = data.name ?? 'Prestador'
    return {
      title: `${name} | Consorte Form`,
      description: `Formulários de briefing de ${name}.`,
      openGraph: {
        title: `${name} | Consorte Form`,
        description: `Formulários de briefing de ${name}.`,
      },
    }
  } catch {
    return { title: 'Perfil | Consorte Form' }
  }
}
```

- [ ] **Step 4: Verificar type-check**

```bash
cd apps/web && npm run type-check
```

Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/icon.svg apps/web/src/app/f/'[slug]'/page.tsx apps/web/src/app/p/'[slug]'/page.tsx
git commit -m "feat: favicon e meta tags OG dinâmicas nas páginas públicas"
```

---

## Task 10: Performance — next/image

**Files:**
- Modify: `apps/web/src/app/f/[slug]/page.tsx` ou componente WelcomeScreen
- Modify: `apps/web/src/app/p/[slug]/page.tsx`
- Modify: `apps/web/src/app/(dashboard)/settings/profile/page.tsx`

- [ ] **Step 1: Substituir `<img>` por `<Image>` da logo no formulário público**

Abrir `apps/web/src/app/f/[slug]/page.tsx` (ou o componente WelcomeScreen). Encontrar tags `<img>` que exibem `logoUrl` e substituir:

```typescript
import Image from 'next/image'

// Antes:
// <img src={logoUrl} alt="Logo" className="w-20 h-20 rounded-full object-cover" />

// Depois:
<Image
  src={logoUrl}
  alt="Logo do prestador"
  width={80}
  height={80}
  className="rounded-full object-cover"
/>
```

- [ ] **Step 2: Substituir `<img>` no perfil público**

Abrir `apps/web/src/app/p/[slug]/page.tsx`. Aplicar a mesma substituição para foto de perfil e logos.

- [ ] **Step 3: Substituir `<img>` nas configurações de perfil**

Abrir `apps/web/src/app/(dashboard)/settings/profile/page.tsx`. Substituir exibição de avatar:

```typescript
import Image from 'next/image'

// Substituir:
<Image
  src={avatarUrl}
  alt="Foto de perfil"
  width={64}
  height={64}
  className="rounded-full object-cover"
/>
```

- [ ] **Step 4: Verificar que next.config.js tem os remotePatterns corretos**

Abrir `apps/web/next.config.js` (criado/modificado na Task 2) e confirmar que `images.remotePatterns` inclui os domínios de upload (R2, Supabase). Se necessário, adicionar:

```javascript
images: {
  remotePatterns: [
    { protocol: 'https', hostname: '**.r2.cloudflarestorage.com' },
    { protocol: 'https', hostname: '**.supabase.co' },
    { protocol: 'https', hostname: 'pub-*.r2.dev' },
  ],
},
```

- [ ] **Step 5: Verificar type-check e build**

```bash
cd apps/web && npm run type-check && npm run build 2>&1 | tail -20
```

Expected: build bem-sucedido, sem erros.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/ apps/web/next.config.js
git commit -m "perf: substituir img por next/image em todos os pontos com imagens externas"
```

---

## Task 11: README.md Final

**Files:**
- Create: `README.md` (na raiz do monorepo)

- [ ] **Step 1: Criar README.md**

```markdown
# Consorte Form

Plataforma SaaS de formulários interativos passo a passo para prestadores de serviço. Criadores de conteúdo, advogados, designers e outros profissionais usam o Consorte Form para coletar briefing de clientes de forma profissional — sem idas e vindas por WhatsApp.

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui |
| Backend | Node.js 20, Fastify 4, TypeScript, Zod |
| Banco | PostgreSQL via Supabase, Prisma ORM |
| Auth | Supabase Auth (e-mail + Google OAuth) |
| Pagamentos | Stripe (assinaturas Pro/Agência + overage R$ 3,00) |
| E-mail | Resend + BullMQ (fila assíncrona) |
| Storage | Cloudflare R2 |
| Analytics | PostHog |
| Erros | Sentry |
| Cache/Rate limit | Upstash Redis |

## Como rodar localmente

### Pré-requisitos

- Node.js 20+
- npm 9+
- Conta Supabase (banco + auth)
- Conta Stripe (chaves de teste)

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar variáveis de ambiente

```bash
cp .env.example .env.local
```

Preencher as variáveis conforme o `.env.example`. As mínimas para rodar localmente:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=
DIRECT_URL=
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### 3. Gerar o Prisma e rodar migrations

```bash
cd apps/api
npm run db:migrate
npm run db:generate
```

### 4. Rodar o seed de templates

```bash
cd apps/api
npm run db:seed
```

Insere os 10 templates pré-prontos por nicho (influencer, advogado, produtor de eventos, etc.).

### 5. Iniciar os apps

Em dois terminais separados:

```bash
# Terminal 1 — API (porta 3001)
cd apps/api
npm run dev

# Terminal 2 — Web (porta 3000)
cd apps/web
npm run dev
```

Acesse: http://localhost:3000

### 6. Webhooks Stripe (desenvolvimento)

```bash
stripe listen --forward-to localhost:3001/webhooks/stripe
```

Use o cartão de teste `4242 4242 4242 4242` com qualquer data futura e CVV.

## Testes

```bash
cd apps/api
npm test
```

27 testes unitários cobrindo: lógica condicional, serviço de formulários, respostas, pagamentos, assinaturas.

## Estrutura de pastas

```
consorte-form/
├── apps/
│   ├── web/          # Next.js 14 — dashboard + formulário público
│   └── api/          # Fastify — API REST + webhooks
│       └── prisma/   # Schema, migrations e seed
└── packages/
    └── types/        # Tipos compartilhados (QuestionType, Plan, etc.)
```

## Comandos úteis

| Comando | O que faz |
|---|---|
| `npm run dev` (raiz) | Inicia web + api em paralelo |
| `cd apps/api && npm run db:migrate` | Roda migrations do Prisma |
| `cd apps/api && npm run db:seed` | Insere os 10 templates |
| `cd apps/api && npm test` | Roda os 27 testes Vitest |
| `stripe listen --forward-to localhost:3001/webhooks/stripe` | Encaminha eventos Stripe locais |
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: README.md final com setup, stack e comandos úteis"
```

---

## Self-Review — Cobertura do Spec

| Requisito da Etapa 7 | Coberto em |
|---|---|
| Sentry no backend (@sentry/node) | Task 1 |
| Sentry no frontend (@sentry/nextjs) | Task 2 |
| Capturar userId no contexto Sentry | Task 1, Step 3 |
| PostHog inicializado no layout | Task 3 |
| posthog.identify após login | Task 3, Step 5 |
| Evento form_created | Task 4, Step 2 |
| Evento form_published | Task 4, Step 4 |
| Evento response_received | Não instrumentado no frontend (ocorre no backend, fora do escopo) |
| Evento overage_paid | Task 4, Step 5 |
| Evento upgrade_started | Task 4, Step 6 |
| Evento upgrade_completed | Task 4, Step 7 |
| Evento template_selected | Task 4, Step 3 |
| Exportação CSV (já existia) | ✅ Já implementado na Etapa 6 |
| Exportação PDF | Task 5 |
| Botão exportar desabilitado para Free | Task 5, Step 3 |
| Pré-visualização ao vivo (Pro/Agência) | Task 6 |
| Aviso de upgrade para Free no preview | Task 6, Step 1 |
| Skeleton loading | Task 7 |
| loading.tsx nos segmentos principais | Task 7 |
| Empty state formulários | já existe na página de forms |
| Empty state respostas | Task 8, Step 3 |
| 404 customizado | Task 8, Step 1 |
| 500 customizado com Sentry | Task 8, Step 2 |
| Favicon | Task 9, Step 1 |
| Meta tags OG páginas públicas | Task 9, Steps 2-3 |
| next/image para todas as imagens | Task 10 |
| README.md | Task 11 |

> **Gaps identificados:** O evento `response_received` é disparado pelo backend (já existente no POST /p/:slug/submit) — não há frontend para instrumentar. O spec diz "NÃO capturar conteúdo de respostas", então a instrumentação no backend estaria fora do escopo do PostHog no frontend. Gap aceitável.
