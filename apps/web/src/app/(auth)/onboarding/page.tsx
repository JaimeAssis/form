'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const NICHES = [
  { value: 'influencer', label: 'Influenciador / Creator' },
  { value: 'lawyer', label: 'Advogado / Jurídico' },
  { value: 'events', label: 'Produtor de eventos' },
  { value: 'marketing', label: 'Agência de marketing / Tráfego pago' },
  { value: 'architect', label: 'Arquiteto / Decorador' },
  { value: 'nutritionist', label: 'Nutricionista' },
  { value: 'personal_trainer', label: 'Personal trainer' },
  { value: 'video_editor', label: 'Editor de vídeo' },
  { value: 'designer', label: 'Designer gráfico / Social media' },
  { value: 'photographer', label: 'Fotógrafo' },
  { value: 'other', label: 'Outro' },
]

export default function OnboardingPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [niche, setNiche] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!niche) { setError('Selecione seu nicho de atuação'); return }
    setLoading(true)
    setError('')
    try {
      await apiFetch('/users/onboarding', {
        method: 'POST',
        body: JSON.stringify({ name, niche }),
      })
      router.push('/dashboard')
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar perfil')
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Bem-vindo ao Consorte Form</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Conte-nos um pouco sobre você para personalizar sua experiência
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <label className="text-sm font-medium">Como quer ser chamado?</label>
          <Input
            placeholder="Seu nome de exibição"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Qual é o seu nicho de atuação?</label>
          <Select value={niche} onValueChange={setNiche}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione seu nicho" />
            </SelectTrigger>
            <SelectContent>
              {NICHES.map((n) => (
                <SelectItem key={n.value} value={n.value}>
                  {n.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {error && <p className="text-destructive text-sm">{error}</p>}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Salvando...' : 'Continuar'}
        </Button>
      </form>
    </div>
  )
}
