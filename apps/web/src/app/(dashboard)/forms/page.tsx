'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Form, FormStatus } from '@consorte/types'
import { getForms, createForm, deleteForm, updateFormStatus } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { Plus, Edit2, Copy, Trash2, Globe, PauseCircle } from 'lucide-react'

const STATUS_CONFIG: Record<FormStatus, { label: string; className: string }> = {
  [FormStatus.DRAFT]: { label: 'Rascunho', className: 'bg-gray-100 text-gray-600' },
  [FormStatus.PUBLISHED]: { label: 'Publicado', className: 'bg-green-100 text-green-700' },
  [FormStatus.PAUSED]: { label: 'Pausado', className: 'bg-yellow-100 text-yellow-700' },
}

type FormWithCount = Form & { _count?: { responses: number } }

export default function FormsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [forms, setForms] = useState<FormWithCount[]>([])
  const [loading, setLoading] = useState(true)

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  useEffect(() => {
    getForms()
      .then(f => { setForms(f as FormWithCount[]); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  async function handleCreate() {
    try {
      const form = await createForm({ title: 'Sem título' })
      router.push(`/dashboard/forms/${form.id}/edit`)
    } catch {
      toast({ title: 'Erro ao criar formulário', variant: 'destructive' })
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Deseja excluir este formulário e todas as respostas?')) return
    try {
      await deleteForm(id)
      setForms(prev => prev.filter(f => f.id !== id))
      toast({ title: 'Formulário excluído' })
    } catch {
      toast({ title: 'Erro ao excluir formulário', variant: 'destructive' })
    }
  }

  async function handleToggleStatus(form: FormWithCount) {
    const newStatus = form.status === FormStatus.PUBLISHED ? FormStatus.PAUSED : FormStatus.PUBLISHED
    try {
      const updated = await updateFormStatus(form.id, newStatus)
      setForms(prev => prev.map(f => f.id === form.id ? { ...f, status: updated.status } : f))
      toast({ title: newStatus === FormStatus.PUBLISHED ? 'Formulário publicado' : 'Formulário pausado' })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao atualizar status'
      toast({ title: message, variant: 'destructive' })
    }
  }

  function handleCopyLink(slug: string) {
    navigator.clipboard.writeText(`${appUrl}/f/${slug}`)
    toast({ title: 'Link copiado!' })
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-20 bg-gray-100 rounded-lg" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Meus formulários</h1>
        <Button onClick={handleCreate}>
          <Plus className="w-4 h-4 mr-2" /> Novo formulário
        </Button>
      </div>

      {forms.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed rounded-xl">
          <p className="text-gray-500 mb-4">Você ainda não tem formulários.</p>
          <Button onClick={handleCreate}>
            <Plus className="w-4 h-4 mr-2" /> Criar primeiro formulário
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {forms.map(form => {
            const statusConfig = STATUS_CONFIG[form.status]
            return (
              <div key={form.id} className="flex items-center gap-4 p-4 bg-white border rounded-xl hover:border-gray-300 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="font-medium text-sm truncate">{form.title || 'Sem título'}</h2>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusConfig.className}`}>
                      {statusConfig.label}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">
                    {form._count?.responses ?? 0} respostas
                  </p>
                </div>

                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => router.push(`/dashboard/forms/${form.id}/edit`)}>
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  {form.status === FormStatus.PUBLISHED && (
                    <Button variant="ghost" size="sm" onClick={() => handleCopyLink(form.slug)}>
                      <Copy className="w-4 h-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggleStatus(form)}
                    className={form.status === FormStatus.PUBLISHED ? 'text-orange-500' : 'text-green-600'}
                  >
                    {form.status === FormStatus.PUBLISHED ? <PauseCircle className="w-4 h-4" /> : <Globe className="w-4 h-4" />}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(form.id)} className="text-red-400 hover:text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
