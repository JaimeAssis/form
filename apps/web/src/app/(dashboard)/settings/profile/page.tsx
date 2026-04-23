'use client'

import { useEffect, useState } from 'react'
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

interface UserProfile {
  id: string
  name: string | null
  email: string
  slug: string | null
  niche: string | null
  avatarUrl: string | null
  plan: string
}

export default function ProfilePage() {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [name, setName] = useState('')
  const [niche, setNiche] = useState('')
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    apiFetch<UserProfile>('/auth/me').then((u) => {
      setUser(u)
      setName(u.name || '')
      setNiche(u.niche || '')
    })
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess(false)
    try {
      const updated = await apiFetch<UserProfile>('/users/profile', {
        method: 'PUT',
        body: JSON.stringify({ name, niche }),
      })
      setUser(updated)
      setSuccess(true)
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar')
    } finally {
      setLoading(false)
    }
  }

  function copyLink() {
    const url = `${process.env.NEXT_PUBLIC_APP_URL}/p/${user?.slug}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!user) return <div className="text-muted-foreground">Carregando...</div>

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-bold">Perfil</h1>

      {user.slug && (
        <div className="bg-muted rounded-lg p-4 flex items-center justify-between gap-4">
          <div className="text-sm">
            <p className="text-muted-foreground">Seu link público</p>
            <p className="font-mono text-xs mt-0.5 truncate">
              {process.env.NEXT_PUBLIC_APP_URL}/p/{user.slug}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={copyLink}>
            {copied ? 'Copiado!' : 'Copiar'}
          </Button>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-4">
        <div className="space-y-1">
          <label className="text-sm font-medium">Nome de exibição</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">E-mail</label>
          <Input value={user.email} disabled className="opacity-60" />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Nicho de atuação</label>
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
        {success && <p className="text-green-600 text-sm">Perfil atualizado com sucesso!</p>}

        <Button type="submit" disabled={loading}>
          {loading ? 'Salvando...' : 'Salvar alterações'}
        </Button>
      </form>
    </div>
  )
}
