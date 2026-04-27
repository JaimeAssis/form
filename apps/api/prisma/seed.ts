import { PrismaClient } from '@prisma/client'

// Use DIRECT_URL for seed to avoid pgbouncer prepared statement conflicts
const datasourceUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL
const prisma = new PrismaClient({ datasourceUrl })

type TemplateQuestion = {
  order: number
  type: string
  title: string
  description?: string
  required: boolean
  options: string[]
  scaleMin?: string
  scaleMax?: string
  conditionOnPrevIndex?: number
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

    const questionsJson = tpl.questions.map((q) => ({
      order: q.order,
      type: q.type,
      title: q.title,
      description: q.description ?? null,
      required: q.required,
      options: q.options,
      scaleMin: q.scaleMin ?? null,
      scaleMax: q.scaleMax ?? null,
      condition:
        q.conditionOnPrevIndex !== undefined && q.conditionValue !== undefined
          ? { triggerQuestionIndex: q.conditionOnPrevIndex, triggerValue: q.conditionValue }
          : null,
    }))

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
