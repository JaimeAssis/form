'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getFormResponses, ResponseSummary, ResponsesMeta } from '@/lib/api'
import { OverageBanner } from '@/components/responses/OverageBanner'
import { ResponsesTable } from '@/components/responses/ResponsesTable'
import { ResponseDetail } from '@/components/responses/ResponseDetail'
import { QuarantineModal } from '@/components/responses/QuarantineModal'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface QuarantinedTarget {
  id: string
  respondentName: string | null
  createdAt: string
}

export default function ResponsesPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { toast } = useToast()

  const [responses, setResponses] = useState<ResponseSummary[]>([])
  const [meta, setMeta] = useState<ResponsesMeta | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedUnlockedId, setSelectedUnlockedId] = useState<string | null>(null)
  const [quarantinedTarget, setQuarantinedTarget] = useState<QuarantinedTarget | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    getFormResponses(id)
      .then(({ responses: r, meta: m }) => {
        setResponses(r)
        setMeta(m)
      })
      .catch(() => router.push(`/forms/${id}/edit`))
      .finally(() => setLoading(false))
  }, [id, router])

  useEffect(() => {
    load()
  }, [load])

  async function handleExportPdf() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    if (!token) return

    try {
      const res = await fetch(`${apiUrl}/forms/${id}/responses/export/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        toast({ title: 'Erro ao exportar PDF', variant: 'destructive' })
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `respostas.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast({ title: 'Erro ao exportar PDF', variant: 'destructive' })
    }
  }

  function handleSelectQuarantined(responseId: string) {
    const r = responses.find((r) => r.id === responseId)
    if (!r) return
    setQuarantinedTarget({
      id: r.id,
      respondentName: r.respondentName,
      createdAt: r.createdAt,
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        Carregando respostas…
      </div>
    )
  }

  if (selectedUnlockedId) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <ResponseDetail
          formId={id}
          responseId={selectedUnlockedId}
          onBack={() => setSelectedUnlockedId(null)}
        />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center gap-3 mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/forms/${id}/edit`)}
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> Voltar ao editor
        </Button>
        <h1 className="text-lg font-semibold text-gray-800">Respostas</h1>
        <div className="ml-auto flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPdf}
            disabled={!meta || (meta.plan !== 'PRO' && meta.plan !== 'AGENCY')}
            title={
              meta && meta.plan !== 'PRO' && meta.plan !== 'AGENCY'
                ? 'Disponível no plano Pro'
                : undefined
            }
          >
            Exportar PDF
          </Button>
        </div>
      </div>

      {meta && (
        <OverageBanner
          plan={meta.plan}
          monthlyFreeUsed={meta.monthlyFreeUsed}
          quarantinedCount={meta.quarantinedCount}
          accumulatedCostCents={meta.accumulatedCostCents}
        />
      )}

      <ResponsesTable
        responses={responses}
        onSelectUnlocked={setSelectedUnlockedId}
        onSelectQuarantined={handleSelectQuarantined}
      />

      {quarantinedTarget && meta && (
        <QuarantineModal
          open={!!quarantinedTarget}
          formId={id}
          responseId={quarantinedTarget.id}
          respondentName={quarantinedTarget.respondentName}
          createdAt={quarantinedTarget.createdAt}
          accumulatedCostCents={meta.accumulatedCostCents}
          onUnlocked={load}
          onClose={() => setQuarantinedTarget(null)}
        />
      )}
    </div>
  )
}
