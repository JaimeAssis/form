'use client'

import { Loader2, Check, WifiOff } from 'lucide-react'

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface AutoSaveIndicatorProps {
  status: SaveStatus
}

export function AutoSaveIndicator({ status }: AutoSaveIndicatorProps) {
  if (status === 'idle') return null
  if (status === 'saving') {
    return (
      <span className="flex items-center gap-1 text-xs text-gray-400">
        <Loader2 className="w-3 h-3 animate-spin" /> Salvando…
      </span>
    )
  }
  if (status === 'saved') {
    return (
      <span className="flex items-center gap-1 text-xs text-green-600">
        <Check className="w-3 h-3" /> Salvo
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1 text-xs text-red-500">
      <WifiOff className="w-3 h-3" /> Erro ao salvar — tentando novamente
    </span>
  )
}
