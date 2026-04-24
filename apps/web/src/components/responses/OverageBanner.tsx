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
  const showUpgradeHint = accumulatedCostCents >= 4000 // R$ 40

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
