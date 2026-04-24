'use client'

import { useState, useEffect } from 'react'
import { getResponseById, ResponseDetail as ResponseDetailType } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

interface ResponseDetailProps {
  formId: string
  responseId: string
  onBack: () => void
}

function formatAnswer(value: string, type: string): string {
  if (type === 'MULTIPLE_SELECT') {
    try {
      const arr: unknown = JSON.parse(value)
      if (Array.isArray(arr)) return (arr as string[]).join(', ')
    } catch { /* not JSON */ }
  }
  return value
}

export function ResponseDetail({ formId, responseId, onBack }: ResponseDetailProps) {
  const [data, setData] = useState<ResponseDetailType | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    getResponseById(formId, responseId)
      .then(setData)
      .catch(() => setError('Erro ao carregar resposta. Tente novamente.'))
      .finally(() => setLoading(false))
  }, [formId, responseId])

  if (loading) {
    return <div className="text-sm text-gray-400 py-8 text-center">Carregando…</div>
  }
  if (error) {
    return <div className="text-sm text-red-500 py-8 text-center">{error}</div>
  }
  if (!data) return null

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Voltar para lista
        </Button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="mb-5 pb-4 border-b border-gray-100">
          <p className="font-semibold text-gray-800">{data.respondentName ?? 'Anônimo'}</p>
          {data.respondentEmail && (
            <p className="text-xs text-gray-500 mt-0.5">{data.respondentEmail}</p>
          )}
          <p className="text-xs text-gray-400 mt-0.5">
            {new Date(data.createdAt).toLocaleString('pt-BR', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>

        <div className="space-y-5">
          {data.questions.map((q) => {
            const answer = data.answers.find((a) => a.questionId === q.id)
            return (
              <div key={q.id}>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                  {q.order}. {q.title}
                </p>
                {answer ? (
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">
                    {formatAnswer(answer.value, answer.questionType)}
                  </p>
                ) : (
                  <p className="text-sm text-gray-400 italic">não respondida</p>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
