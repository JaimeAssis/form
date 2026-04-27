# Etapa 4 — Formulário Público (Experiência do Respondente)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar o formulário público passo a passo (`/f/[slug]`) que o cliente final preenche, incluindo os endpoints de API `GET /p/:slug` e `POST /p/:slug/submit` com lógica de quarentena (plano Free) e rate limiting.

**Architecture:** Um novo arquivo de rotas `public.ts` na API (sem autenticação) expõe o formulário publicado por slug e recebe submissões. No frontend, `/f/[slug]/page.tsx` é um Server Component que busca os dados do formulário e renderiza `FormPublicClient` (Client Component), que gerencia o estado de máquina (welcome → perguntas → sucesso). A lógica condicional é avaliada no cliente com funções puras em `formPublicLogic.ts`; o backend re-valida perguntas obrigatórias visíveis antes de persistir.

**Tech Stack:** Fastify 4, Prisma, Zod, Vitest (backend) · Next.js 14 App Router, TypeScript, Tailwind CSS, shadcn/ui, `@consorte/types` (frontend)

---

## File Map

| Ação | Caminho |
|------|---------|
| CREATE | `apps/api/src/services/responseService.ts` |
| CREATE | `apps/api/src/services/responseService.test.ts` |
| CREATE | `apps/api/src/routes/public.ts` |
| MODIFY | `apps/api/src/index.ts` |
| CREATE | `apps/web/src/lib/formPublicLogic.ts` |
| CREATE | `apps/web/src/components/form-public/types.ts` |
| CREATE | `apps/web/src/components/form-public/ProgressBar.tsx` |
| CREATE | `apps/web/src/components/form-public/WelcomeScreen.tsx` |
| CREATE | `apps/web/src/components/form-public/ThankYouScreen.tsx` |
| CREATE | `apps/web/src/components/form-public/PausedScreen.tsx` |
| CREATE | `apps/web/src/components/form-public/AnswerInput.tsx` |
| CREATE | `apps/web/src/components/form-public/QuestionStep.tsx` |
| CREATE | `apps/web/src/components/form-public/FormPublicClient.tsx` |
| CREATE | `apps/web/src/app/f/[slug]/page.tsx` |
| CREATE | `apps/web/src/app/f/[slug]/not-found.tsx` |

---

## Task 1: Escrever testes com falha para responseService (TDD)

**Files:**
- Create: `apps/api/src/services/responseService.test.ts`

- [ ] **Step 1.1: Criar o arquivo de testes**

```typescript
// apps/api/src/services/responseService.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { countMonthlyUnlockedResponses, saveResponse } from './responseService'

vi.mock('../lib/prisma', () => ({
  prisma: {
    response: {
      count: vi.fn(),
      create: vi.fn(),
    },
  },
}))

import { prisma } from '../lib/prisma'

const mockCount = vi.mocked(prisma.response.count)
const mockCreate = vi.mocked(prisma.response.create)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('countMonthlyUnlockedResponses', () => {
  it('conta apenas respostas UNLOCKED do mês corrente para o formulário', async () => {
    mockCount.mockResolvedValue(7)
    const result = await countMonthlyUnlockedResponses('form-123')
    expect(result).toBe(7)
    expect(mockCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          formId: 'form-123',
          status: 'UNLOCKED',
        }),
      })
    )
  })
})

describe('saveResponse', () => {
  it('salva como UNLOCKED quando plano é PRO', async () => {
    mockCount.mockResolvedValue(99)
    mockCreate.mockResolvedValue({ id: 'resp-1', status: 'UNLOCKED' } as any)

    const result = await saveResponse({
      formId: 'form-1',
      ownerPlan: 'PRO',
      answers: [{ questionId: 'q-1', value: 'Sim' }],
    })

    expect(mockCount).not.toHaveBeenCalled()
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'UNLOCKED' }),
      })
    )
    expect(result.status).toBe('UNLOCKED')
  })

  it('salva como UNLOCKED quando plano é AGENCY', async () => {
    mockCreate.mockResolvedValue({ id: 'resp-2', status: 'UNLOCKED' } as any)

    await saveResponse({
      formId: 'form-1',
      ownerPlan: 'AGENCY',
      answers: [],
    })

    expect(mockCount).not.toHaveBeenCalled()
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'UNLOCKED' }),
      })
    )
  })

  it('salva como UNLOCKED quando plano FREE e count < 10', async () => {
    mockCount.mockResolvedValue(5)
    mockCreate.mockResolvedValue({ id: 'resp-3', status: 'UNLOCKED' } as any)

    await saveResponse({
      formId: 'form-1',
      ownerPlan: 'FREE',
      answers: [{ questionId: 'q-1', value: 'Texto' }],
    })

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'UNLOCKED' }),
      })
    )
  })

  it('salva como QUARANTINED quando plano FREE e count >= 10', async () => {
    mockCount.mockResolvedValue(10)
    mockCreate.mockResolvedValue({ id: 'resp-4', status: 'QUARANTINED' } as any)

    await saveResponse({
      formId: 'form-1',
      ownerPlan: 'FREE',
      answers: [{ questionId: 'q-1', value: 'Texto' }],
    })

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'QUARANTINED' }),
      })
    )
  })

  it('inclui respondentName e respondentEmail quando fornecidos', async () => {
    mockCreate.mockResolvedValue({ id: 'resp-5', status: 'UNLOCKED' } as any)

    await saveResponse({
      formId: 'form-1',
      ownerPlan: 'PRO',
      respondentName: 'João Silva',
      respondentEmail: 'joao@exemplo.com',
      answers: [],
    })

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          respondentName: 'João Silva',
          respondentEmail: 'joao@exemplo.com',
        }),
      })
    )
  })

  it('persiste as answers vinculadas à resposta', async () => {
    mockCreate.mockResolvedValue({ id: 'resp-6', status: 'UNLOCKED' } as any)

    await saveResponse({
      formId: 'form-1',
      ownerPlan: 'PRO',
      answers: [
        { questionId: 'q-1', value: 'Sim' },
        { questionId: 'q-2', value: '["Opção 1","Opção 3"]' },
      ],
    })

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          answers: {
            create: [
              { questionId: 'q-1', value: 'Sim' },
              { questionId: 'q-2', value: '["Opção 1","Opção 3"]' },
            ],
          },
        }),
      })
    )
  })
})
```

- [ ] **Step 1.2: Rodar os testes para confirmar que falham (arquivo não existe)**

```bash
cd "apps/api" && npx vitest run src/services/responseService.test.ts
```

Resultado esperado: FAIL — `Cannot find module './responseService'`

---

## Task 2: Implementar responseService para passar nos testes

**Files:**
- Create: `apps/api/src/services/responseService.ts`

- [ ] **Step 2.1: Criar responseService.ts**

```typescript
// apps/api/src/services/responseService.ts
import { prisma } from '../lib/prisma'

export async function countMonthlyUnlockedResponses(formId: string): Promise<number> {
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  return prisma.response.count({
    where: {
      formId,
      status: 'UNLOCKED',
      createdAt: { gte: startOfMonth },
    },
  })
}

interface SaveResponseInput {
  formId: string
  ownerPlan: string
  respondentName?: string
  respondentEmail?: string
  answers: Array<{ questionId: string; value: string }>
}

export async function saveResponse(input: SaveResponseInput) {
  const { formId, ownerPlan, respondentName, respondentEmail, answers } = input

  let status: 'UNLOCKED' | 'QUARANTINED' = 'UNLOCKED'

  if (ownerPlan === 'FREE') {
    const count = await countMonthlyUnlockedResponses(formId)
    if (count >= 10) {
      status = 'QUARANTINED'
    }
  }

  return prisma.response.create({
    data: {
      formId,
      respondentName: respondentName ?? null,
      respondentEmail: respondentEmail ?? null,
      status,
      answers: {
        create: answers.map(a => ({ questionId: a.questionId, value: a.value })),
      },
    },
    include: { answers: true },
  })
}
```

- [ ] **Step 2.2: Rodar os testes para confirmar que passam**

```bash
cd "apps/api" && npx vitest run src/services/responseService.test.ts
```

Resultado esperado: PASS — 6 testes passando

- [ ] **Step 2.3: Commit**

```bash
git add apps/api/src/services/responseService.ts apps/api/src/services/responseService.test.ts
git commit -m "feat: responseService com lógica de overage/quarentena (TDD)"
```

---

## Task 3: Criar rotas públicas (GET /p/:slug e POST /p/:slug/submit)

**Files:**
- Create: `apps/api/src/routes/public.ts`

- [ ] **Step 3.1: Criar public.ts**

```typescript
// apps/api/src/routes/public.ts
import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { saveResponse } from '../services/responseService'

// Rate limiter em memória: máx 10 submissões por IP por hora
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)
  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 3_600_000 })
    return true
  }
  if (entry.count >= 10) return false
  entry.count++
  return true
}

type QuestionWithCondition = {
  id: string
  required: boolean
  condition: { triggerQuestionId: string; triggerValue: string } | null
}

function isConditionMet(
  question: QuestionWithCondition,
  answersMap: Map<string, string>
): boolean {
  if (!question.condition) return true
  const raw = answersMap.get(question.condition.triggerQuestionId)
  if (raw === undefined) return false
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed.includes(question.condition.triggerValue)
  } catch {
    // não é JSON — comparação direta
  }
  return raw === question.condition.triggerValue
}

const submitSchema = z.object({
  respondentName: z.string().max(200).optional(),
  respondentEmail: z.string().email().max(200).optional().or(z.literal('')),
  answers: z.array(
    z.object({
      questionId: z.string().uuid(),
      value: z.string(),
    })
  ),
})

export async function publicRoutes(app: FastifyInstance) {
  // GET /p/:slug — retorna formulário publicado (sem autenticação)
  app.get('/p/:slug', async (request, reply) => {
    const { slug } = request.params as { slug: string }

    const form = await prisma.form.findUnique({
      where: { slug },
      include: {
        questions: {
          include: { condition: true },
          orderBy: { order: 'asc' },
        },
        user: { select: { name: true, avatarUrl: true, slug: true } },
      },
    })

    if (!form) {
      return reply.status(404).send({ error: 'Formulário não encontrado' })
    }

    if (form.status === 'PAUSED') {
      return reply.status(404).send({ error: 'Formulário pausado', paused: true })
    }

    if (form.status !== 'PUBLISHED') {
      return reply.status(404).send({ error: 'Formulário não disponível' })
    }

    return reply.send(form)
  })

  // POST /p/:slug/submit — recebe respostas do respondente
  app.post('/p/:slug/submit', async (request, reply) => {
    const { slug } = request.params as { slug: string }

    const ip = request.ip || 'unknown'
    if (!checkRateLimit(ip)) {
      return reply
        .status(429)
        .send({ error: 'Muitas submissões. Tente novamente em 1 hora.' })
    }

    const form = await prisma.form.findUnique({
      where: { slug },
      include: {
        questions: {
          include: { condition: true },
          orderBy: { order: 'asc' },
        },
        user: { select: { plan: true } },
      },
    })

    if (!form || form.status !== 'PUBLISHED') {
      return reply.status(404).send({ error: 'Formulário não disponível' })
    }

    let body: z.infer<typeof submitSchema>
    try {
      body = submitSchema.parse(request.body)
    } catch (err: any) {
      return reply.status(400).send({ error: 'Dados inválidos', details: err.errors })
    }

    const answersMap = new Map(body.answers.map(a => [a.questionId, a.value]))

    // Validar perguntas obrigatórias visíveis
    for (const question of form.questions) {
      if (!question.required) continue
      if (!isConditionMet(question, answersMap)) continue // oculta — não valida

      const answer = answersMap.get(question.id)
      const isEmpty = !answer || answer.trim() === '' || answer === '[]'
      if (isEmpty) {
        return reply
          .status(400)
          .send({ error: 'Pergunta obrigatória não respondida', questionId: question.id })
      }
    }

    await saveResponse({
      formId: form.id,
      ownerPlan: form.user.plan,
      respondentName: body.respondentName,
      respondentEmail: body.respondentEmail || undefined,
      answers: body.answers,
    })

    return reply.status(200).send({ ok: true })
  })
}
```

- [ ] **Step 3.2: Verificar tipos com tsc**

```bash
cd "apps/api" && npx tsc --noEmit
```

Resultado esperado: sem erros de tipo

---

## Task 4: Registrar publicRoutes no servidor e rodar testes completos

**Files:**
- Modify: `apps/api/src/index.ts`

- [ ] **Step 4.1: Adicionar import e registro em index.ts**

Abrir `apps/api/src/index.ts`. Após a linha `import { questionRoutes } from './routes/questions'`, adicionar:

```typescript
import { publicRoutes } from './routes/public'
```

Após `server.register(questionRoutes)`, adicionar:

```typescript
server.register(publicRoutes)
```

O arquivo final deve ficar:

```typescript
import Fastify from 'fastify'
import cors from '@fastify/cors'
import 'dotenv/config'
import { authRoutes } from './routes/auth'
import { userRoutes } from './routes/users'
import { formRoutes } from './routes/forms'
import { questionRoutes } from './routes/questions'
import { publicRoutes } from './routes/public'

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

- [ ] **Step 4.2: Rodar todos os testes da API**

```bash
cd "apps/api" && npx vitest run
```

Resultado esperado: todos os testes passam

- [ ] **Step 4.3: Type-check da API**

```bash
cd "apps/api" && npx tsc --noEmit
```

Resultado esperado: sem erros

- [ ] **Step 4.4: Commit**

```bash
git add apps/api/src/routes/public.ts apps/api/src/index.ts
git commit -m "feat: rotas públicas GET /p/:slug e POST /p/:slug/submit com rate limiting e quarentena"
```

---

## Task 5: Criar helpers de lógica condicional no frontend

**Files:**
- Create: `apps/web/src/lib/formPublicLogic.ts`
- Create: `apps/web/src/components/form-public/types.ts`

- [ ] **Step 5.1: Criar types.ts para o formulário público**

```typescript
// apps/web/src/components/form-public/types.ts
import { Question } from '@consorte/types'

export interface PublicFormUser {
  name: string
  avatarUrl: string | null
  slug: string
}

export interface PublicFormData {
  id: string
  title: string
  description: string | null
  slug: string
  status: string
  brandColor: string | null
  logoUrl: string | null
  welcomeTitle: string | null
  welcomeMessage: string | null
  thankYouTitle: string | null
  thankYouMessage: string | null
  questions: Question[]
  user: PublicFormUser
}
```

- [ ] **Step 5.2: Criar formPublicLogic.ts**

```typescript
// apps/web/src/lib/formPublicLogic.ts
import { Question } from '@consorte/types'

/**
 * Avalia se a condição de exibição de uma pergunta é atendida.
 * Sem condição → sempre visível.
 * Para MULTIPLE_SELECT o valor armazenado é JSON array: verifica inclusão.
 */
export function isConditionMet(
  question: Question,
  answers: Record<string, string>
): boolean {
  if (!question.condition) return true

  const { triggerQuestionId, triggerValue } = question.condition
  const raw = answers[triggerQuestionId]
  if (raw === undefined) return false

  try {
    const parsed: unknown = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed.includes(triggerValue)
  } catch {
    // não é JSON — comparação direta
  }

  return raw === triggerValue
}

/** Retorna apenas as perguntas visíveis dado o estado atual das respostas. */
export function getVisibleQuestions(
  questions: Question[],
  answers: Record<string, string>
): Question[] {
  return questions.filter(q => isConditionMet(q, answers))
}
```

- [ ] **Step 5.3: Verificar tipos**

```bash
cd "apps/web" && npx tsc --noEmit
```

Resultado esperado: sem erros

---

## Task 6: Criar componentes primitivos de UI (ProgressBar, WelcomeScreen, ThankYouScreen, PausedScreen)

**Files:**
- Create: `apps/web/src/components/form-public/ProgressBar.tsx`
- Create: `apps/web/src/components/form-public/WelcomeScreen.tsx`
- Create: `apps/web/src/components/form-public/ThankYouScreen.tsx`
- Create: `apps/web/src/components/form-public/PausedScreen.tsx`

- [ ] **Step 6.1: Criar ProgressBar.tsx**

```tsx
// apps/web/src/components/form-public/ProgressBar.tsx
interface ProgressBarProps {
  current: number  // índice 0-based da pergunta atual
  total: number    // total de perguntas visíveis
  brandColor?: string | null
}

export function ProgressBar({ current, total, brandColor }: ProgressBarProps) {
  const percent = total === 0 ? 0 : Math.round(((current + 1) / total) * 100)

  return (
    <div className="w-full">
      <div className="flex justify-between text-xs text-muted-foreground mb-1">
        <span>Pergunta {current + 1} de {total}</span>
        <span>{percent}%</span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300 ease-out"
          style={{
            width: `${percent}%`,
            backgroundColor: brandColor || undefined,
          }}
          className={!brandColor ? 'h-full rounded-full bg-primary transition-all duration-300 ease-out' : undefined}
        />
      </div>
    </div>
  )
}
```

**Nota:** Há conflito de `className` acima. Usar a versão corrigida:

```tsx
// apps/web/src/components/form-public/ProgressBar.tsx
interface ProgressBarProps {
  current: number
  total: number
  brandColor?: string | null
}

export function ProgressBar({ current, total, brandColor }: ProgressBarProps) {
  const percent = total === 0 ? 0 : Math.round(((current + 1) / total) * 100)

  return (
    <div className="w-full">
      <div className="flex justify-between text-xs text-muted-foreground mb-1">
        <span>Pergunta {current + 1} de {total}</span>
        <span>{percent}%</span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300 ease-out bg-primary"
          style={{
            width: `${percent}%`,
            ...(brandColor ? { backgroundColor: brandColor } : {}),
          }}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 6.2: Criar WelcomeScreen.tsx**

```tsx
// apps/web/src/components/form-public/WelcomeScreen.tsx
import { Button } from '@/components/ui/button'

interface WelcomeScreenProps {
  title: string
  message: string | null
  welcomeTitle: string | null
  welcomeMessage: string | null
  logoUrl: string | null
  userAvatarUrl: string | null
  userName: string
  brandColor: string | null
  onStart: () => void
}

export function WelcomeScreen({
  title,
  welcomeTitle,
  welcomeMessage,
  logoUrl,
  userAvatarUrl,
  userName,
  brandColor,
  onStart,
}: WelcomeScreenProps) {
  const displayLogo = logoUrl || userAvatarUrl
  const displayTitle = welcomeTitle || title
  const displayMessage = welcomeMessage

  return (
    <div className="flex flex-col items-center text-center max-w-md mx-auto px-4 py-12">
      {displayLogo ? (
        <img
          src={displayLogo}
          alt={userName}
          className="w-16 h-16 rounded-full object-cover mb-6"
        />
      ) : (
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-2xl font-bold text-muted-foreground mb-6">
          {userName.charAt(0).toUpperCase()}
        </div>
      )}

      <h1 className="text-2xl font-bold mb-3">{displayTitle}</h1>

      {displayMessage && (
        <p className="text-muted-foreground mb-8 leading-relaxed">{displayMessage}</p>
      )}

      {!displayMessage && <div className="mb-8" />}

      <Button
        size="lg"
        className="w-full max-w-xs text-base"
        style={brandColor ? { backgroundColor: brandColor, borderColor: brandColor } : {}}
        onClick={onStart}
      >
        Começar →
      </Button>
    </div>
  )
}
```

- [ ] **Step 6.3: Criar ThankYouScreen.tsx**

```tsx
// apps/web/src/components/form-public/ThankYouScreen.tsx
import { CheckCircle2 } from 'lucide-react'

interface ThankYouScreenProps {
  thankYouTitle: string | null
  thankYouMessage: string | null
}

export function ThankYouScreen({ thankYouTitle, thankYouMessage }: ThankYouScreenProps) {
  return (
    <div className="flex flex-col items-center text-center max-w-md mx-auto px-4 py-16">
      <CheckCircle2 className="w-14 h-14 text-green-500 mb-6" strokeWidth={1.5} />
      <h2 className="text-2xl font-bold mb-3">
        {thankYouTitle || 'Obrigado!'}
      </h2>
      <p className="text-muted-foreground leading-relaxed">
        {thankYouMessage || 'Suas respostas foram enviadas com sucesso.'}
      </p>
    </div>
  )
}
```

- [ ] **Step 6.4: Criar PausedScreen.tsx**

```tsx
// apps/web/src/components/form-public/PausedScreen.tsx
import { PauseCircle } from 'lucide-react'

export function PausedScreen() {
  return (
    <div className="flex flex-col items-center text-center max-w-md mx-auto px-4 py-16">
      <PauseCircle className="w-14 h-14 text-muted-foreground mb-6" strokeWidth={1.5} />
      <h2 className="text-2xl font-bold mb-3">Formulário indisponível</h2>
      <p className="text-muted-foreground">
        Este formulário não está disponível no momento.
      </p>
    </div>
  )
}
```

- [ ] **Step 6.5: Type-check**

```bash
cd "apps/web" && npx tsc --noEmit
```

Resultado esperado: sem erros

---

## Task 7: Criar AnswerInput — renderiza input pelo tipo da pergunta

**Files:**
- Create: `apps/web/src/components/form-public/AnswerInput.tsx`

- [ ] **Step 7.1: Criar AnswerInput.tsx**

```tsx
// apps/web/src/components/form-public/AnswerInput.tsx
'use client'

import { Question } from '@consorte/types'
import { cn } from '@/lib/utils'

interface AnswerInputProps {
  question: Question
  value: string
  onChange: (value: string) => void
  brandColor?: string | null
}

export function AnswerInput({ question, value, onChange, brandColor }: AnswerInputProps) {
  switch (question.type) {
    case 'SHORT_TEXT':
      return (
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="Sua resposta..."
          className="w-full border rounded-lg px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary bg-background"
          autoFocus
        />
      )

    case 'LONG_TEXT':
      return (
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="Sua resposta..."
          rows={4}
          className="w-full border rounded-lg px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary bg-background resize-none"
          autoFocus
        />
      )

    case 'MULTIPLE_CHOICE': {
      return (
        <div className="space-y-2">
          {question.options.map(option => {
            const selected = value === option
            return (
              <button
                key={option}
                type="button"
                onClick={() => onChange(option)}
                className={cn(
                  'w-full text-left px-4 py-3 rounded-lg border text-base transition-colors',
                  selected
                    ? 'border-primary bg-primary/10 font-medium'
                    : 'border-border hover:border-primary/50 hover:bg-muted/50'
                )}
                style={selected && brandColor
                  ? { borderColor: brandColor, backgroundColor: `${brandColor}18` }
                  : {}
                }
              >
                {option}
              </button>
            )
          })}
        </div>
      )
    }

    case 'MULTIPLE_SELECT': {
      const selectedValues: string[] = (() => {
        try { return JSON.parse(value || '[]') as string[] }
        catch { return [] }
      })()

      const toggle = (option: string) => {
        const next = selectedValues.includes(option)
          ? selectedValues.filter(v => v !== option)
          : [...selectedValues, option]
        onChange(JSON.stringify(next))
      }

      return (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground mb-3">Selecione todas que se aplicam</p>
          {question.options.map(option => {
            const selected = selectedValues.includes(option)
            return (
              <button
                key={option}
                type="button"
                onClick={() => toggle(option)}
                className={cn(
                  'w-full text-left px-4 py-3 rounded-lg border text-base transition-colors flex items-center gap-3',
                  selected
                    ? 'border-primary bg-primary/10 font-medium'
                    : 'border-border hover:border-primary/50 hover:bg-muted/50'
                )}
                style={selected && brandColor
                  ? { borderColor: brandColor, backgroundColor: `${brandColor}18` }
                  : {}
                }
              >
                <span
                  className={cn(
                    'w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center',
                    selected ? 'border-primary bg-primary' : 'border-muted-foreground'
                  )}
                  style={selected && brandColor ? { borderColor: brandColor, backgroundColor: brandColor } : {}}
                >
                  {selected && (
                    <svg viewBox="0 0 10 10" className="w-2.5 h-2.5 text-white fill-white">
                      <path d="M1.5 5l2.5 2.5L8.5 2" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                {option}
              </button>
            )
          })}
        </div>
      )
    }

    case 'SCALE': {
      const numValue = value ? parseInt(value, 10) : null
      return (
        <div>
          <div className="flex gap-2 justify-between">
            {[1, 2, 3, 4, 5].map(n => {
              const selected = numValue === n
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => onChange(String(n))}
                  className={cn(
                    'flex-1 aspect-square rounded-lg border text-base font-medium transition-colors min-h-[48px]',
                    selected
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border hover:border-primary/50 hover:bg-muted/50'
                  )}
                  style={selected && brandColor
                    ? { borderColor: brandColor, backgroundColor: brandColor }
                    : {}
                  }
                >
                  {n}
                </button>
              )
            })}
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-2 px-1">
            <span>{question.scaleMin || '1'}</span>
            <span>{question.scaleMax || '5'}</span>
          </div>
        </div>
      )
    }

    default:
      return null
  }
}
```

- [ ] **Step 7.2: Type-check**

```bash
cd "apps/web" && npx tsc --noEmit
```

Resultado esperado: sem erros

---

## Task 8: Criar QuestionStep — tela de uma pergunta

**Files:**
- Create: `apps/web/src/components/form-public/QuestionStep.tsx`

- [ ] **Step 8.1: Criar QuestionStep.tsx**

```tsx
// apps/web/src/components/form-public/QuestionStep.tsx
'use client'

import { Question } from '@consorte/types'
import { Button } from '@/components/ui/button'
import { AnswerInput } from './AnswerInput'
import { ProgressBar } from './ProgressBar'
import { ChevronLeft } from 'lucide-react'

interface QuestionStepProps {
  question: Question
  questionIndex: number    // índice 0-based nas perguntas visíveis
  totalVisible: number
  value: string
  error: string | null
  onChange: (value: string) => void
  onNext: () => void
  onBack: () => void
  isFirst: boolean
  isLast: boolean
  isSubmitting: boolean
  brandColor: string | null
}

export function QuestionStep({
  question,
  questionIndex,
  totalVisible,
  value,
  error,
  onChange,
  onNext,
  onBack,
  isFirst,
  isLast,
  isSubmitting,
  brandColor,
}: QuestionStepProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && question.type !== 'LONG_TEXT') {
      e.preventDefault()
      onNext()
    }
  }

  return (
    <div
      className="flex flex-col min-h-screen px-4 py-6 max-w-xl mx-auto w-full"
      onKeyDown={handleKeyDown}
    >
      {/* Header com progresso */}
      <div className="mb-8">
        <ProgressBar
          current={questionIndex}
          total={totalVisible}
          brandColor={brandColor}
        />
      </div>

      {/* Conteúdo da pergunta */}
      <div className="flex-1">
        <div className="mb-6">
          <h2 className="text-xl font-semibold leading-snug">
            {question.title || 'Pergunta'}
            {question.required && (
              <span className="text-red-500 ml-1" aria-label="obrigatória">*</span>
            )}
          </h2>
          {question.description && (
            <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
              {question.description}
            </p>
          )}
        </div>

        <AnswerInput
          question={question}
          value={value}
          onChange={onChange}
          brandColor={brandColor}
        />

        {error && (
          <p className="mt-3 text-sm text-red-500" role="alert">
            {error}
          </p>
        )}
      </div>

      {/* Navegação */}
      <div className="flex items-center justify-between gap-4 mt-8 pt-4">
        {!isFirst ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="flex items-center gap-1"
            disabled={isSubmitting}
          >
            <ChevronLeft className="w-4 h-4" />
            Voltar
          </Button>
        ) : (
          <div />
        )}

        <Button
          size="lg"
          onClick={onNext}
          disabled={isSubmitting}
          className="min-w-[140px]"
          style={brandColor ? { backgroundColor: brandColor, borderColor: brandColor } : {}}
        >
          {isSubmitting
            ? 'Enviando...'
            : isLast
            ? 'Enviar'
            : 'Próximo →'}
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 8.2: Type-check**

```bash
cd "apps/web" && npx tsc --noEmit
```

Resultado esperado: sem erros

---

## Task 9: Criar FormPublicClient — máquina de estados principal

**Files:**
- Create: `apps/web/src/components/form-public/FormPublicClient.tsx`

- [ ] **Step 9.1: Criar FormPublicClient.tsx**

```tsx
// apps/web/src/components/form-public/FormPublicClient.tsx
'use client'

import { useState, useCallback } from 'react'
import { PublicFormData } from './types'
import { getVisibleQuestions } from '@/lib/formPublicLogic'
import { WelcomeScreen } from './WelcomeScreen'
import { QuestionStep } from './QuestionStep'
import { ThankYouScreen } from './ThankYouScreen'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

type Stage = 'welcome' | 'questions' | 'success'

interface FormPublicClientProps {
  form: PublicFormData
}

export function FormPublicClient({ form }: FormPublicClientProps) {
  const [stage, setStage] = useState<Stage>('welcome')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [currentError, setCurrentError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const visibleQuestions = getVisibleQuestions(form.questions, answers)
  const currentQuestion = visibleQuestions[currentIndex]
  const isFirst = currentIndex === 0
  const isLast = currentIndex === visibleQuestions.length - 1

  const getCurrentValue = useCallback(
    (questionId: string) => answers[questionId] ?? '',
    [answers]
  )

  const handleChange = useCallback((questionId: string, value: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }))
    setCurrentError(null)
  }, [])

  const validateCurrent = (): boolean => {
    if (!currentQuestion) return true
    if (!currentQuestion.required) return true

    const value = answers[currentQuestion.id] ?? ''
    const isEmpty = value.trim() === '' || value === '[]'
    if (isEmpty) {
      setCurrentError('Esta pergunta é obrigatória.')
      return false
    }
    return true
  }

  const handleNext = useCallback(async () => {
    if (!validateCurrent()) return
    setCurrentError(null)

    if (isLast) {
      // Submeter formulário
      setIsSubmitting(true)
      setSubmitError(null)

      // Construir payload apenas com perguntas visíveis que têm resposta
      const payload = {
        answers: visibleQuestions
          .filter(q => answers[q.id] !== undefined && answers[q.id] !== '')
          .map(q => ({ questionId: q.id, value: answers[q.id] })),
      }

      try {
        const res = await fetch(`${API_URL}/p/${form.slug}/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || 'Erro ao enviar respostas')
        }

        setStage('success')
      } catch (err: any) {
        setSubmitError(err.message || 'Algo deu errado. Tente novamente.')
      } finally {
        setIsSubmitting(false)
      }
      return
    }

    // Avançar para próxima pergunta
    setCurrentIndex(prev => {
      // Recalcular questões visíveis com o estado atual de respostas
      const nextVisible = getVisibleQuestions(form.questions, answers)
      const nextIndex = prev + 1
      return Math.min(nextIndex, nextVisible.length - 1)
    })
  }, [currentQuestion, isLast, answers, visibleQuestions, form.slug])

  const handleBack = useCallback(() => {
    setCurrentError(null)
    setCurrentIndex(prev => Math.max(0, prev - 1))
  }, [])

  if (stage === 'welcome') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <WelcomeScreen
          title={form.title}
          message={form.welcomeMessage}
          welcomeTitle={form.welcomeTitle}
          welcomeMessage={form.welcomeMessage}
          logoUrl={form.logoUrl}
          userAvatarUrl={form.user.avatarUrl}
          userName={form.user.name}
          brandColor={form.brandColor}
          onStart={() => {
            setStage('questions')
            setCurrentIndex(0)
          }}
        />
      </div>
    )
  }

  if (stage === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <ThankYouScreen
          thankYouTitle={form.thankYouTitle}
          thankYouMessage={form.thankYouMessage}
        />
      </div>
    )
  }

  if (!currentQuestion) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Nenhuma pergunta disponível.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {submitError && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2 rounded-lg shadow z-50">
          {submitError}
        </div>
      )}
      <div
        key={currentQuestion.id}
        className="animate-in fade-in slide-in-from-right-4 duration-200"
      >
        <QuestionStep
          question={currentQuestion}
          questionIndex={currentIndex}
          totalVisible={visibleQuestions.length}
          value={getCurrentValue(currentQuestion.id)}
          error={currentError}
          onChange={value => handleChange(currentQuestion.id, value)}
          onNext={handleNext}
          onBack={handleBack}
          isFirst={isFirst}
          isLast={isLast}
          isSubmitting={isSubmitting}
          brandColor={form.brandColor}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 9.2: Type-check**

```bash
cd "apps/web" && npx tsc --noEmit
```

Resultado esperado: sem erros (se houver erro relacionado a `animate-in` do Tailwind, é apenas CSS — não afeta compilação TypeScript)

---

## Task 10: Criar página /f/[slug] (Server Component) e not-found.tsx

**Files:**
- Create: `apps/web/src/app/f/[slug]/page.tsx`
- Create: `apps/web/src/app/f/[slug]/not-found.tsx`

- [ ] **Step 10.1: Criar not-found.tsx**

```tsx
// apps/web/src/app/f/[slug]/not-found.tsx
import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-center px-4">
      <h1 className="text-3xl font-bold mb-2">Formulário não encontrado</h1>
      <p className="text-muted-foreground mb-6">
        O formulário que você está procurando não existe ou foi removido.
      </p>
      <Link href="/" className="text-sm text-primary hover:underline">
        Ir para o início
      </Link>
    </div>
  )
}
```

- [ ] **Step 10.2: Criar page.tsx**

```tsx
// apps/web/src/app/f/[slug]/page.tsx
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { FormPublicClient } from '@/components/form-public/FormPublicClient'
import { PausedScreen } from '@/components/form-public/PausedScreen'
import { PublicFormData } from '@/components/form-public/types'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

async function getForm(slug: string): Promise<PublicFormData | null | 'paused'> {
  const res = await fetch(`${API_URL}/p/${slug}`, { cache: 'no-store' })

  if (res.status === 404) {
    try {
      const data = await res.json()
      if (data.paused) return 'paused'
    } catch {}
    return null
  }

  if (!res.ok) return null
  return res.json()
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string }
}): Promise<Metadata> {
  const form = await getForm(params.slug)
  if (!form || form === 'paused') return { title: 'Formulário' }
  return {
    title: form.title,
    description: form.description || `Preencha o formulário ${form.title}`,
  }
}

export default async function FormPublicPage({
  params,
}: {
  params: { slug: string }
}) {
  const form = await getForm(params.slug)

  if (form === 'paused') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <PausedScreen />
      </div>
    )
  }

  if (!form) {
    notFound()
  }

  return <FormPublicClient form={form} />
}
```

- [ ] **Step 10.3: Type-check completo do web**

```bash
cd "apps/web" && npx tsc --noEmit
```

Resultado esperado: sem erros de tipo

- [ ] **Step 10.4: Commit**

```bash
git add apps/web/src/
git commit -m "feat: formulário público /f/[slug] — UX passo a passo com lógica condicional, animações e submit"
```

---

## Task 11: Build final e verificação

- [ ] **Step 11.1: Build da API**

```bash
cd "apps/api" && npm run build
```

Resultado esperado: sem erros de compilação

- [ ] **Step 11.2: Build do web**

```bash
cd "apps/web" && npm run build
```

Resultado esperado: sem erros de compilação. Verificar que as rotas `/f/[slug]` e `/f/[slug]` aparecem no output de roteamento.

- [ ] **Step 11.3: Rodar todos os testes da API**

```bash
cd "apps/api" && npx vitest run
```

Resultado esperado: todos passando (incluindo os novos 6 testes de responseService)

- [ ] **Step 11.4: Commit final**

```bash
git add .
git commit -m "chore: build verificado — Etapa 4 completa (formulário público + submit + overage)"
```

---

## Self-Review — Cobertura da Spec

| Requisito da Etapa 4 | Task que implementa |
|---|---|
| GET /p/:slug sem autenticação | Task 3 |
| 404 se status ≠ PUBLISHED | Task 3 |
| POST /p/:slug/submit | Task 3 |
| Validar perguntas obrigatórias visíveis | Task 3 |
| Criar Response + Answers | Task 2 |
| FREE < 10 → UNLOCKED | Task 2 |
| FREE >= 10 → QUARANTINED | Task 2 |
| PRO/AGENCY → sempre UNLOCKED | Task 2 |
| Rate limiting 10/IP/hora | Task 3 |
| Retornar 200 para respondente (esconde quarentena) | Task 3 |
| Tela de boas-vindas com logo/avatar | Task 6 |
| Progresso por perguntas visíveis | Task 6, Task 8 |
| 5 tipos de campo (SHORT_TEXT, LONG_TEXT, MULTIPLE_CHOICE, MULTIPLE_SELECT, SCALE) | Task 7 |
| Botão Próximo / Enviar / Voltar | Task 8 |
| Validação de obrigatória no frontend | Task 9 |
| Lógica condicional no frontend | Task 5, Task 9 |
| Tela de conclusão personalizada | Task 6 |
| Mobile-first (área de toque 44px) | Task 7, Task 8 |
| Animação de transição entre perguntas | Task 9 (`animate-in`) |
| Loading state no botão Enviar | Task 8, Task 9 |
| Erro de rede no submit | Task 9 |
| Formulário pausado → tela de indisponível | Task 10 |
| 404 customizado | Task 10 |
| Sem header/navbar do Consorte no formulário público | Tasks 6–10 (nenhum layout do dashboard aplicado) |
| Testes unitários para lógica de overage | Task 1–2 |
