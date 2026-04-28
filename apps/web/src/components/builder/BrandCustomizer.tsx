'use client'

import Image from 'next/image'

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
        <a href="/upgrade" className="text-sm text-blue-600 hover:underline mt-1 inline-block">
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
          <Image
            src={logoUrl}
            alt="Logo preview"
            width={80}
            height={40}
            className="mt-2 h-10 object-contain"
          />
        )}
      </div>
    </div>
  )
}
