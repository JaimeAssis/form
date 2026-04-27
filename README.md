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

Insere os 10 templates pré-prontos por nicho (influencer, advogado, produtor de eventos, agência de marketing, arquiteto, nutricionista, personal trainer, editor de vídeo, designer, fotógrafo).

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
| `npm install` (raiz) | Instala dependências de todos os apps |
| `cd apps/api && npm run db:migrate` | Roda migrations do Prisma |
| `cd apps/api && npm run db:seed` | Insere os 10 templates |
| `cd apps/api && npm test` | Roda os 27 testes Vitest |
| `stripe listen --forward-to localhost:3001/webhooks/stripe` | Encaminha eventos Stripe locais |
