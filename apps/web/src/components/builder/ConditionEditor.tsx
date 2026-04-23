'use client'

import { Question, QuestionType } from '@consorte/types'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'

const ELIGIBLE = [QuestionType.MULTIPLE_CHOICE, QuestionType.MULTIPLE_SELECT, QuestionType.SCALE]

interface ConditionEditorProps {
  currentQuestionId: string
  questions: Question[]
  condition: { triggerQuestionId: string; triggerValue: string } | null
  onChange: (condition: { triggerQuestionId: string; triggerValue: string } | null) => void
}

export function ConditionEditor({ currentQuestionId, questions, condition, onChange }: ConditionEditorProps) {
  const currentIndex = questions.findIndex(q => q.id === currentQuestionId)
  const eligible = questions.slice(0, currentIndex).filter(q => ELIGIBLE.includes(q.type))

  if (eligible.length === 0) {
    return (
      <p className="text-xs text-gray-400">Não há perguntas elegíveis antes desta para criar uma condição.</p>
    )
  }

  const triggerQuestion = eligible.find(q => q.id === condition?.triggerQuestionId)

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs font-medium text-gray-600 mb-1 block">Mostrar esta pergunta se:</Label>
        <Select
          value={condition?.triggerQuestionId ?? 'none'}
          onValueChange={(val) => {
            if (val === 'none') { onChange(null); return }
            const q = eligible.find(q => q.id === val)
            const firstOption = q?.type === QuestionType.SCALE ? '1' : (q?.options?.[0] ?? '')
            onChange({ triggerQuestionId: val, triggerValue: firstOption })
          }}
        >
          <SelectTrigger className="text-sm">
            <SelectValue placeholder="Selecione uma pergunta" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">— Sempre mostrar —</SelectItem>
            {eligible.map(q => (
              <SelectItem key={q.id} value={q.id}>
                {q.title || 'Sem título'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {condition && triggerQuestion && (
        <div>
          <Label className="text-xs font-medium text-gray-600 mb-1 block">Valor igual a:</Label>
          <Select
            value={condition.triggerValue}
            onValueChange={(val) => onChange({ ...condition, triggerValue: val })}
          >
            <SelectTrigger className="text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {triggerQuestion.type === QuestionType.SCALE
                ? ['1', '2', '3', '4', '5'].map(v => (
                    <SelectItem key={v} value={v}>{v}</SelectItem>
                  ))
                : triggerQuestion.options.map(opt => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))
              }
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  )
}
