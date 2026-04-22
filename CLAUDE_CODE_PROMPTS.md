# Consorte Form — Prompts para o Claude Code
> Cole cada prompt no início de uma nova conversa no Claude Code.
> Sempre anexe o arquivo `CONSORTE_FORM_FRAMEWORK.md` junto com o prompt.
> Execute uma etapa por vez. Só avance para a próxima após validar a atual.

---

## ETAPA 1 — Fundação do projeto

```
Você vai construir o Consorte Form, um SaaS de formulários interativos passo a passo para prestadores de serviço. O framework completo do projeto está no arquivo CONSORTE_FORM_FRAMEWORK.md — leia-o inteiro antes de começar.

Nesta etapa, execute APENAS a fundação do projeto. Não implemente nenhuma feature de produto ainda.

O que deve ser entregue nesta etapa:

ESTRUTURA DE PASTAS
Crie a estrutura monorepo conforme a seção 14 do framework:
- apps/web → Next.js 14 com App Router + TypeScript + Tailwind CSS + shadcn/ui
- apps/api → Node.js + Fastify + TypeScript
- packages/types → tipos compartilhados entre web e api

BANCO DE DADOS
- Configure o Prisma com o schema completo da seção 5 do framework
- Todos os models: User, Form, Question, Condition, Response, Answer, Payment, Template
- Todos os enums: Plan, FormStatus, QuestionType, ResponseStatus, PaymentType, PaymentStatus
- Rode prisma migrate dev e confirme que não há erros
- Crie o arquivo prisma/seed.ts (vazio por enquanto — será preenchido na Etapa 6)

VARIÁVEIS DE AMBIENTE
- Crie .env.example com todas as variáveis da seção 13 do framework
- Crie .env.local para desenvolvimento com placeholders comentados
- Configure o carregamento correto no Next.js e no Fastify

CONFIGURAÇÕES BASE
- ESLint + Prettier configurados com regras consistentes entre web e api
- tsconfig.json em cada app com paths configurados
- Tailwind CSS configurado no apps/web com o tema base
- shadcn/ui inicializado com os componentes: Button, Input, Textarea, Select, Toast, Dialog, Badge

SUPABASE
- Configure o cliente Supabase no Next.js (apps/web/lib/supabase.ts) para client-side e server-side
- Configure o cliente Supabase no Fastify (apps/api/src/lib/supabase.ts) com service role key
- Confirme a conexão com o banco via DATABASE_URL

CI/CD
- Crie .github/workflows/ci.yml com: lint, type-check e build nos dois apps
- O pipeline deve rodar em push para main e em pull requests

DEPLOY
- Configure vercel.json para o apps/web
- Configure Railway para o apps/api (crie railway.toml ou Dockerfile mínimo)

Restrições importantes:
- NÃO implemente nenhuma tela, rota de API ou lógica de negócio ainda
- NÃO implemente autenticação ainda — isso é Etapa 2
- O objetivo desta etapa é: projeto roda localmente com `npm run dev`, banco conectado, tipos gerados pelo Prisma, CI verde

Ao finalizar, mostre:
1. Estrutura de pastas gerada
2. Output do `prisma migrate dev`
3. Comando para rodar o projeto localmente
```

---

## ETAPA 2 — Autenticação & Perfil

```
Você está construindo o Consorte Form. O framework completo está no arquivo CONSORTE_FORM_FRAMEWORK.md. A Etapa 1 (fundação) já foi concluída — o projeto já tem a estrutura de pastas, Prisma configurado e CI funcionando.

Nesta etapa, implemente APENAS autenticação e perfil do prestador. Não implemente nenhuma feature do builder ou dashboard ainda.

O que deve ser entregue nesta etapa:

SUPABASE AUTH — BACKEND (apps/api)
- Middleware de autenticação: verificar JWT do Supabase em todas as rotas protegidas
- Extrair userId do token e injetar no request context do Fastify
- Retornar 401 para requests sem token válido
- Rota GET /auth/me → retorna dados do usuário logado (User do banco)
- Hook pós-cadastro: quando Supabase cria usuário, criar registro na tabela User do Prisma

SUPABASE AUTH — FRONTEND (apps/web)
- Configurar Supabase Auth helpers para Next.js App Router
- Middleware Next.js (middleware.ts): proteger rotas do dashboard, redirecionar não autenticados para /login
- Rotas públicas: /, /login, /signup, /recover, /f/[slug], /p/[slug]
- Rotas protegidas: /dashboard e tudo abaixo

TELAS — AUTENTICAÇÃO (apps/web/app/(auth)/)
Criar as seguintes telas com design limpo usando Tailwind + shadcn/ui:

/login
- Campo e-mail + senha
- Botão "Entrar com Google" (OAuth Google via Supabase)
- Link para /signup e /recover
- Redirect para /dashboard após login bem-sucedido

/signup
- Campo nome + e-mail + senha
- Botão "Cadastrar com Google"
- Após cadastro: redirecionar para /onboarding

/recover
- Campo e-mail
- Enviar e-mail de recuperação via Supabase
- Tela de confirmação após envio

/onboarding
- Tela pós-cadastro (só aparece uma vez)
- Campos: nome de exibição, nicho de atuação (select com os 10 nichos do framework seção 16)
- Gera o slug público do prestador a partir do nome (ex: "Lucas Rodrigues" → "lucas-rodrigues")
- Salvar no banco e redirecionar para /dashboard

TELAS — PERFIL (apps/web/app/(dashboard)/settings/)
/settings/profile
- Editar nome, foto de perfil (upload para Cloudflare R2), nicho
- Exibir URL pública do formulário: consorteform.com/p/[slug]
- Botão copiar link do perfil

PERFIL PÚBLICO (apps/web/app/p/[slug]/)
- Página pública do prestador (sem autenticação)
- Exibe nome, foto, nicho e lista de formulários publicados
- Design simples e responsivo

ROTAS DE API necessárias nesta etapa:
- GET /auth/me
- PUT /users/profile (atualizar nome, nicho, foto)
- GET /users/:slug/public (dados públicos do prestador)

Restrições importantes:
- NÃO implemente builder, formulário público ou dashboard de respostas ainda
- O /dashboard pode ser uma tela vazia com navbar e mensagem "Em construção" — será preenchido nas próximas etapas
- Use os tipos do packages/types para User e Plan

Ao finalizar, demonstre:
1. Fluxo completo: cadastro → onboarding → /dashboard
2. Login com Google funcionando
3. Rota protegida redirecionando para /login quando não autenticado
4. GET /auth/me retornando dados corretos com token válido
```

---

## ETAPA 3 — Builder de formulários

```
Você está construindo o Consorte Form. O framework completo está no arquivo CONSORTE_FORM_FRAMEWORK.md. As Etapas 1 e 2 já foram concluídas — fundação e autenticação estão funcionando.

Nesta etapa, implemente APENAS o builder de formulários. O formulário público (respondente) será implementado na Etapa 4.

Esta é a feature mais complexa do produto. Leia com atenção a seção 6 (Módulo 2 — Builder) e a seção 10 (Critérios de Aceitação) do framework antes de começar.

O que deve ser entregue nesta etapa:

ROTAS DE API (apps/api) — implementar todas da seção 7 do framework:
- GET    /forms
- POST   /forms (aceitar templateId opcional — lógica de cópia de template será na Etapa 6, por ora criar formulário vazio)
- GET    /forms/:id
- PUT    /forms/:id
- DELETE /forms/:id
- PATCH  /forms/:id/status
- GET    /forms/:id/preview (sem autenticação)
- POST   /forms/:id/questions
- PUT    /forms/:id/questions/:qid
- DELETE /forms/:id/questions/:qid
- PATCH  /forms/:id/questions/reorder

Validações obrigatórias no backend:
- Publicar formulário sem título → 400 com mensagem clara
- Publicar formulário sem perguntas → 400
- Lógica condicional com referência circular → 422 (conforme regra de negócio 3 da seção 9)
- Lógica condicional só em MULTIPLE_CHOICE, MULTIPLE_SELECT, SCALE → 422 para outros tipos
- Plano Free: verificar se já tem 1 formulário PUBLISHED antes de publicar outro → 403

COMPONENTE QuestionTypePicker (apps/web/components/builder/)
Este componente já foi especificado e parcialmente implementado. Implemente conforme a seção 11 do framework:
- Modal com seletor de 5 tipos: SHORT_TEXT, LONG_TEXT, MULTIPLE_CHOICE, MULTIPLE_SELECT, SCALE
- Nenhum tipo pré-selecionado ao abrir
- Preview não-interativo de cada tipo ao fazer hover
- Confirmar sem selecionar: mensagem de erro inline + animação shake, modal não fecha
- Tecla Escape fecha, Enter confirma se tipo selecionado
- buildQuestion(type): factory que cria objeto Question com defaults corretos por tipo
- MULTIPLE_CHOICE e MULTIPLE_SELECT: options: ['Opção 1', 'Opção 2']
- SCALE: scaleMin: 'Discordo', scaleMax: 'Concordo'

TELA DO BUILDER (apps/web/app/(dashboard)/forms/[id]/edit)
Layout em duas colunas: lista de perguntas (esquerda) + painel de edição da pergunta selecionada (direita)

Lista de perguntas:
- Drag-and-drop para reordenar usando @dnd-kit/sortable
- Cada card: número, título (ou "Sem título"), badge com tipo, ícone de excluir
- Botão "Adicionar pergunta" no final → abre QuestionTypePicker
- Indicador de auto-save: "Salvando…" / "Salvo" / "Erro ao salvar — tentando novamente"

Painel de edição (ao clicar em uma pergunta):
- Campo de título (max 280 chars com contador a partir de 80%)
- Campo de descrição opcional
- Toggle obrigatória/opcional
- Configuração específica por tipo:
  - MULTIPLE_CHOICE / MULTIPLE_SELECT: lista de opções editáveis, botão adicionar (max 10), Enter cria próxima, botão remover por opção
  - SCALE: campos de label mínimo e máximo
  - SHORT_TEXT / LONG_TEXT: sem configuração extra
- Seção "Lógica condicional": dropdown para escolher pergunta gatilho + valor, somente se há perguntas de choice/scale antes desta

Auto-save:
- Debounce de 800ms após qualquer alteração
- PUT /forms/:id ou PUT /forms/:id/questions/:qid
- Em erro de rede: retry com exponential backoff (3s, 6s, 12s) conforme fluxo da seção 8
- Nunca exibir "Salvo" se o request falhou

TELA DE LISTA DE FORMULÁRIOS (apps/web/app/(dashboard)/forms)
- Cards com: título, status (DRAFT/PUBLISHED/PAUSED), número de respostas, data de criação
- Botão "Novo formulário" → abre modal de criação (por ora sem templates — Etapa 6)
- Ações por card: editar, copiar link público, pausar/publicar, excluir (com confirmação)

PUBLICAÇÃO E LINK PÚBLICO
- Botão "Publicar" no builder: valida título e perguntas, chama PATCH /forms/:id/status
- Após publicar: modal com link copiável (consorteform.com/f/[slug])
- Slug: gerado a partir do título em kebab-case + sufixo aleatório de 4 chars para evitar colisão
- Botão "Pausar" disponível em formulários publicados

Restrições importantes:
- NÃO implemente o formulário público (visão do respondente) ainda — isso é Etapa 4
- NÃO implemente dashboard de respostas — isso é Etapa 5
- O builder deve funcionar offline com auto-save — testar desconectando a rede

Critérios de aceite obrigatórios (seção 10 do framework):
Implemente e teste todos os critérios CF-B01, CF-B02, CF-B03 e CF-B04 antes de considerar a etapa concluída.

Ao finalizar, demonstre:
1. Criar formulário com 5 tipos de campo diferentes
2. Lógica condicional funcionando no builder
3. Auto-save sendo chamado após edição (verificar no network tab)
4. Tentativa de lógica circular sendo rejeitada pelo backend com erro claro
5. Publicar e copiar o link público
```

---

## ETAPA 4 — Formulário público (experiência do respondente)

```
Você está construindo o Consorte Form. O framework completo está no arquivo CONSORTE_FORM_FRAMEWORK.md. As Etapas 1, 2 e 3 já foram concluídas — fundação, autenticação e builder estão funcionando.

Nesta etapa, implemente APENAS o formulário público — a experiência do cliente do cliente (respondente). Não implemente dashboard de respostas nem pagamentos ainda.

O que deve ser entregue nesta etapa:

ROTA DE API (apps/api):
GET /p/:slug → retorna formulário publicado com todas as questions e conditions. Sem autenticação. Retornar 404 se slug não existir ou formulário não estiver PUBLISHED.

POST /p/:slug/submit → recebe as respostas do respondente
- Validar que o formulário está PUBLISHED (não PAUSED) → 404 se pausado
- Validar perguntas obrigatórias (considerando lógica condicional — pergunta oculta não é obrigatória)
- Criar Response + Answers no banco
- Verificar plano do owner do formulário:
  - Se FREE: contar responses do mês atual
  - Se count < 10: salvar com status UNLOCKED
  - Se count >= 10: salvar com status QUARANTINED
  - Se PRO ou AGENCY: sempre salvar como UNLOCKED
- Rate limiting: máximo 10 submissões por IP por hora (Redis via Upstash)
- Retornar 200 para o respondente independente do status (ele não sabe da quarentena)

TELA DO FORMULÁRIO PÚBLICO (apps/web/app/f/[slug]/)
Esta é a tela mais importante para o produto — deve ser impecável no mobile.

Tela de boas-vindas (/f/[slug]):
- Logo/foto do prestador (se configurado)
- Título do formulário
- Descrição/mensagem de boas-vindas
- Botão "Começar →"
- Sem header/navbar do dashboard — tela limpa e focada
- Se formulário PAUSED: exibir página "Este formulário não está disponível no momento"
- Se formulário não encontrado: 404 customizado

Tela de pergunta (/f/[slug] — estado interno, sem mudança de URL):
- UMA pergunta por vez (não mudar URL a cada pergunta — gerenciar estado no cliente)
- Barra de progresso no topo: progresso real considerando perguntas visíveis pela lógica condicional
- Número da pergunta: "Pergunta X de Y" (Y = total de perguntas visíveis)
- Título da pergunta + descrição (se houver) + indicador de obrigatória (*)
- Componente de resposta por tipo:
  - SHORT_TEXT: input de texto simples
  - LONG_TEXT: textarea com auto-resize
  - MULTIPLE_CHOICE: cards clicáveis (radio) — um por linha, mobile-first
  - MULTIPLE_SELECT: cards clicáveis (checkbox) — um por linha
  - SCALE: 5 botões numerados lado a lado com labels de extremo abaixo
- Botão "Próximo →" ou "Enviar" na última pergunta
- Botão "← Voltar" (exceto na primeira pergunta)
- Validação ao avançar: se obrigatória e vazia → mensagem de erro inline, não avança

Lógica condicional no frontend:
- Antes de exibir cada pergunta, avaliar sua condição
- Se condição não atendida: pular para a próxima pergunta (sem exibir)
- Recalcular progresso dinamicamente com base nas perguntas visíveis
- Pergunta pulada não entra no payload de submit

Tela de conclusão:
- Mensagem de agradecimento personalizada (do campo thankYouTitle/thankYouMessage do Form)
- Se não configurado: "Obrigado! Suas respostas foram enviadas com sucesso."
- Sem botão de voltar ou refazer
- Animação sutil de sucesso

DESIGN E UX — requisitos obrigatórios:
- 100% responsivo — testar em 375px (iPhone SE) e 390px (iPhone 14)
- Fonte legível, mínimo 16px nas perguntas
- Área de toque mínima de 44px em todas as opções
- Animação de transição entre perguntas (slide ou fade — suave, < 300ms)
- Loading state no botão "Enviar" enquanto o POST está em andamento
- Tratar erro de rede no submit: "Algo deu errado, tente novamente"
- NÃO exibir header/navbar do Consorte Form — o respondente não precisa saber que é o Consorte Form (será white-label no futuro)

Restrições importantes:
- NÃO implemente pagamentos nem quarentena no frontend ainda — isso é Etapa 5
- NÃO implemente notificações por e-mail ainda — isso é Etapa 6
- O endpoint de submit deve funcionar corretamente com a lógica de quarentena no BACKEND, mas o FRONTEND do respondente não mostra nada disso

Ao finalizar, demonstre:
1. Formulário completo preenchido no celular (screenshot ou descrição)
2. Lógica condicional: preencher opção que ativa pergunta → pergunta aparece; preencher outra opção → pergunta some
3. Tentativa de avançar sem responder pergunta obrigatória → erro inline
4. Submit retornando 200 com resposta salva no banco
5. Formulário pausado exibindo página de indisponibilidade
6. Rate limiting: 11ª submissão do mesmo IP bloqueada
```

---

## ETAPA 5 — Dashboard de respostas + Overage

```
Você está construindo o Consorte Form. O framework completo está no arquivo CONSORTE_FORM_FRAMEWORK.md. As Etapas 1 a 4 já foram concluídas.

Nesta etapa, implemente o dashboard de respostas completo e toda a mecânica de overage com Stripe. Esta é a etapa mais sensível do projeto — leia com atenção a seção 3 (Pricing/Overage), a seção 8 (Fluxos Críticos) e a seção 9 (Regras de Negócio) do framework.

O que deve ser entregue nesta etapa:

ROTAS DE API (apps/api):
- GET /forms/:id/responses → lista de respostas com campos: id, respondentName, createdAt, status (UNLOCKED/QUARANTINED). Para respostas QUARANTINED: retornar apenas esses campos, nunca os answers.
- GET /forms/:id/responses/:rid → resposta individual. Se QUARANTINED e não paga → retornar 402 com { status: 'quarantined', paymentRequired: true, amount: 300 }. Se UNLOCKED → retornar resposta completa com answers.
- POST /payments/overage/intent → criar Stripe PaymentIntent de R$ 3,00 (300 centavos) para uma responseId específica. Salvar Payment no banco com status PENDING.
- POST /payments/overage/pack → criar PaymentIntent de R$ 20,00 (2000 centavos) para pacote de 20 respostas. Salvar Payment no banco.
- POST /webhooks/stripe → receber eventos do Stripe. Processar payment_intent.succeeded: atualizar Payment.status = PAID e Response.status = UNLOCKED para a resposta vinculada. IMPORTANTE: verificar assinatura do webhook com STRIPE_WEBHOOK_SECRET antes de processar qualquer evento.

STRIPE — configuração:
- Instalar stripe SDK no apps/api
- Configurar Stripe com a secret key
- Endpoint de webhook deve ser registrado no dashboard Stripe apontando para /webhooks/stripe
- Em desenvolvimento: usar `stripe listen --forward-to localhost:3001/webhooks/stripe`
- Testar com cartão de teste 4242 4242 4242 4242

TELA — Dashboard de respostas (apps/web/app/(dashboard)/forms/[id]/responses)
Lista de respostas:
- Tabela/lista com: número sequencial, nome do respondente (ou "Anônimo"), data/hora, status visual (ícone verde = desbloqueada, ícone laranja = em quarentena)
- Ordenação: mais recentes primeiro
- Clicar em resposta desbloqueada → abre visualização completa
- Clicar em resposta em quarentena → abre modal de pagamento

Visualização individual de resposta desbloqueada:
- Header: nome, data/hora
- Lista de perguntas com resposta de cada uma — mesmo que a pergunta tenha sido ignorada por lógica condicional (exibir como "não respondida")
- Botão "← Voltar para lista"

Modal de resposta em quarentena:
- Exibir: nome do respondente + data/hora (esses campos sempre visíveis)
- Conteúdo das respostas: bloqueado com blur ou placeholder "●●●●●"
- Texto: "Você atingiu o limite de 10 respostas gratuitas este mês"
- Custo acumulado do mês: "Você já pagou R$ X,00 este mês"
- Comparativo: "A partir de 22 respostas/mês, o plano Pro (R$ 57) é mais econômico"
- Botão primário: "Pagar R$ 3,00 para ver esta resposta"
- Botão secundário: "Ver plano Pro"
- Opção de pacote: "Ou adquira 20 respostas por R$ 20,00"

Fluxo de pagamento de overage:
1. Usuário clica "Pagar R$ 3,00"
2. POST /payments/overage/intent → recebe clientSecret do PaymentIntent
3. Exibir Stripe Payment Element (embedded) no modal
4. Usuário insere cartão e confirma
5. Stripe confirma → webhook recebido → Response.status = UNLOCKED
6. Frontend: polling a cada 2s por até 30s em GET /forms/:id/responses/:rid até receber status UNLOCKED
7. Modal fecha, resposta exibida normalmente

Banner de custo acumulado (no topo do dashboard de respostas para usuários Free):
- "Você usou X de 10 respostas gratuitas este mês"
- Se tiver respostas em quarentena: "Você tem Y respostas bloqueadas · Custo acumulado: R$ Z,00"
- Se custo acumulado >= R$ 40: "Você está perto do valor do Pro. Assine por R$ 57/mês e libere tudo."
- Barra de progresso visual do limite mensal

Restrições importantes:
- NUNCA confiar no frontend para determinar se uma resposta está em quarentena — sempre validar no backend
- O webhook do Stripe deve verificar a assinatura — não processar eventos sem validação
- Em desenvolvimento usar Stripe test mode (chaves sk_test_ e pk_test_)
- NÃO implementar assinaturas Pro/Agência ainda — isso é Etapa 6

Ao finalizar, demonstre:
1. Enviar 11 respostas para um formulário Free → 11ª aparece como quarentena no dashboard
2. Clicar na resposta em quarentena → modal com conteúdo bloqueado
3. Pagar com cartão de teste 4242 → webhook recebido → resposta desbloqueada
4. Banner mostrando custo acumulado e comparativo com Pro
5. Tentar acessar GET /forms/:id/responses/:rid de resposta quarentinada sem pagamento → receber 402
```

---

## ETAPA 6 — Planos, templates e gates de feature

```
Você está construindo o Consorte Form. O framework completo está no arquivo CONSORTE_FORM_FRAMEWORK.md. As Etapas 1 a 5 já foram concluídas.

Nesta etapa, implemente os planos Pro e Agência via Stripe Subscriptions, todos os 10 templates pré-prontos, os gates de feature por plano e as notificações de nova resposta por e-mail.

O que deve ser entregue nesta etapa:

STRIPE SUBSCRIPTIONS
Criar os produtos e preços no Stripe (via código ou dashboard):
- Produto "Pro Mensal": R$ 57,00/mês → price_id_pro_monthly
- Produto "Pro Anual": R$ 47,00/mês cobrado anualmente → price_id_pro_annual
- Produto "Agência Mensal": R$ 127,00/mês → price_id_agency_monthly
- Produto "Agência Anual": R$ 107,00/mês cobrado anualmente → price_id_agency_annual

Rotas de API para assinaturas:
- POST /payments/subscription/checkout → criar Stripe Checkout Session para o plano escolhido. Retornar URL de checkout.
- POST /webhooks/stripe → já existe, adicionar handlers para: customer.subscription.created, customer.subscription.updated, customer.subscription.deleted → atualizar User.plan no banco (FREE/PRO/AGENCY)
- GET /payments/subscription → retornar assinatura atual do usuário (plano, próxima cobrança, status)
- POST /payments/subscription/portal → criar sessão do Stripe Customer Portal para gerenciar/cancelar assinatura

MIDDLEWARE DE PLANO (planGuard)
Criar middleware planGuard(requiredPlan: Plan[]) no Fastify que:
- Verifica User.plan do usuário autenticado
- Retorna 403 com { error: 'PLAN_REQUIRED', requiredPlan, currentPlan } se não autorizado
- Aplicar nas rotas:
  - GET /forms/:id/responses/export → ['PRO', 'AGENCY']
  - Personalização de marca (logoUrl, brandColor) → verificar no PUT /forms/:id — ignorar campos se FREE

TELA DE UPGRADE (apps/web/app/(dashboard)/upgrade)
- Cards dos 3 planos (Free, Pro, Agência) conforme seção 3 do framework
- Toggle mensal/anual com desconto de 17% exibido
- Botão de assinar → POST /payments/subscription/checkout → redirecionar para Stripe Checkout
- Após pagamento bem-sucedido: Stripe redireciona para /dashboard?upgraded=true → exibir toast de boas-vindas
- Link para gerenciar assinatura → POST /payments/subscription/portal → redirecionar para Customer Portal

TEMPLATES PRÉ-PRONTOS — SEED
Implementar o seed completo conforme a seção 16 do framework. O arquivo prisma/seed.ts deve inserir todos os 10 templates:
1. Influenciador / Creator (influencer-parceria)
2. Advogado (lawyer-intake)
3. Produtor de eventos (event-producer-briefing)
4. Agência de marketing (marketing-agency-onboarding)
5. Arquiteto / Decorador (architect-interior-briefing)
6. Nutricionista (nutritionist-anamnese)
7. Personal trainer (personal-trainer-anamnese)
8. Editor de vídeo (video-editor-briefing)
9. Designer gráfico (designer-briefing)
10. Fotógrafo (photographer-briefing)

Cada template deve ter todas as perguntas, tipos, opções, obrigatoriedade e lógica condicional exatamente conforme especificado na seção 16.

Rodar: npx prisma db seed

TELA DE SELEÇÃO DE TEMPLATE (apps/web/app/(dashboard)/forms/new)
Exibida ao criar novo formulário:
- Título: "Como quer começar?"
- Grid de cards: um por template + card "Criar do zero"
- Cada card: ícone do nicho + nome do template + descrição de 1 linha
- Ao selecionar template: POST /forms com { templateId } → backend copia questions → redirecionar para /forms/[id]/edit com builder já preenchido
- Ao selecionar "Criar do zero": POST /forms sem templateId → builder vazio

Rota de API atualizada:
- POST /forms → se body.templateId: buscar Template no banco, copiar questions para o novo Form, gerar ids novos para cada Question

NOTIFICAÇÕES DE NOVA RESPOSTA (Resend)
- Instalar Resend SDK no apps/api
- Criar template de e-mail HTML simples (React Email) para notificação de nova resposta
- Conteúdo: "Você recebeu uma nova resposta em [nome do formulário]", nome do respondente, data/hora, botão "Ver resposta →" com link direto
- Trigger: no endpoint POST /p/:slug/submit, após salvar a response com status UNLOCKED, disparar e-mail para o owner do formulário SE o plano for PRO ou AGENCY
- NÃO enviar para Free (feature exclusiva do Pro+)
- Usar fila BullMQ (Redis/Upstash) para não bloquear o response do respondente: submit retorna 200 imediatamente, e-mail entra na fila

PERSONALIZAÇÃO DE MARCA NO FORMULÁRIO PÚBLICO
- No formulário público (/f/[slug]), exibir logo e cor primária do prestador SE existirem no Form
- Aplicar brandColor como cor do botão "Próximo", barra de progresso e elementos de destaque
- Exibir logoUrl no topo da tela de boas-vindas
- Esses campos só podem ser salvos por usuários Pro+ (planGuard no backend)
- No builder, exibir seção "Personalização de marca" com upload de logo e color picker — mostrar aviso de upgrade se Free

Restrições importantes:
- Testar o webhook de subscription com: stripe trigger customer.subscription.created
- O upgrade de plano deve atualizar User.plan imediatamente via webhook — não depender do frontend
- O seed de templates deve ser idempotente: verificar se template com o slug já existe antes de inserir

Ao finalizar, demonstre:
1. Assinar plano Pro → User.plan atualizado para PRO no banco
2. Acessar exportação CSV como Free → receber 403
3. Acessar exportação CSV como Pro → download do arquivo
4. Criar formulário a partir do template de Influenciador → builder carregado com todas as perguntas
5. Criar formulário do zero → builder vazio
6. Enviar resposta para formulário Pro → e-mail de notificação recebido
```

---

## ETAPA 7 — Polish, observabilidade e exportação

```
Você está construindo o Consorte Form. O framework completo está no arquivo CONSORTE_FORM_FRAMEWORK.md. As Etapas 1 a 6 já foram concluídas. O produto está funcional — esta etapa é de polimento, observabilidade e features finais.

O que deve ser entregue nesta etapa:

SENTRY — MONITORAMENTO DE ERROS
- Instalar @sentry/nextjs no apps/web e @sentry/node no apps/api
- Configurar com a SENTRY_DSN do .env
- Frontend: capturar erros não tratados + Source Maps no build
- Backend: capturar erros não tratados nas rotas Fastify + contexto do userId quando disponível
- Testar: provocar erro proposital e verificar que aparece no dashboard do Sentry

POSTHOG — ANALYTICS DE PRODUTO
- Instalar posthog-js no apps/web
- Inicializar com NEXT_PUBLIC_POSTHOG_KEY no layout raiz
- Identificar usuário após login: posthog.identify(userId, { plan, nicho })
- Capturar eventos principais:
  - form_created (templateId se usou template, ou 'scratch')
  - form_published (formId, questionCount)
  - response_received (formId, isQuarantined)
  - overage_paid (amount, responseId)
  - upgrade_started (fromPlan, toPlan, billing: 'monthly'|'annual')
  - upgrade_completed (plan, billing)
  - template_selected (templateSlug)
- NÃO capturar conteúdo de respostas — apenas metadados

EXPORTAÇÃO DE RESPOSTAS (Pro/Agência)
Rota GET /forms/:id/responses/export já tem o guard de plano da Etapa 6. Implementar o conteúdo:

CSV:
- Header: Data, Respondente, [título de cada pergunta]
- Uma linha por resposta
- Para MULTIPLE_SELECT: valores separados por ponto e vírgula dentro da célula
- Encoding UTF-8 com BOM (para abrir corretamente no Excel brasileiro)
- Content-Disposition: attachment; filename="respostas-[slug]-[data].csv"

PDF:
- Usar biblioteca pdfkit ou puppeteer para gerar PDF
- Layout: cabeçalho com nome do formulário + data de exportação, uma resposta por página ou seção clara
- Incluir nome do respondente e data de cada resposta

Botão de exportar no dashboard de respostas (Pro/Agência):
- Dropdown: "Exportar CSV" / "Exportar PDF"
- Para Free: botão visível mas desabilitado com tooltip "Disponível no plano Pro"

PRÉ-VISUALIZAÇÃO AO VIVO NO BUILDER (Pro/Agência)
- Painel lateral direito no builder com pré-visualização em tempo real
- Exibe como o formulário vai aparecer para o respondente
- Atualiza a cada mudança (debounce 500ms)
- Mostrar apenas pergunta atual com navegação simulada
- Para Free: exibir aviso de upgrade no lugar do preview

MELHORIAS DE UX GERAIS
- Skeleton loading em todas as listas (formulários, respostas) — nunca tela em branco durante carregamento
- Toast de confirmação com undo nas ações destrutivas (excluir pergunta, excluir formulário)
- Empty states com ilustração e CTA para todos os estados vazios:
  - Sem formulários: "Crie seu primeiro formulário" + botão
  - Sem respostas: "Compartilhe o link do formulário para começar a receber respostas" + botão copiar link
- 404 e 500 customizados com link para voltar ao dashboard
- Favicon e meta tags (og:title, og:description, og:image) para as páginas públicas
- Loader global de rota no Next.js (loading.tsx nos segmentos principais)

PERFORMANCE
- Verificar que o formulário público (/f/[slug]) tem LCP < 2s em conexão 4G simulada (Chrome DevTools → Network throttling)
- Adicionar next/image para todas as imagens (logo do prestador, foto de perfil)
- Verificar que o builder não trava ao digitar (INP < 200ms) com 20 perguntas carregadas

DOCUMENTAÇÃO FINAL
Criar README.md na raiz do projeto com:
- Descrição do produto
- Stack técnica resumida
- Como rodar localmente (passo a passo)
- Como rodar o seed de templates
- Variáveis de ambiente necessárias (remeter ao .env.example)
- Comandos úteis (migrate, seed, stripe listen, etc.)
- Estrutura de pastas resumida

Restrições:
- NÃO adicionar novas features de produto — esta etapa é de qualidade e observabilidade
- Priorizar o que afeta diretamente a experiência do usuário final (Sentry, skeletons, empty states) sobre itens internos

Ao finalizar, demonstre:
1. Erro proposital aparecendo no Sentry com userId e contexto
2. Evento form_published aparecendo no PostHog
3. Exportar respostas como CSV e abrir no Excel sem problemas de encoding
4. Empty state na tela de formulários de um usuário novo
5. LCP do formulário público < 2s no throttling de 4G
```

---

## Instruções gerais para todas as etapas

> Copie este bloco junto com cada prompt quando julgar necessário.

```
Instruções gerais que se aplicam a todas as etapas:

QUALIDADE DE CÓDIGO
- TypeScript strict mode — sem any implícito
- Todas as rotas do Fastify devem ter schema de validação Zod no input e output
- Tratamento de erro consistente: erros operacionais retornam JSON { error: string, code?: string }; erros inesperados são capturados e retornam 500
- Sem console.log no código — usar um logger simples (pino no Fastify)

SEGURANÇA
- Nunca retornar dados de outros usuários — todas as queries devem filtrar por userId autenticado
- Nunca confiar no plano enviado pelo frontend — sempre buscar User.plan do banco no backend
- Sanitizar slugs gerados a partir de input do usuário (remover caracteres especiais)
- CORS configurado no Fastify: apenas o domínio do frontend em produção

BANCO DE DADOS
- Toda query deve estar dentro de um try/catch
- Queries pesadas (listas longas) devem ter paginação — cursor-based pagination para listas de respostas
- Nunca fazer N+1 queries — usar include/select do Prisma para buscar relações em uma query

COMMITS
- Um commit por feature/sub-task com mensagem descritiva em português
- Exemplo: "feat: implementar QuestionTypePicker com preview por tipo"

TESTES
- Ao menos um teste unitário Vitest para cada regra de negócio crítica implementada nesta etapa
- Lógica condicional, overage e webhook Stripe são obrigatórios ter testes
```
