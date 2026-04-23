'use client'

import { useState, useEffect, useCallback } from 'react'
import { QuestionType, Question } from '@consorte/types'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlignLeft, AlignJustify, ListChecks, CheckSquare, BarChart2, Plus } from 'lucide-react'

const TYPE_CONFIG: Record<QuestionType, { label: string; description: string; icon: React.ReactNode; preview: React.ReactNode }> = {
  [QuestionType.SHORT_TEXT]: {
    label: 'Texto curto',
    description: 'Resposta em uma linha',
    icon: <AlignLeft className="w-5 h-5" />,
    preview: <input disabled placeholder="Digite sua resposta..." className="w-full border rounded px-3 py-2 text-sm bg-gray-50 cursor-not-allowed" />,
  },
  [QuestionType.LONG_TEXT]: {
    label: 'Texto longo',
    description: 'Resposta em múltiplas linhas',
    icon: <AlignJustify className="w-5 h-5" />,
    preview: <textarea disabled placeholder="Digite sua resposta..." rows={3} className="w-full border rounded px-3 py-2 text-sm bg-gray-50 cursor-not-allowed resize-none" />,
  },
  [QuestionType.MULTIPLE_CHOICE]: {
    label: 'Múltipla escolha',
    description: 'O respondente escolhe uma opção',
    icon: <ListChecks className="w-5 h-5" />,
    preview: (
      <div className="space-y-2">
        {['Opção 1', 'Opção 2', 'Opção 3'].map(o => (
          <div key={o} className="flex items-center gap-2 border rounded px-3 py-2 text-sm bg-gray-50">
            <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
            <span className="text-gray-500">{o}</span>
          </div>
        ))}
      </div>
    ),
  },
  [QuestionType.MULTIPLE_SELECT]: {
    label: 'Múltipla seleção',
    description: 'O respondente escolhe várias opções',
    icon: <CheckSquare className="w-5 h-5" />,
    preview: (
      <div className="space-y-2">
        {['Opção 1', 'Opção 2', 'Opção 3'].map(o => (
          <div key={o} className="flex items-center gap-2 border rounded px-3 py-2 text-sm bg-gray-50">
            <div className="w-4 h-4 rounded border-2 border-gray-300" />
            <span className="text-gray-500">{o}</span>
          </div>
        ))}
      </div>
    ),
  },
  [QuestionType.SCALE]: {
    label: 'Escala',
    description: 'Avaliação de 1 a 5',
    icon: <BarChart2 className="w-5 h-5" />,
    preview: (
      <div>
        <div className="flex gap-2 justify-between mb-1">
          {[1, 2, 3, 4, 5].map(n => (
            <div key={n} className="flex-1 border rounded py-2 text-center text-sm font-medium bg-gray-50 text-gray-500">{n}</div>
          ))}
        </div>
        <div className="flex justify-between text-xs text-gray-400">
          <span>Discordo</span>
          <span>Concordo</span>
        </div>
      </div>
    ),
  },
}

export function buildQuestion(type: QuestionType): Omit<Question, 'id' | 'formId' | 'createdAt' | 'updatedAt'> {
  const base = {
    order: 0,
    type,
    title: '',
    description: null,
    required: false,
    options: [] as string[],
    scaleMin: null,
    scaleMax: null,
    condition: null,
  }
  if (type === QuestionType.MULTIPLE_CHOICE || type === QuestionType.MULTIPLE_SELECT) {
    return { ...base, options: ['Opção 1', 'Opção 2'] }
  }
  if (type === QuestionType.SCALE) {
    return { ...base, scaleMin: 'Discordo', scaleMax: 'Concordo' }
  }
  return base
}

interface QuestionTypePickerProps {
  open: boolean
  onConfirm: (type: QuestionType) => void
  onCancel: () => void
}

export function QuestionTypePicker({ open, onConfirm, onCancel }: QuestionTypePickerProps) {
  const [selected, setSelected] = useState<QuestionType | null>(null)
  const [error, setError] = useState(false)
  const [shake, setShake] = useState(false)

  useEffect(() => {
    if (open) {
      setSelected(null)
      setError(false)
      setShake(false)
    }
  }, [open])

  const handleConfirm = useCallback(() => {
    if (!selected) {
      setError(true)
      setShake(true)
      setTimeout(() => setShake(false), 500)
      return
    }
    onConfirm(selected)
  }, [selected, onConfirm])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!open) return
      if (e.key === 'Escape') onCancel()
      if (e.key === 'Enter') handleConfirm()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onCancel, handleConfirm])

  const types = Object.values(QuestionType)

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel() }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Escolha o tipo de pergunta</DialogTitle>
        </DialogHeader>

        <div className={`grid grid-cols-2 gap-3 ${shake ? 'animate-shake' : ''}`}>
          {types.map((type) => {
            const config = TYPE_CONFIG[type]
            const isSelected = selected === type
            return (
              <div key={type} className="flex flex-col gap-2">
                <button
                  onClick={() => { setSelected(type); setError(false) }}
                  className={`flex items-center gap-3 p-3 rounded-lg border-2 text-left transition-colors ${isSelected ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}
                >
                  <span className={isSelected ? 'text-blue-600' : 'text-gray-500'}>{config.icon}</span>
                  <div>
                    <p className="font-medium text-sm">{config.label}</p>
                    <p className="text-xs text-gray-500">{config.description}</p>
                  </div>
                </button>
                {isSelected && (
                  <div className="border rounded-lg p-3 bg-white">
                    <p className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wide">Preview</p>
                    {config.preview}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {error && (
          <p className="text-sm text-red-600 text-center">Selecione um tipo de pergunta para continuar</p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button onClick={handleConfirm}>Confirmar tipo</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

interface AddQuestionButtonProps {
  onAdd: (type: QuestionType) => void
  disabled?: boolean
}

export function AddQuestionButton({ onAdd, disabled }: AddQuestionButtonProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="w-full border-dashed"
      >
        <Plus className="w-4 h-4 mr-2" />
        Adicionar pergunta
      </Button>
      <QuestionTypePicker
        open={open}
        onConfirm={(type) => { setOpen(false); onAdd(type) }}
        onCancel={() => setOpen(false)}
      />
    </>
  )
}
