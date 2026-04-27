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
import { trackEvent } from '@/lib/posthog'

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
    plan: 'FREE' as const,
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
    priceIdMonthly: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY ?? '',
    priceIdAnnual: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_ANNUAL ?? '',
    plan: 'PRO' as const,
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
    priceIdMonthly: process.env.NEXT_PUBLIC_STRIPE_PRICE_AGENCY_MONTHLY ?? '',
    priceIdAnnual: process.env.NEXT_PUBLIC_STRIPE_PRICE_AGENCY_ANNUAL ?? '',
    plan: 'AGENCY' as const,
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
      const matched = PLANS.find((p) => p.priceIdMonthly === priceId || p.priceIdAnnual === priceId)
      trackEvent('upgrade_started', {
        toPlan: matched?.plan ?? 'unknown',
        billing: isAnnual ? 'annual' : 'monthly',
      })
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
