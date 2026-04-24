'use client'

import { ResponseSummary } from '@/lib/api'
import { Unlock, Lock } from 'lucide-react'

interface ResponsesTableProps {
  responses: ResponseSummary[]
  onSelectUnlocked: (id: string) => void
  onSelectQuarantined: (id: string) => void
}

export function ResponsesTable({
  responses,
  onSelectUnlocked,
  onSelectQuarantined,
}: ResponsesTableProps) {
  if (responses.length === 0) {
    return (
      <div className="text-center py-16 border-2 border-dashed rounded-xl">
        <p className="text-sm text-gray-500 mb-1">Nenhuma resposta recebida ainda.</p>
        <p className="text-xs text-gray-400">Compartilhe o link do formulário para começar a receber respostas.</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">#</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Nome</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Data</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {responses.map((r, i) => (
            <tr
              key={r.id}
              onClick={() =>
                r.status === 'UNLOCKED'
                  ? onSelectUnlocked(r.id)
                  : onSelectQuarantined(r.id)
              }
              className="cursor-pointer hover:bg-gray-50 transition-colors"
            >
              <td className="px-4 py-3 text-gray-400">{responses.length - i}</td>
              <td className="px-4 py-3 font-medium text-gray-800">
                {r.respondentName ?? 'Anônimo'}
              </td>
              <td className="px-4 py-3 text-gray-500">
                {new Date(r.createdAt).toLocaleString('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </td>
              <td className="px-4 py-3">
                {r.status === 'UNLOCKED' ? (
                  <span className="inline-flex items-center gap-1 text-green-700 bg-green-50 px-2 py-0.5 rounded-full text-xs font-medium">
                    <Unlock className="w-3 h-3" /> Desbloqueada
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-orange-700 bg-orange-50 px-2 py-0.5 rounded-full text-xs font-medium">
                    <Lock className="w-3 h-3" /> Quarentena
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
