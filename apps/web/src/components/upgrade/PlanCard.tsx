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
          disabled={loading || !priceId}
        >
          {loading ? 'Aguarde...' : `Assinar ${name}`}
        </Button>
      )}
    </div>
  )
}
