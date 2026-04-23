'use client'

import { useState, useEffect } from 'react'
import { Question, QuestionType } from '@consorte/types'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { ConditionEditor } from './ConditionEditor'
import { Plus, X } from 'lucide-react'

const TYPE_LABEL: Record<QuestionType, string> = {
  [QuestionType.SHORT_TEXT]: 'Texto curto',
  [QuestionType.LONG_TEXT]: 'Texto longo',
  [QuestionType.MULTIPLE_CHOICE]: 'Múltipla escolha',
  [QuestionType.MULTIPLE_SELECT]: 'Múltipla seleção',
  [QuestionType.SCALE]: 'Escala',
}

interface QuestionEditorProps {
  question: Question
  allQuestions: Question[]
  onChange: (updated: Omit<Partial<Question>, 'condition'> & { condition?: { triggerQuestionId: string; triggerValue: string } | null }) => void
}

export function QuestionEditor({ question, allQuestions, onChange }: QuestionEditorProps) {
  const [localTitle, setLocalTitle] = useState(question.title)
  const [localDesc, setLocalDesc] = useState(question.description ?? '')

  useEffect(() => {
    setLocalTitle(question.title)
    setLocalDesc(question.description ?? '')
  }, [question.id])

  return (
    <div className="space-y-5">
      <div>
        <Label className="text-xs text-gray-500 uppercase tracking-wide">Tipo</Label>
        <p className="text-sm font-medium mt-1">{TYPE_LABEL[question.type]}</p>
        <p className="text-xs text-gray-400">O tipo não pode ser alterado após a criação.</p>
      </div>

      {/* Título */}
      <div>
        <Label htmlFor="q-title" className="text-xs text-gray-500 uppercase tracking-wide">
          Título {localTitle.length > 224 && <span className="text-orange-500">({localTitle.length}/280)</span>}
        </Label>
        <Input
          id="q-title"
          value={localTitle}
          maxLength={280}
          onChange={e => setLocalTitle(e.target.value)}
          onBlur={() => onChange({ title: localTitle })}
          placeholder="Digite a pergunta..."
          className="mt-1"
        />
      </div>

      {/* Descrição */}
      <div>
        <Label htmlFor="q-desc" className="text-xs text-gray-500 uppercase tracking-wide">Descrição (opcional)</Label>
        <Textarea
          id="q-desc"
          value={localDesc}
          onChange={e => setLocalDesc(e.target.value)}
          onBlur={() => onChange({ description: localDesc || null })}
          placeholder="Contexto ou instrução adicional..."
          rows={2}
          className="mt-1 resize-none"
        />
      </div>

      {/* Toggle obrigatória */}
      <div className="flex items-center gap-3">
        <Switch
          id="q-required"
          checked={question.required}
          onCheckedChange={val => onChange({ required: val })}
        />
        <Label htmlFor="q-required" className="text-sm cursor-pointer">
          Pergunta obrigatória {question.required && <span className="text-red-500">*</span>}
        </Label>
      </div>

      {/* Opções (choice/select) */}
      {(question.type === QuestionType.MULTIPLE_CHOICE || question.type === QuestionType.MULTIPLE_SELECT) && (
        <div>
          <Label className="text-xs text-gray-500 uppercase tracking-wide">Opções ({question.options.length}/10)</Label>
          <div className="space-y-2 mt-2">
            {question.options.map((opt, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  value={opt}
                  onChange={e => {
                    const updated = [...question.options]
                    updated[i] = e.target.value
                    onChange({ options: updated })
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && question.options.length < 10) {
                      e.preventDefault()
                      const updated = [...question.options]
                      updated.splice(i + 1, 0, '')
                      onChange({ options: updated })
                    }
                  }}
                  placeholder={`Opção ${i + 1}`}
                  className="flex-1 text-sm"
                />
                {question.options.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onChange({ options: question.options.filter((_, j) => j !== i) })}
                    className="text-gray-400 hover:text-red-500"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
            {question.options.length < 10 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onChange({ options: [...question.options, ''] })}
                className="w-full border-dashed text-xs"
              >
                <Plus className="w-3 h-3 mr-1" /> Adicionar opção
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Labels de escala */}
      {question.type === QuestionType.SCALE && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-gray-500">Label mínimo (1)</Label>
            <Input
              value={question.scaleMin ?? ''}
              onChange={e => onChange({ scaleMin: e.target.value })}
              placeholder="Ex: Discordo"
              className="mt-1 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs text-gray-500">Label máximo (5)</Label>
            <Input
              value={question.scaleMax ?? ''}
              onChange={e => onChange({ scaleMax: e.target.value })}
              placeholder="Ex: Concordo"
              className="mt-1 text-sm"
            />
          </div>
        </div>
      )}

      {/* Lógica condicional */}
      <div className="border-t pt-4">
        <Label className="text-xs text-gray-500 uppercase tracking-wide mb-3 block">Lógica condicional</Label>
        <ConditionEditor
          currentQuestionId={question.id}
          questions={allQuestions}
          condition={question.condition ? { triggerQuestionId: question.condition.triggerQuestionId, triggerValue: question.condition.triggerValue } : null}
          onChange={cond => onChange({ condition: cond })}
        />
      </div>
    </div>
  )
}
