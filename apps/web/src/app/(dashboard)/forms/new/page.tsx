'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getTemplates, createFormFromTemplate, createForm, TemplateSummary } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { ArrowLeft, Plus } from 'lucide-react'
import { trackEvent } from '@/lib/posthog'

const NICHE_ICONS: Record<string, string> = {
  influencer: '🎬',
  lawyer: '⚖️',
  events: '🎉',
  'marketing-agency': '📣',
  architect: '🏠',
  nutritionist: '🥗',
  'personal-trainer': '💪',
  'video-editor': '🎞️',
  designer: '🎨',
  photographer: '📷',
}

export default function NewFormPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [templates, setTemplates] = useState<TemplateSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    getTemplates()
      .then(setTemplates)
      .catch(() => toast({ title: 'Erro ao carregar templates', variant: 'destructive' }))
      .finally(() => setLoading(false))
  }, [])

  async function handleTemplate(templateId: string) {
    const tpl = templates.find((t) => t.id === templateId)
    trackEvent('template_selected', { templateSlug: tpl?.niche ?? templateId })
    setCreating(true)
    try {
      const form = await createFormFromTemplate(templateId)
      trackEvent('form_created', { from: 'template', templateSlug: tpl?.niche ?? null })
      router.push(`/dashboard/forms/${form.id}/edit`)
    } catch {
      toast({ title: 'Erro ao criar formulário', variant: 'destructive' })
      setCreating(false)
    }
  }

  async function handleScratch() {
    setCreating(true)
    try {
      const form = await createForm({ title: 'Sem título' })
      trackEvent('form_created', { from: 'scratch', templateSlug: null })
      router.push(`/dashboard/forms/${form.id}/edit`)
    } catch {
      toast({ title: 'Erro ao criar formulário', variant: 'destructive' })
      setCreating(false)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <button
        onClick={() => router.push('/dashboard/forms')}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-6"
      >
        <ArrowLeft className="w-4 h-4" /> Voltar
      </button>

      <h1 className="text-xl font-semibold mb-1">Como quer começar?</h1>
      <p className="text-sm text-gray-500 mb-6">
        Escolha um template pré-configurado pelo seu nicho ou crie do zero.
      </p>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-28 rounded-xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {/* Card criar do zero */}
          <button
            onClick={handleScratch}
            disabled={creating}
            className="flex flex-col items-center justify-center gap-2 p-5 border-2 border-dashed border-gray-300 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-colors text-center disabled:opacity-50"
          >
            <Plus className="w-6 h-6 text-gray-400" />
            <span className="font-medium text-sm">Criar do zero</span>
            <span className="text-xs text-gray-400">Formulário em branco</span>
          </button>

          {/* Cards de template */}
          {templates.map((tpl) => (
            <button
              key={tpl.id}
              onClick={() => handleTemplate(tpl.id)}
              disabled={creating}
              className="flex flex-col items-start gap-1 p-5 border border-gray-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-colors text-left disabled:opacity-50"
            >
              <span className="text-2xl">{NICHE_ICONS[tpl.niche] ?? '📋'}</span>
              <span className="font-medium text-sm leading-tight">{tpl.title}</span>
              <span className="text-xs text-gray-500 leading-snug line-clamp-2">{tpl.description}</span>
            </button>
          ))}
        </div>
      )}

      {creating && (
        <p className="text-center text-sm text-gray-500 mt-6 animate-pulse">
          Criando formulário...
        </p>
      )}
    </div>
  )
}
