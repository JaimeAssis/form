# Etapa 3 — Builder de Formulários — Plano de Implementação

> **Para agentes autônomos:** SUB-SKILL OBRIGATÓRIO: Use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para implementar este plano tarefa por tarefa. Os passos usam sintaxe de checkbox (`- [ ]`) para rastreamento.

**Goal:** Implementar o builder completo de formulários — rotas de API, componente QuestionTypePicker, interface drag-and-drop de edição de perguntas, auto-save e publicação de formulários.

**Architecture:** Backend Fastify com rotas REST para CRUD de formulários e perguntas (com validações de negócio no backend). Frontend Next.js com App Router: página de lista de formulários em `/dashboard/forms` e editor em `/dashboard/forms/[id]/edit` com dois painéis — lista de perguntas (drag-and-drop) e painel de edição da pergunta selecionada. Auto-save via debounce 800ms.

**Tech Stack:** Next.js 14 (App Router), Fastify 4, Prisma ORM, @dnd-kit/sortable, Zod, shadcn/ui, TypeScript strict mode, Vitest para testes unitários de regras de negócio.

---

## Mapa de Arquivos

### Backend (apps/api)

| Arquivo | Ação | Responsabilidade |
|---------|------|-----------------|
| `apps/api/src/routes/forms.ts` | Criar | CRUD de formulários + status |
| `apps/api/src/routes/questions.ts` | Criar | CRUD de perguntas + reordenação |
| `apps/api/src/services/formService.ts` | Criar | Lógica de negócio: slug, circular ref, plan guard |
| `apps/api/src/index.ts` | Modificar | Registrar novas rotas |

### Frontend (apps/web)

| Arquivo | Ação | Responsabilidade |
|---------|------|-----------------|
| `apps/web/src/app/(dashboard)/forms/page.tsx` | Criar | Lista de formulários do usuário |
| `apps/web/src/app/(dashboard)/forms/[id]/edit/page.tsx` | Criar | Página do builder (dois painéis) |
| `apps/web/src/components/builder/QuestionTypePicker.tsx` | Criar | Modal seletor de tipo de pergunta |
| `apps/web/src/components/builder/QuestionCard.tsx` | Criar | Card de pergunta na lista (drag handle) |
| `apps/web/src/components/builder/QuestionEditor.tsx` | Criar | Painel de edição da pergunta selecionada |
| `apps/web/src/components/builder/ConditionEditor.tsx` | Criar | Sub-seção de lógica condicional |
| `apps/web/src/components/builder/AutoSaveIndicator.tsx` | Criar | Indicador "Salvando…" / "Salvo" / "Erro" |
| `apps/web/src/components/builder/PublishModal.tsx` | Criar | Modal com link copiável após publicar |
| `apps/web/src/lib/api.ts` | Modificar | Adicionar funções tipadas de API do builder |
| `packages/types/src/index.ts` | Modificar | Adicionar tipos Form, Question, Condition |

### Testes

| Arquivo | Ação | Responsabilidade |
|---------|------|-----------------|
| `apps/api/src/services/formService.test.ts` | Criar | Testes: slug, plano free, referência circular |

---

## Tarefa 1 — Tipos compartilhados para o Builder

**Arquivos:**
- Modificar: `packages/types/src/index.ts`

- [ ] **Passo 1: Adicionar interfaces Form, Question e Condition ao pacote de tipos**

Abrir `packages/types/src/index.ts` e adicionar ao final:

```typescript
export interface Condition {
  id: string
  questionId: string
  triggerQuestionId: string
  triggerValue: string
}

export interface Question {
  id: string
  formId: string
  order: number
  type: QuestionType
  title: string
  description?: string | null
  required: boolean
  options: string[]
  scaleMin?: string | null
  scaleMax?: string | null
  condition?: Condition | null
  createdAt: string
  updatedAt: string
}

export interface Form {
  id: string
  userId: string
  title: string
  description?: string | null
  slug: string
  status: FormStatus
  brandColor?: string | null
  logoUrl?: string | null
  welcomeTitle?: string | null
  welcomeMessage?: string | null
  thankYouTitle?: string | null
  thankYouMessage?: string | null
  questions: Question[]
  createdAt: string
  updatedAt: string
}
```

- [ ] **Passo 2: Build do pacote de tipos**

```bash
cd packages/types && npm run build
```
Esperado: sem erros de TypeScript.

- [ ] **Passo 3: Commit**

```bash
git add packages/types/src/index.ts
git commit -m "feat: adicionar tipos Form, Question e Condition ao pacote compartilhado"
```

---

## Tarefa 2 — formService: lógica de negócio do backend

**Arquivos:**
- Criar: `apps/api/src/services/formService.ts`
- Criar: `apps/api/src/services/formService.test.ts`

- [ ] **Passo 1: Escrever testes unitários primeiro (TDD)**

Criar `apps/api/src/services/formService.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { toSlug, generateUniqueSlug, detectCircularCondition } from './formService'

describe('toSlug', () => {
  it('converte título simples para kebab-case', () => {
    expect(toSlug('Briefing de Design')).toMatch(/^briefing-de-design-[a-z0-9]{4}$/)
  })

  it('remove acentos e caracteres especiais', () => {
    expect(toSlug('Formulário Ação!')).toMatch(/^formulario-acao-[a-z0-9]{4}$/)
  })

  it('colapsa espaços múltiplos', () => {
    expect(toSlug('Meu   Formulário')).toMatch(/^meu-formulario-[a-z0-9]{4}$/)
  })
})

describe('detectCircularCondition', () => {
  it('retorna false quando não há referência circular', () => {
    // P1 → P2 condicional em P1 (P2 mostra se P1 = X)
    const questions = [
      { id: 'q1', order: 1, condition: null },
      { id: 'q2', order: 2, condition: { triggerQuestionId: 'q1', triggerValue: 'A' } },
    ]
    expect(detectCircularCondition('q2', 'q1', questions as any)).toBe(false)
  })

  it('retorna true quando pergunta anterior depende da pergunta atual', () => {
    // q2 gatilha q3, mas q3 tenta gatilhar q2 → circular
    const questions = [
      { id: 'q1', order: 1, condition: null },
      { id: 'q2', order: 2, condition: { triggerQuestionId: 'q3', triggerValue: 'X' } },
      { id: 'q3', order: 3, condition: null },
    ]
    expect(detectCircularCondition('q3', 'q2', questions as any)).toBe(true)
  })
})
```

- [ ] **Passo 2: Rodar testes para confirmar que falham**

```bash
cd apps/api && npx vitest run src/services/formService.test.ts
```
Esperado: FAIL — "Cannot find module './formService'"

- [ ] **Passo 3: Implementar formService.ts**

Criar `apps/api/src/services/formService.ts`:

```typescript
import { prisma } from '../lib/prisma'
import { Plan } from '@consorte/types'

export function toSlug(title: string): string {
  const suffix = Math.random().toString(36).substring(2, 6)
  const base = title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
  return `${base}-${suffix}`
}

export async function generateUniqueSlug(title: string): Promise<string> {
  let slug = toSlug(title)
  let attempts = 0
  while (attempts < 10) {
    const existing = await prisma.form.findUnique({ where: { slug } })
    if (!existing) return slug
    slug = toSlug(title)
    attempts++
  }
  throw new Error('Não foi possível gerar slug único')
}

type QuestionLike = { id: string; condition: { triggerQuestionId: string } | null }

export function detectCircularCondition(
  questionId: string,
  triggerQuestionId: string,
  questions: QuestionLike[]
): boolean {
  // Detecta se triggerQuestion depende (direta ou indiretamente) de questionId
  const visited = new Set<string>()
  let current = triggerQuestionId
  while (current) {
    if (visited.has(current)) break
    if (current === questionId) return true
    visited.add(current)
    const q = questions.find(q => q.id === current)
    if (!q?.condition) break
    current = q.condition.triggerQuestionId
  }
  return false
}

export async function assertFreePlanPublishLimit(userId: string): Promise<void> {
  const published = await prisma.form.count({
    where: { userId, status: 'PUBLISHED' },
  })
  if (published >= 1) {
    throw { statusCode: 403, message: 'Plano Free permite apenas 1 formulário publicado. Faça upgrade para publicar mais.' }
  }
}
```

- [ ] **Passo 4: Rodar testes novamente**

```bash
cd apps/api && npx vitest run src/services/formService.test.ts
```
Esperado: PASS — todos os testes em verde.

- [ ] **Passo 5: Commit**

```bash
git add apps/api/src/services/
git commit -m "feat: implementar formService com slug, detecção de ciclo e guard de plano Free"
```

---

## Tarefa 3 — Rotas de API: Formulários

**Arquivos:**
- Criar: `apps/api/src/routes/forms.ts`
- Modificar: `apps/api/src/index.ts`

- [ ] **Passo 1: Criar apps/api/src/routes/forms.ts**

```typescript
import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/auth'
import { generateUniqueSlug, assertFreePlanPublishLimit } from '../services/formService'
import { Plan } from '@consorte/types'

const createFormSchema = z.object({
  title: z.string().min(1).max(200).optional().default('Sem título'),
  templateId: z.string().uuid().optional(),
})

const updateFormSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(500).optional().nullable(),
  welcomeTitle: z.string().max(200).optional().nullable(),
  welcomeMessage: z.string().max(1000).optional().nullable(),
  thankYouTitle: z.string().max(200).optional().nullable(),
  thankYouMessage: z.string().max(1000).optional().nullable(),
})

const statusSchema = z.object({
  status: z.enum(['PUBLISHED', 'PAUSED', 'DRAFT']),
})

export async function formRoutes(app: FastifyInstance) {
  // GET /forms — lista formulários do usuário autenticado
  app.get('/forms', { preHandler: authenticate }, async (request, reply) => {
    const forms = await prisma.form.findMany({
      where: { userId: request.userId },
      include: { _count: { select: { responses: true } } },
      orderBy: { createdAt: 'desc' },
    })
    return reply.send(forms)
  })

  // POST /forms — cria formulário (com ou sem templateId)
  app.post('/forms', { preHandler: authenticate }, async (request, reply) => {
    const body = createFormSchema.parse(request.body)
    const slug = await generateUniqueSlug(body.title)

    const form = await prisma.form.create({
      data: {
        userId: request.userId,
        title: body.title,
        slug,
      },
      include: { questions: { include: { condition: true }, orderBy: { order: 'asc' } } },
    })

    return reply.status(201).send(form)
  })

  // GET /forms/:id — retorna formulário com perguntas
  app.get('/forms/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const form = await prisma.form.findFirst({
      where: { id, userId: request.userId },
      include: { questions: { include: { condition: true }, orderBy: { order: 'asc' } } },
    })
    if (!form) return reply.status(404).send({ error: 'Formulário não encontrado' })
    return reply.send(form)
  })

  // PUT /forms/:id — atualiza dados do formulário
  app.put('/forms/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = updateFormSchema.parse(request.body)

    const existing = await prisma.form.findFirst({ where: { id, userId: request.userId } })
    if (!existing) return reply.status(404).send({ error: 'Formulário não encontrado' })

    // Campos de personalização de marca só para PRO/AGENCY (ignorar silenciosamente para FREE)
    const updateData: Record<string, unknown> = { ...body }
    if (request.userPlan === Plan.FREE) {
      delete updateData.brandColor
      delete updateData.logoUrl
    }

    const form = await prisma.form.update({
      where: { id },
      data: updateData,
      include: { questions: { include: { condition: true }, orderBy: { order: 'asc' } } },
    })
    return reply.send(form)
  })

  // DELETE /forms/:id — exclui formulário em cascata
  app.delete('/forms/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const existing = await prisma.form.findFirst({ where: { id, userId: request.userId } })
    if (!existing) return reply.status(404).send({ error: 'Formulário não encontrado' })

    await prisma.form.delete({ where: { id } })
    return reply.status(204).send()
  })

  // PATCH /forms/:id/status — publica, pausa ou volta a rascunho
  app.patch('/forms/:id/status', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { status } = statusSchema.parse(request.body)

    const existing = await prisma.form.findFirst({
      where: { id, userId: request.userId },
      include: { questions: true },
    })
    if (!existing) return reply.status(404).send({ error: 'Formulário não encontrado' })

    if (status === 'PUBLISHED') {
      if (!existing.title || existing.title.trim() === '' || existing.title === 'Sem título') {
        return reply.status(400).send({ error: 'O formulário precisa de um título para ser publicado' })
      }
      if (existing.questions.length === 0) {
        return reply.status(400).send({ error: 'O formulário precisa ter ao menos uma pergunta' })
      }
      if (request.userPlan === Plan.FREE) {
        await assertFreePlanPublishLimit(request.userId)
      }
    }

    const form = await prisma.form.update({
      where: { id },
      data: { status },
    })
    return reply.send(form)
  })

  // GET /forms/:id/preview — retorna formulário sem autenticação (pré-visualização)
  app.get('/forms/:id/preview', async (request, reply) => {
    const { id } = request.params as { id: string }
    const form = await prisma.form.findUnique({
      where: { id },
      include: { questions: { include: { condition: true }, orderBy: { order: 'asc' } } },
    })
    if (!form) return reply.status(404).send({ error: 'Formulário não encontrado' })
    return reply.send(form)
  })
}
```

- [ ] **Passo 2: Registrar rotas no servidor**

Abrir `apps/api/src/index.ts` e adicionar:

```typescript
import { formRoutes } from './routes/forms'
import { questionRoutes } from './routes/questions'

// Após os outros app.register:
app.register(formRoutes)
app.register(questionRoutes)
```

- [ ] **Passo 3: Testar rotas manualmente**

```bash
cd apps/api && npm run dev
# Em outro terminal:
curl -X POST http://localhost:3001/forms \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <seu-token>" \
  -d '{"title":"Meu Formulário"}'
```
Esperado: `201` com JSON do formulário criado.

- [ ] **Passo 4: Commit**

```bash
git add apps/api/src/routes/forms.ts apps/api/src/index.ts
git commit -m "feat: rotas CRUD de formulários com guard de plano e publicação"
```

---

## Tarefa 4 — Rotas de API: Perguntas

**Arquivos:**
- Criar: `apps/api/src/routes/questions.ts`

- [ ] **Passo 1: Criar apps/api/src/routes/questions.ts**

```typescript
import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/auth'
import { detectCircularCondition } from '../services/formService'
import { QuestionType } from '@consorte/types'

const CONDITION_ELIGIBLE_TYPES = [
  QuestionType.MULTIPLE_CHOICE,
  QuestionType.MULTIPLE_SELECT,
  QuestionType.SCALE,
]

const createQuestionSchema = z.object({
  type: z.nativeEnum(QuestionType),
  title: z.string().max(280).optional().default(''),
  description: z.string().max(500).optional().nullable(),
  required: z.boolean().optional().default(false),
  options: z.array(z.string()).optional().default([]),
  scaleMin: z.string().max(50).optional().nullable(),
  scaleMax: z.string().max(50).optional().nullable(),
})

const updateQuestionSchema = z.object({
  title: z.string().max(280).optional(),
  description: z.string().max(500).optional().nullable(),
  required: z.boolean().optional(),
  options: z.array(z.string()).max(10).optional(),
  scaleMin: z.string().max(50).optional().nullable(),
  scaleMax: z.string().max(50).optional().nullable(),
  condition: z.object({
    triggerQuestionId: z.string().uuid(),
    triggerValue: z.string(),
  }).optional().nullable(),
})

const reorderSchema = z.object({
  order: z.array(z.string().uuid()),
})

async function assertFormOwnership(formId: string, userId: string) {
  const form = await prisma.form.findFirst({ where: { id: formId, userId } })
  if (!form) throw { statusCode: 404, message: 'Formulário não encontrado' }
  return form
}

export async function questionRoutes(app: FastifyInstance) {
  // POST /forms/:id/questions
  app.post('/forms/:id/questions', { preHandler: authenticate }, async (request, reply) => {
    const { id: formId } = request.params as { id: string }
    await assertFormOwnership(formId, request.userId)

    const body = createQuestionSchema.parse(request.body)

    const lastQuestion = await prisma.question.findFirst({
      where: { formId },
      orderBy: { order: 'desc' },
    })
    const order = (lastQuestion?.order ?? 0) + 1

    // Defaults por tipo
    let options = body.options
    let scaleMin = body.scaleMin
    let scaleMax = body.scaleMax
    if (body.type === QuestionType.MULTIPLE_CHOICE || body.type === QuestionType.MULTIPLE_SELECT) {
      options = options.length > 0 ? options : ['Opção 1', 'Opção 2']
    }
    if (body.type === QuestionType.SCALE) {
      scaleMin = scaleMin ?? 'Discordo'
      scaleMax = scaleMax ?? 'Concordo'
    }

    const question = await prisma.question.create({
      data: { formId, order, type: body.type, title: body.title, description: body.description, required: body.required, options, scaleMin, scaleMax },
      include: { condition: true },
    })
    return reply.status(201).send(question)
  })

  // PUT /forms/:id/questions/:qid
  app.put('/forms/:id/questions/:qid', { preHandler: authenticate }, async (request, reply) => {
    const { id: formId, qid } = request.params as { id: string; qid: string }
    await assertFormOwnership(formId, request.userId)

    const body = updateQuestionSchema.parse(request.body)

    const question = await prisma.question.findFirst({ where: { id: qid, formId } })
    if (!question) return reply.status(404).send({ error: 'Pergunta não encontrada' })

    // Validar lógica condicional
    if (body.condition !== undefined) {
      if (body.condition !== null) {
        const trigger = await prisma.question.findFirst({ where: { id: body.condition.triggerQuestionId, formId } })
        if (!trigger) return reply.status(400).send({ error: 'Pergunta gatilho não encontrada neste formulário' })

        if (!CONDITION_ELIGIBLE_TYPES.includes(trigger.type as QuestionType)) {
          return reply.status(422).send({ error: 'Lógica condicional só é permitida em perguntas de múltipla escolha, múltipla seleção ou escala' })
        }

        const allQuestions = await prisma.question.findMany({
          where: { formId },
          include: { condition: true },
          orderBy: { order: 'asc' },
        })
        const questionsForCheck = allQuestions.map(q => ({
          id: q.id,
          condition: q.condition ? { triggerQuestionId: q.condition.triggerQuestionId } : null,
        }))
        if (detectCircularCondition(qid, body.condition.triggerQuestionId, questionsForCheck)) {
          return reply.status(422).send({ error: 'Referência circular detectada na lógica condicional' })
        }

        await prisma.condition.upsert({
          where: { questionId: qid },
          create: { questionId: qid, triggerQuestionId: body.condition.triggerQuestionId, triggerValue: body.condition.triggerValue },
          update: { triggerQuestionId: body.condition.triggerQuestionId, triggerValue: body.condition.triggerValue },
        })
      } else {
        // Remover condição
        await prisma.condition.deleteMany({ where: { questionId: qid } })
      }
    }

    const { condition: _c, ...questionData } = body
    const updated = await prisma.question.update({
      where: { id: qid },
      data: questionData,
      include: { condition: true },
    })
    return reply.send(updated)
  })

  // DELETE /forms/:id/questions/:qid
  app.delete('/forms/:id/questions/:qid', { preHandler: authenticate }, async (request, reply) => {
    const { id: formId, qid } = request.params as { id: string; qid: string }
    await assertFormOwnership(formId, request.userId)

    const question = await prisma.question.findFirst({ where: { id: qid, formId } })
    if (!question) return reply.status(404).send({ error: 'Pergunta não encontrada' })

    // Cascade: remover conditions que têm esta pergunta como gatilho
    await prisma.condition.deleteMany({ where: { triggerQuestionId: qid } })
    await prisma.question.delete({ where: { id: qid } })

    return reply.status(204).send()
  })

  // PATCH /forms/:id/questions/reorder
  app.patch('/forms/:id/questions/reorder', { preHandler: authenticate }, async (request, reply) => {
    const { id: formId } = request.params as { id: string }
    await assertFormOwnership(formId, request.userId)

    const { order } = reorderSchema.parse(request.body)

    await prisma.$transaction(
      order.map((questionId, index) =>
        prisma.question.update({ where: { id: questionId }, data: { order: index + 1 } })
      )
    )
    return reply.send({ ok: true })
  })
}
```

- [ ] **Passo 2: Verificar tipos do TypeScript**

```bash
cd apps/api && npx tsc --noEmit
```
Esperado: sem erros.

- [ ] **Passo 3: Commit**

```bash
git add apps/api/src/routes/questions.ts
git commit -m "feat: rotas CRUD de perguntas com validação de lógica condicional e reordenação"
```

---

## Tarefa 5 — Componente QuestionTypePicker

**Arquivos:**
- Criar: `apps/web/src/components/builder/QuestionTypePicker.tsx`

- [ ] **Passo 1: Instalar dependências de ícones se necessário**

```bash
cd apps/web && npm install lucide-react
```
Esperado: instalação bem-sucedida (provavelmente já instalado pelo shadcn/ui).

- [ ] **Passo 2: Criar QuestionTypePicker.tsx**

Criar `apps/web/src/components/builder/QuestionTypePicker.tsx`:

```tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { QuestionType, Question } from '@consorte/types'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlignLeft, AlignJustify, ListChecks, CheckSquare, BarChart2, Plus } from 'lucide-react'

const TYPE_CONFIG: Record<QuestionType, { label: string; description: string; icon: React.ReactNode; preview: React.ReactNode }> = {
  [QuestionType.SHORT_TEXT]: {
    label: 'Texto curto',
    description: 'Resposta em uma linha',
    icon: <AlignLeft className="w-5 h-5" />,
    preview: <input disabled placeholder="Digite sua resposta..." className="w-full border rounded px-3 py-2 text-sm bg-gray-50 cursor-not-allowed" />,
  },
  [QuestionType.LONG_TEXT]: {
    label: 'Texto longo',
    description: 'Resposta em múltiplas linhas',
    icon: <AlignJustify className="w-5 h-5" />,
    preview: <textarea disabled placeholder="Digite sua resposta..." rows={3} className="w-full border rounded px-3 py-2 text-sm bg-gray-50 cursor-not-allowed resize-none" />,
  },
  [QuestionType.MULTIPLE_CHOICE]: {
    label: 'Múltipla escolha',
    description: 'O respondente escolhe uma opção',
    icon: <ListChecks className="w-5 h-5" />,
    preview: (
      <div className="space-y-2">
        {['Opção 1', 'Opção 2', 'Opção 3'].map(o => (
          <div key={o} className="flex items-center gap-2 border rounded px-3 py-2 text-sm bg-gray-50">
            <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
            <span className="text-gray-500">{o}</span>
          </div>
        ))}
      </div>
    ),
  },
  [QuestionType.MULTIPLE_SELECT]: {
    label: 'Múltipla seleção',
    description: 'O respondente escolhe várias opções',
    icon: <CheckSquare className="w-5 h-5" />,
    preview: (
      <div className="space-y-2">
        {['Opção 1', 'Opção 2', 'Opção 3'].map(o => (
          <div key={o} className="flex items-center gap-2 border rounded px-3 py-2 text-sm bg-gray-50">
            <div className="w-4 h-4 rounded border-2 border-gray-300" />
            <span className="text-gray-500">{o}</span>
          </div>
        ))}
      </div>
    ),
  },
  [QuestionType.SCALE]: {
    label: 'Escala',
    description: 'Avaliação de 1 a 5',
    icon: <BarChart2 className="w-5 h-5" />,
    preview: (
      <div>
        <div className="flex gap-2 justify-between mb-1">
          {[1, 2, 3, 4, 5].map(n => (
            <div key={n} className="flex-1 border rounded py-2 text-center text-sm font-medium bg-gray-50 text-gray-500">{n}</div>
          ))}
        </div>
        <div className="flex justify-between text-xs text-gray-400">
          <span>Discordo</span>
          <span>Concordo</span>
        </div>
      </div>
    ),
  },
}

export function buildQuestion(type: QuestionType): Omit<Question, 'id' | 'formId' | 'createdAt' | 'updatedAt'> {
  const base = {
    order: 0,
    type,
    title: '',
    description: null,
    required: false,
    options: [] as string[],
    scaleMin: null,
    scaleMax: null,
    condition: null,
  }
  if (type === QuestionType.MULTIPLE_CHOICE || type === QuestionType.MULTIPLE_SELECT) {
    return { ...base, options: ['Opção 1', 'Opção 2'] }
  }
  if (type === QuestionType.SCALE) {
    return { ...base, scaleMin: 'Discordo', scaleMax: 'Concordo' }
  }
  return base
}

interface QuestionTypePickerProps {
  open: boolean
  onConfirm: (type: QuestionType) => void
  onCancel: () => void
}

export function QuestionTypePicker({ open, onConfirm, onCancel }: QuestionTypePickerProps) {
  const [selected, setSelected] = useState<QuestionType | null>(null)
  const [error, setError] = useState(false)
  const [shake, setShake] = useState(false)

  useEffect(() => {
    if (open) {
      setSelected(null)
      setError(false)
      setShake(false)
    }
  }, [open])

  const handleConfirm = useCallback(() => {
    if (!selected) {
      setError(true)
      setShake(true)
      setTimeout(() => setShake(false), 500)
      return
    }
    onConfirm(selected)
  }, [selected, onConfirm])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!open) return
      if (e.key === 'Escape') onCancel()
      if (e.key === 'Enter') handleConfirm()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onCancel, handleConfirm])

  const types = Object.values(QuestionType)

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel() }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Escolha o tipo de pergunta</DialogTitle>
        </DialogHeader>

        <div className={`grid grid-cols-2 gap-3 ${shake ? 'animate-shake' : ''}`}>
          {types.map((type) => {
            const config = TYPE_CONFIG[type]
            const isSelected = selected === type
            return (
              <div key={type} className="flex flex-col gap-2">
                <button
                  onClick={() => { setSelected(type); setError(false) }}
                  className={`flex items-center gap-3 p-3 rounded-lg border-2 text-left transition-colors ${isSelected ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}
                >
                  <span className={isSelected ? 'text-blue-600' : 'text-gray-500'}>{config.icon}</span>
                  <div>
                    <p className="font-medium text-sm">{config.label}</p>
                    <p className="text-xs text-gray-500">{config.description}</p>
                  </div>
                </button>
                {isSelected && (
                  <div className="border rounded-lg p-3 bg-white">
                    <p className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wide">Preview</p>
                    {config.preview}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {error && (
          <p className="text-sm text-red-600 text-center">Selecione um tipo de pergunta para continuar</p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button onClick={handleConfirm}>Confirmar tipo</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

interface AddQuestionButtonProps {
  onAdd: (type: QuestionType) => void
  disabled?: boolean
}

export function AddQuestionButton({ onAdd, disabled }: AddQuestionButtonProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="w-full border-dashed"
      >
        <Plus className="w-4 h-4 mr-2" />
        Adicionar pergunta
      </Button>
      <QuestionTypePicker
        open={open}
        onConfirm={(type) => { setOpen(false); onAdd(type) }}
        onCancel={() => setOpen(false)}
      />
    </>
  )
}
```

- [ ] **Passo 3: Adicionar animação shake ao tailwind.config.ts**

Abrir `apps/web/tailwind.config.ts` e adicionar em `extend`:

```typescript
keyframes: {
  shake: {
    '0%, 100%': { transform: 'translateX(0)' },
    '20%, 60%': { transform: 'translateX(-6px)' },
    '40%, 80%': { transform: 'translateX(6px)' },
  },
},
animation: {
  shake: 'shake 0.5s ease-in-out',
},
```

- [ ] **Passo 4: Type check**

```bash
cd apps/web && npx tsc --noEmit
```
Esperado: sem erros.

- [ ] **Passo 5: Commit**

```bash
git add apps/web/src/components/builder/QuestionTypePicker.tsx apps/web/tailwind.config.ts
git commit -m "feat: QuestionTypePicker com preview por tipo, validação e atalhos de teclado"
```

---

## Tarefa 6 — AutoSaveIndicator e funções de API no frontend

**Arquivos:**
- Criar: `apps/web/src/components/builder/AutoSaveIndicator.tsx`
- Modificar: `apps/web/src/lib/api.ts`

- [ ] **Passo 1: Criar AutoSaveIndicator.tsx**

```tsx
'use client'

import { Loader2, Check, WifiOff } from 'lucide-react'

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface AutoSaveIndicatorProps {
  status: SaveStatus
}

export function AutoSaveIndicator({ status }: AutoSaveIndicatorProps) {
  if (status === 'idle') return null
  if (status === 'saving') {
    return (
      <span className="flex items-center gap-1 text-xs text-gray-400">
        <Loader2 className="w-3 h-3 animate-spin" /> Salvando…
      </span>
    )
  }
  if (status === 'saved') {
    return (
      <span className="flex items-center gap-1 text-xs text-green-600">
        <Check className="w-3 h-3" /> Salvo
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1 text-xs text-red-500">
      <WifiOff className="w-3 h-3" /> Erro ao salvar — tentando novamente
    </span>
  )
}
```

- [ ] **Passo 2: Adicionar funções tipadas em apps/web/src/lib/api.ts**

Abrir o arquivo existente e adicionar ao final:

```typescript
import type { Form, Question, QuestionType } from '@consorte/types'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

async function getToken(): Promise<string | null> {
  // No cliente, buscar sessão Supabase
  if (typeof window !== 'undefined') {
    const { createBrowserClient } = await import('@supabase/ssr')
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token ?? null
  }
  return null
}

async function authFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = await getToken()
  return fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
}

// Forms
export async function getForms(): Promise<Form[]> {
  const res = await authFetch('/forms')
  if (!res.ok) throw new Error('Erro ao buscar formulários')
  return res.json()
}

export async function getForm(id: string): Promise<Form> {
  const res = await authFetch(`/forms/${id}`)
  if (!res.ok) throw new Error('Formulário não encontrado')
  return res.json()
}

export async function createForm(data: { title?: string }): Promise<Form> {
  const res = await authFetch('/forms', { method: 'POST', body: JSON.stringify(data) })
  if (!res.ok) throw new Error('Erro ao criar formulário')
  return res.json()
}

export async function updateForm(id: string, data: Partial<Form>): Promise<Form> {
  const res = await authFetch(`/forms/${id}`, { method: 'PUT', body: JSON.stringify(data) })
  if (!res.ok) throw new Error('Erro ao atualizar formulário')
  return res.json()
}

export async function deleteForm(id: string): Promise<void> {
  const res = await authFetch(`/forms/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Erro ao excluir formulário')
}

export async function updateFormStatus(id: string, status: 'PUBLISHED' | 'PAUSED' | 'DRAFT'): Promise<Form> {
  const res = await authFetch(`/forms/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? 'Erro ao atualizar status')
  return json
}

// Questions
export async function createQuestion(formId: string, type: QuestionType): Promise<Question> {
  const res = await authFetch(`/forms/${formId}/questions`, { method: 'POST', body: JSON.stringify({ type }) })
  if (!res.ok) throw new Error('Erro ao criar pergunta')
  return res.json()
}

export async function updateQuestion(formId: string, questionId: string, data: Partial<Question> & { condition?: { triggerQuestionId: string; triggerValue: string } | null }): Promise<Question> {
  const res = await authFetch(`/forms/${formId}/questions/${questionId}`, { method: 'PUT', body: JSON.stringify(data) })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? 'Erro ao atualizar pergunta')
  return json
}

export async function deleteQuestion(formId: string, questionId: string): Promise<void> {
  const res = await authFetch(`/forms/${formId}/questions/${questionId}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Erro ao excluir pergunta')
}

export async function reorderQuestions(formId: string, order: string[]): Promise<void> {
  const res = await authFetch(`/forms/${formId}/questions/reorder`, { method: 'PATCH', body: JSON.stringify({ order }) })
  if (!res.ok) throw new Error('Erro ao reordenar perguntas')
}
```

- [ ] **Passo 3: Commit**

```bash
git add apps/web/src/components/builder/AutoSaveIndicator.tsx apps/web/src/lib/api.ts
git commit -m "feat: AutoSaveIndicator e funções de API tipadas para formulários e perguntas"
```

---

## Tarefa 7 — QuestionCard e QuestionEditor

**Arquivos:**
- Criar: `apps/web/src/components/builder/QuestionCard.tsx`
- Criar: `apps/web/src/components/builder/ConditionEditor.tsx`
- Criar: `apps/web/src/components/builder/QuestionEditor.tsx`

- [ ] **Passo 1: Instalar @dnd-kit**

```bash
cd apps/web && npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

- [ ] **Passo 2: Criar QuestionCard.tsx**

```tsx
'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Question, QuestionType } from '@consorte/types'
import { Badge } from '@/components/ui/badge'
import { GripVertical, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

const TYPE_LABEL: Record<QuestionType, string> = {
  [QuestionType.SHORT_TEXT]: 'Texto curto',
  [QuestionType.LONG_TEXT]: 'Texto longo',
  [QuestionType.MULTIPLE_CHOICE]: 'Múltipla escolha',
  [QuestionType.MULTIPLE_SELECT]: 'Múltipla seleção',
  [QuestionType.SCALE]: 'Escala',
}

interface QuestionCardProps {
  question: Question
  index: number
  isSelected: boolean
  onClick: () => void
  onDelete: () => void
}

export function QuestionCard({ question, index, isSelected, onClick, onDelete }: QuestionCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: question.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onClick}
      className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer group transition-colors ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}
    >
      <button
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing shrink-0"
      >
        <GripVertical className="w-4 h-4" />
      </button>

      <span className="text-xs text-gray-400 w-5 shrink-0">{index + 1}</span>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {question.title || <span className="text-gray-400 italic">Sem título</span>}
        </p>
        <Badge variant="secondary" className="text-xs mt-0.5">
          {TYPE_LABEL[question.type]}
        </Badge>
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={(e) => { e.stopPropagation(); onDelete() }}
        className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 hover:bg-red-50 shrink-0"
      >
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  )
}
```

- [ ] **Passo 3: Criar ConditionEditor.tsx**

```tsx
'use client'

import { Question, QuestionType } from '@consorte/types'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const ELIGIBLE = [QuestionType.MULTIPLE_CHOICE, QuestionType.MULTIPLE_SELECT, QuestionType.SCALE]

interface ConditionEditorProps {
  currentQuestionId: string
  questions: Question[]
  condition: { triggerQuestionId: string; triggerValue: string } | null
  onChange: (condition: { triggerQuestionId: string; triggerValue: string } | null) => void
}

export function ConditionEditor({ currentQuestionId, questions, condition, onChange }: ConditionEditorProps) {
  const currentIndex = questions.findIndex(q => q.id === currentQuestionId)
  const eligible = questions.slice(0, currentIndex).filter(q => ELIGIBLE.includes(q.type))

  if (eligible.length === 0) {
    return (
      <p className="text-xs text-gray-400">Não há perguntas elegíveis antes desta para criar uma condição.</p>
    )
  }

  const triggerQuestion = eligible.find(q => q.id === condition?.triggerQuestionId)

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-medium text-gray-600 mb-1 block">Mostrar esta pergunta se:</label>
        <Select
          value={condition?.triggerQuestionId ?? 'none'}
          onValueChange={(val) => {
            if (val === 'none') { onChange(null); return }
            const q = eligible.find(q => q.id === val)
            const firstOption = q?.options?.[0] ?? '1'
            onChange({ triggerQuestionId: val, triggerValue: firstOption })
          }}
        >
          <SelectTrigger className="text-sm">
            <SelectValue placeholder="Selecione uma pergunta" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">— Sempre mostrar —</SelectItem>
            {eligible.map(q => (
              <SelectItem key={q.id} value={q.id}>
                {q.title || 'Sem título'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {condition && triggerQuestion && (
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">For igual a:</label>
          <Select
            value={condition.triggerValue}
            onValueChange={(val) => onChange({ ...condition, triggerValue: val })}
          >
            <SelectTrigger className="text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {triggerQuestion.type === QuestionType.SCALE
                ? ['1', '2', '3', '4', '5'].map(v => (
                    <SelectItem key={v} value={v}>{v}</SelectItem>
                  ))
                : triggerQuestion.options.map(opt => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))
              }
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Passo 4: Criar QuestionEditor.tsx**

```tsx
'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Question, QuestionType } from '@consorte/types'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { ConditionEditor } from './ConditionEditor'
import { Plus, X } from 'lucide-react'

interface QuestionEditorProps {
  question: Question
  allQuestions: Question[]
  onChange: (updated: Partial<Question> & { condition?: { triggerQuestionId: string; triggerValue: string } | null }) => void
}

export function QuestionEditor({ question, allQuestions, onChange }: QuestionEditorProps) {
  const [localTitle, setLocalTitle] = useState(question.title)
  const [localDesc, setLocalDesc] = useState(question.description ?? '')

  useEffect(() => {
    setLocalTitle(question.title)
    setLocalDesc(question.description ?? '')
  }, [question.id])

  const TYPE_LABEL: Record<QuestionType, string> = {
    [QuestionType.SHORT_TEXT]: 'Texto curto',
    [QuestionType.LONG_TEXT]: 'Texto longo',
    [QuestionType.MULTIPLE_CHOICE]: 'Múltipla escolha',
    [QuestionType.MULTIPLE_SELECT]: 'Múltipla seleção',
    [QuestionType.SCALE]: 'Escala',
  }

  return (
    <div className="space-y-5">
      <div>
        <Label className="text-xs text-gray-500 uppercase tracking-wide">Tipo</Label>
        <p className="text-sm font-medium mt-1">{TYPE_LABEL[question.type]}</p>
        <p className="text-xs text-gray-400">O tipo não pode ser alterado após a criação.</p>
      </div>

      {/* Título */}
      <div>
        <Label htmlFor="q-title" className="text-xs text-gray-500 uppercase tracking-wide">
          Título {localTitle.length > 224 && <span className="text-orange-500">({localTitle.length}/280)</span>}
        </Label>
        <Input
          id="q-title"
          value={localTitle}
          maxLength={280}
          onChange={e => setLocalTitle(e.target.value)}
          onBlur={() => onChange({ title: localTitle })}
          placeholder="Digite a pergunta..."
          className="mt-1"
        />
      </div>

      {/* Descrição */}
      <div>
        <Label htmlFor="q-desc" className="text-xs text-gray-500 uppercase tracking-wide">Descrição (opcional)</Label>
        <Textarea
          id="q-desc"
          value={localDesc}
          onChange={e => setLocalDesc(e.target.value)}
          onBlur={() => onChange({ description: localDesc || null })}
          placeholder="Contexto ou instrução adicional..."
          rows={2}
          className="mt-1 resize-none"
        />
      </div>

      {/* Toggle obrigatória */}
      <div className="flex items-center gap-3">
        <Switch
          id="q-required"
          checked={question.required}
          onCheckedChange={val => onChange({ required: val })}
        />
        <Label htmlFor="q-required" className="text-sm cursor-pointer">
          Pergunta obrigatória {question.required && <span className="text-red-500">*</span>}
        </Label>
      </div>

      {/* Opções (choice/select) */}
      {(question.type === QuestionType.MULTIPLE_CHOICE || question.type === QuestionType.MULTIPLE_SELECT) && (
        <div>
          <Label className="text-xs text-gray-500 uppercase tracking-wide">Opções ({question.options.length}/10)</Label>
          <div className="space-y-2 mt-2">
            {question.options.map((opt, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  value={opt}
                  onChange={e => {
                    const updated = [...question.options]
                    updated[i] = e.target.value
                    onChange({ options: updated })
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && question.options.length < 10) {
                      e.preventDefault()
                      const updated = [...question.options]
                      updated.splice(i + 1, 0, '')
                      onChange({ options: updated })
                    }
                  }}
                  placeholder={`Opção ${i + 1}`}
                  className="flex-1 text-sm"
                />
                {question.options.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onChange({ options: question.options.filter((_, j) => j !== i) })}
                    className="text-gray-400 hover:text-red-500"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
            {question.options.length < 10 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onChange({ options: [...question.options, ''] })}
                className="w-full border-dashed text-xs"
              >
                <Plus className="w-3 h-3 mr-1" /> Adicionar opção
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Labels de escala */}
      {question.type === QuestionType.SCALE && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-gray-500">Label mínimo (1)</Label>
            <Input
              value={question.scaleMin ?? ''}
              onChange={e => onChange({ scaleMin: e.target.value })}
              placeholder="Ex: Discordo"
              className="mt-1 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs text-gray-500">Label máximo (5)</Label>
            <Input
              value={question.scaleMax ?? ''}
              onChange={e => onChange({ scaleMax: e.target.value })}
              placeholder="Ex: Concordo"
              className="mt-1 text-sm"
            />
          </div>
        </div>
      )}

      {/* Lógica condicional */}
      <div className="border-t pt-4">
        <Label className="text-xs text-gray-500 uppercase tracking-wide mb-3 block">Lógica condicional</Label>
        <ConditionEditor
          currentQuestionId={question.id}
          questions={allQuestions}
          condition={question.condition ? { triggerQuestionId: question.condition.triggerQuestionId, triggerValue: question.condition.triggerValue } : null}
          onChange={cond => onChange({ condition: cond })}
        />
      </div>
    </div>
  )
}
```

- [ ] **Passo 5: Adicionar Switch e Label ao shadcn/ui**

```bash
cd apps/web && npx shadcn@latest add switch label
```
Esperado: componentes `switch.tsx` e `label.tsx` criados em `src/components/ui/`.

- [ ] **Passo 6: Type check**

```bash
cd apps/web && npx tsc --noEmit
```
Esperado: sem erros.

- [ ] **Passo 7: Commit**

```bash
git add apps/web/src/components/builder/
git commit -m "feat: QuestionCard, QuestionEditor e ConditionEditor para o builder"
```

---

## Tarefa 8 — PublishModal

**Arquivos:**
- Criar: `apps/web/src/components/builder/PublishModal.tsx`

- [ ] **Passo 1: Criar PublishModal.tsx**

```tsx
'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Check, Copy } from 'lucide-react'

interface PublishModalProps {
  open: boolean
  onClose: () => void
  slug: string
}

export function PublishModal({ open, onClose, slug }: PublishModalProps) {
  const [copied, setCopied] = useState(false)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const publicUrl = `${appUrl}/f/${slug}`

  function handleCopy() {
    navigator.clipboard.writeText(publicUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>🎉 Formulário publicado!</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-gray-500 mb-3">Seu formulário está disponível no link abaixo. Compartilhe com seus clientes.</p>
        <div className="flex gap-2">
          <Input value={publicUrl} readOnly className="text-sm font-mono" />
          <Button variant="outline" onClick={handleCopy} className="shrink-0">
            {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
          </Button>
        </div>
        {copied && <p className="text-xs text-green-600 text-center">Link copiado!</p>}
        <Button className="w-full mt-2" onClick={onClose}>Fechar</Button>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Passo 2: Commit**

```bash
git add apps/web/src/components/builder/PublishModal.tsx
git commit -m "feat: PublishModal com link copiável após publicação"
```

---

## Tarefa 9 — Página do Builder (/dashboard/forms/[id]/edit)

**Arquivos:**
- Criar: `apps/web/src/app/(dashboard)/forms/[id]/edit/page.tsx`

- [ ] **Passo 1: Criar a página do builder**

Criar `apps/web/src/app/(dashboard)/forms/[id]/edit/page.tsx`:

```tsx
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { Form, Question, QuestionType } from '@consorte/types'
import { getForm, updateForm, updateFormStatus, createQuestion, updateQuestion, deleteQuestion, reorderQuestions } from '@/lib/api'
import { QuestionCard } from '@/components/builder/QuestionCard'
import { QuestionEditor } from '@/components/builder/QuestionEditor'
import { AddQuestionButton, buildQuestion } from '@/components/builder/QuestionTypePicker'
import { AutoSaveIndicator, SaveStatus } from '@/components/builder/AutoSaveIndicator'
import { PublishModal } from '@/components/builder/PublishModal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'
import { ArrowLeft, Eye, Globe, PauseCircle } from 'lucide-react'

const DEBOUNCE_MS = 800
const RETRY_DELAYS = [3000, 6000, 12000]

export default function BuilderPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { toast } = useToast()

  const [form, setForm] = useState<Form | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [publishModalOpen, setPublishModalOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  const pendingFormSave = useRef<NodeJS.Timeout | null>(null)
  const pendingQuestionSave = useRef<Map<string, NodeJS.Timeout>>(new Map())
  const retryCount = useRef(0)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  useEffect(() => {
    getForm(id).then(f => { setForm(f); setLoading(false) }).catch(() => router.push('/dashboard/forms'))
  }, [id])

  const selectedQuestion = form?.questions.find(q => q.id === selectedId) ?? null

  // Auto-save do formulário (título, descrição, etc.)
  const scheduleFormSave = useCallback((data: Partial<Form>) => {
    if (pendingFormSave.current) clearTimeout(pendingFormSave.current)
    setSaveStatus('saving')
    pendingFormSave.current = setTimeout(async () => {
      const attempt = async (retry: number): Promise<void> => {
        try {
          await updateForm(id, data)
          setSaveStatus('saved')
          retryCount.current = 0
          setTimeout(() => setSaveStatus('idle'), 2000)
        } catch {
          if (retry < RETRY_DELAYS.length) {
            setTimeout(() => attempt(retry + 1), RETRY_DELAYS[retry])
          } else {
            setSaveStatus('error')
          }
        }
      }
      await attempt(0)
    }, DEBOUNCE_MS)
  }, [id])

  // Auto-save de pergunta individual
  const scheduleQuestionSave = useCallback((questionId: string, data: Partial<Question> & { condition?: { triggerQuestionId: string; triggerValue: string } | null }) => {
    const existing = pendingQuestionSave.current.get(questionId)
    if (existing) clearTimeout(existing)
    setSaveStatus('saving')
    const timeout = setTimeout(async () => {
      const attempt = async (retry: number): Promise<void> => {
        try {
          const updated = await updateQuestion(id, questionId, data)
          setForm(prev => prev ? {
            ...prev,
            questions: prev.questions.map(q => q.id === questionId ? updated : q)
          } : prev)
          setSaveStatus('saved')
          retryCount.current = 0
          setTimeout(() => setSaveStatus('idle'), 2000)
        } catch (err: any) {
          if (retry < RETRY_DELAYS.length) {
            setTimeout(() => attempt(retry + 1), RETRY_DELAYS[retry])
          } else {
            setSaveStatus('error')
            toast({ title: err.message ?? 'Erro ao salvar pergunta', variant: 'destructive' })
          }
        }
      }
      await attempt(0)
    }, DEBOUNCE_MS)
    pendingQuestionSave.current.set(questionId, timeout)
  }, [id, toast])

  function handleQuestionChange(questionId: string, data: Partial<Question> & { condition?: { triggerQuestionId: string; triggerValue: string } | null }) {
    // Atualizar estado local imediatamente para UI responsiva
    setForm(prev => prev ? {
      ...prev,
      questions: prev.questions.map(q => q.id === questionId ? { ...q, ...data } : q)
    } : prev)
    scheduleQuestionSave(questionId, data)
  }

  async function handleAddQuestion(type: QuestionType) {
    if (!form) return
    try {
      const created = await createQuestion(form.id, type)
      setForm(prev => prev ? { ...prev, questions: [...prev.questions, created] } : prev)
      setSelectedId(created.id)
    } catch {
      toast({ title: 'Erro ao adicionar pergunta', variant: 'destructive' })
    }
  }

  async function handleDeleteQuestion(questionId: string) {
    if (!confirm('Deseja excluir esta pergunta?')) return
    try {
      await deleteQuestion(id, questionId)
      setForm(prev => prev ? {
        ...prev,
        questions: prev.questions.filter(q => q.id !== questionId)
      } : prev)
      if (selectedId === questionId) setSelectedId(null)
      toast({ title: 'Pergunta excluída' })
    } catch {
      toast({ title: 'Erro ao excluir pergunta', variant: 'destructive' })
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    if (!form) return
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = form.questions.findIndex(q => q.id === active.id)
    const newIndex = form.questions.findIndex(q => q.id === over.id)
    const reordered = arrayMove(form.questions, oldIndex, newIndex).map((q, i) => ({ ...q, order: i + 1 }))

    setForm(prev => prev ? { ...prev, questions: reordered } : prev)
    try {
      await reorderQuestions(id, reordered.map(q => q.id))
    } catch {
      toast({ title: 'Erro ao reordenar perguntas', variant: 'destructive' })
    }
  }

  async function handlePublish() {
    if (!form) return
    try {
      const updated = await updateFormStatus(id, 'PUBLISHED')
      setForm(prev => prev ? { ...prev, status: updated.status, slug: updated.slug } : prev)
      setPublishModalOpen(true)
    } catch (err: any) {
      toast({ title: err.message ?? 'Erro ao publicar', variant: 'destructive' })
    }
  }

  async function handlePause() {
    if (!form) return
    try {
      const updated = await updateFormStatus(id, 'PAUSED')
      setForm(prev => prev ? { ...prev, status: updated.status } : prev)
      toast({ title: 'Formulário pausado' })
    } catch (err: any) {
      toast({ title: err.message ?? 'Erro ao pausar', variant: 'destructive' })
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-full text-gray-400 text-sm">Carregando editor…</div>
  }

  if (!form) return null

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* Topbar do builder */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-white">
        <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard/forms')}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
        </Button>

        <Input
          value={form.title}
          onChange={e => {
            setForm(prev => prev ? { ...prev, title: e.target.value } : prev)
            scheduleFormSave({ title: e.target.value })
          }}
          className="max-w-sm text-sm font-medium border-none shadow-none focus-visible:ring-0 px-0"
          placeholder="Título do formulário"
        />

        <div className="ml-auto flex items-center gap-2">
          <AutoSaveIndicator status={saveStatus} />
          <Button variant="outline" size="sm" onClick={() => window.open(`/api/forms/${id}/preview`, '_blank')}>
            <Eye className="w-4 h-4 mr-1" /> Pré-visualizar
          </Button>
          {form.status === 'PUBLISHED' ? (
            <Button variant="outline" size="sm" onClick={handlePause} className="text-orange-600 border-orange-300 hover:bg-orange-50">
              <PauseCircle className="w-4 h-4 mr-1" /> Pausar
            </Button>
          ) : (
            <Button size="sm" onClick={handlePublish} className="bg-blue-600 hover:bg-blue-700">
              <Globe className="w-4 h-4 mr-1" /> Publicar
            </Button>
          )}
        </div>
      </div>

      {/* Painel principal — dois painéis */}
      <div className="flex flex-1 overflow-hidden">
        {/* Painel esquerdo — lista de perguntas */}
        <div className="w-72 border-r flex flex-col bg-gray-50">
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={form.questions.map(q => q.id)} strategy={verticalListSortingStrategy}>
                {form.questions.map((q, i) => (
                  <QuestionCard
                    key={q.id}
                    question={q}
                    index={i}
                    isSelected={selectedId === q.id}
                    onClick={() => setSelectedId(q.id)}
                    onDelete={() => handleDeleteQuestion(q.id)}
                  />
                ))}
              </SortableContext>
            </DndContext>

            {form.questions.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-8">Nenhuma pergunta ainda. Adicione abaixo.</p>
            )}
          </div>

          <div className="p-3 border-t bg-white">
            <AddQuestionButton onAdd={handleAddQuestion} />
          </div>
        </div>

        {/* Painel direito — editor de pergunta selecionada */}
        <div className="flex-1 overflow-y-auto p-6">
          {selectedQuestion ? (
            <>
              <h2 className="text-sm font-semibold text-gray-700 mb-4">Editando pergunta {form.questions.findIndex(q => q.id === selectedQuestion.id) + 1}</h2>
              <QuestionEditor
                question={selectedQuestion}
                allQuestions={form.questions}
                onChange={data => handleQuestionChange(selectedQuestion.id, data)}
              />
            </>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-gray-400">Selecione uma pergunta para editar</p>
            </div>
          )}
        </div>
      </div>

      <PublishModal
        open={publishModalOpen}
        onClose={() => setPublishModalOpen(false)}
        slug={form.slug}
      />
    </div>
  )
}
```

- [ ] **Passo 2: Type check**

```bash
cd apps/web && npx tsc --noEmit
```
Esperado: sem erros.

- [ ] **Passo 3: Commit**

```bash
git add apps/web/src/app/\(dashboard\)/forms/
git commit -m "feat: página do builder com dois painéis, auto-save e publicação"
```

---

## Tarefa 10 — Página de lista de formulários

**Arquivos:**
- Criar: `apps/web/src/app/(dashboard)/forms/page.tsx`

- [ ] **Passo 1: Criar apps/web/src/app/(dashboard)/forms/page.tsx**

```tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Form, FormStatus } from '@consorte/types'
import { getForms, createForm, deleteForm, updateFormStatus } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { Plus, Edit2, Copy, Trash2, Globe, PauseCircle } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const STATUS_CONFIG: Record<FormStatus, { label: string; className: string }> = {
  [FormStatus.DRAFT]: { label: 'Rascunho', className: 'bg-gray-100 text-gray-600' },
  [FormStatus.PUBLISHED]: { label: 'Publicado', className: 'bg-green-100 text-green-700' },
  [FormStatus.PAUSED]: { label: 'Pausado', className: 'bg-yellow-100 text-yellow-700' },
}

type FormWithCount = Form & { _count?: { responses: number } }

export default function FormsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [forms, setForms] = useState<FormWithCount[]>([])
  const [loading, setLoading] = useState(true)

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  useEffect(() => {
    getForms().then(f => { setForms(f as FormWithCount[]); setLoading(false) })
  }, [])

  async function handleCreate() {
    try {
      const form = await createForm({ title: 'Sem título' })
      router.push(`/dashboard/forms/${form.id}/edit`)
    } catch {
      toast({ title: 'Erro ao criar formulário', variant: 'destructive' })
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Deseja excluir este formulário e todas as respostas?')) return
    try {
      await deleteForm(id)
      setForms(prev => prev.filter(f => f.id !== id))
      toast({ title: 'Formulário excluído' })
    } catch {
      toast({ title: 'Erro ao excluir formulário', variant: 'destructive' })
    }
  }

  async function handleToggleStatus(form: FormWithCount) {
    const newStatus = form.status === 'PUBLISHED' ? 'PAUSED' : 'PUBLISHED'
    try {
      const updated = await updateFormStatus(form.id, newStatus)
      setForms(prev => prev.map(f => f.id === form.id ? { ...f, status: updated.status } : f))
      toast({ title: newStatus === 'PUBLISHED' ? 'Formulário publicado' : 'Formulário pausado' })
    } catch (err: any) {
      toast({ title: err.message ?? 'Erro ao atualizar status', variant: 'destructive' })
    }
  }

  function handleCopyLink(slug: string) {
    navigator.clipboard.writeText(`${appUrl}/f/${slug}`)
    toast({ title: 'Link copiado!' })
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-20 bg-gray-100 rounded-lg" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Meus formulários</h1>
        <Button onClick={handleCreate}>
          <Plus className="w-4 h-4 mr-2" /> Novo formulário
        </Button>
      </div>

      {forms.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed rounded-xl">
          <p className="text-gray-500 mb-4">Você ainda não tem formulários.</p>
          <Button onClick={handleCreate}>
            <Plus className="w-4 h-4 mr-2" /> Criar primeiro formulário
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {forms.map(form => {
            const statusConfig = STATUS_CONFIG[form.status]
            return (
              <div key={form.id} className="flex items-center gap-4 p-4 bg-white border rounded-xl hover:border-gray-300 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="font-medium text-sm truncate">{form.title || 'Sem título'}</h2>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusConfig.className}`}>
                      {statusConfig.label}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">
                    {(form as any)._count?.responses ?? 0} respostas · criado {formatDistanceToNow(new Date(form.createdAt), { locale: ptBR, addSuffix: true })}
                  </p>
                </div>

                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => router.push(`/dashboard/forms/${form.id}/edit`)}>
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  {form.status === 'PUBLISHED' && (
                    <Button variant="ghost" size="sm" onClick={() => handleCopyLink(form.slug)}>
                      <Copy className="w-4 h-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggleStatus(form)}
                    className={form.status === 'PUBLISHED' ? 'text-orange-500' : 'text-green-600'}
                  >
                    {form.status === 'PUBLISHED' ? <PauseCircle className="w-4 h-4" /> : <Globe className="w-4 h-4" />}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(form.id)} className="text-red-400 hover:text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Passo 2: Instalar date-fns**

```bash
cd apps/web && npm install date-fns
```

- [ ] **Passo 3: Type check final**

```bash
cd apps/web && npx tsc --noEmit
cd apps/api && npx tsc --noEmit
```
Esperado: sem erros nos dois apps.

- [ ] **Passo 4: Commit final**

```bash
git add apps/web/src/app/\(dashboard\)/forms/
git commit -m "feat: página de lista de formulários com criação, edição, status e exclusão"
```

---

## Tarefa 11 — Verificação e testes end-to-end

- [ ] **Passo 1: Rodar CI localmente**

```bash
cd apps/api && npm run lint && npm run build
cd apps/web && npm run lint && npm run build
```
Esperado: lint e build sem erros.

- [ ] **Passo 2: Rodar testes unitários**

```bash
cd apps/api && npx vitest run
```
Esperado: todos os testes em verde (formService.test.ts).

- [ ] **Passo 3: Verificar fluxo completo manualmente**

1. Acessar `/dashboard/forms` — página de lista carrega
2. Clicar "Novo formulário" — redireciona para `/dashboard/forms/[id]/edit`
3. Editar título — indicador "Salvando…" aparece, depois "Salvo"
4. Clicar "Adicionar pergunta" — QuestionTypePicker abre sem tipo selecionado
5. Clicar "Confirmar" sem selecionar tipo — erro inline + animação shake, modal não fecha
6. Selecionar "Múltipla escolha" + Confirmar — pergunta aparece na lista
7. Adicionar opção de escala — lógica condicional configurada
8. Reordenar perguntas via drag-and-drop
9. Excluir pergunta — confirmação aparece, pergunta removida
10. Clicar "Publicar" — formulário sem título bloqueia com erro
11. Adicionar título + publicar — PublishModal com link copiável abre

- [ ] **Passo 4: Commit de verificação**

```bash
git add .
git commit -m "chore: verificação final da Etapa 3 — builder de formulários"
```

---

## Resumo de Arquivos Criados/Modificados

| Arquivo | Ação |
|---------|------|
| `packages/types/src/index.ts` | Modificado — adicionado Form, Question, Condition |
| `apps/api/src/services/formService.ts` | Criado |
| `apps/api/src/services/formService.test.ts` | Criado |
| `apps/api/src/routes/forms.ts` | Criado |
| `apps/api/src/routes/questions.ts` | Criado |
| `apps/api/src/index.ts` | Modificado — registrar novas rotas |
| `apps/web/src/lib/api.ts` | Modificado — funções tipadas |
| `apps/web/tailwind.config.ts` | Modificado — animação shake |
| `apps/web/src/components/builder/QuestionTypePicker.tsx` | Criado |
| `apps/web/src/components/builder/AutoSaveIndicator.tsx` | Criado |
| `apps/web/src/components/builder/QuestionCard.tsx` | Criado |
| `apps/web/src/components/builder/ConditionEditor.tsx` | Criado |
| `apps/web/src/components/builder/QuestionEditor.tsx` | Criado |
| `apps/web/src/components/builder/PublishModal.tsx` | Criado |
| `apps/web/src/app/(dashboard)/forms/page.tsx` | Criado |
| `apps/web/src/app/(dashboard)/forms/[id]/edit/page.tsx` | Criado |
