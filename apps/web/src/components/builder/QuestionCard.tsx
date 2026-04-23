'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Question, QuestionType } from '@consorte/types'
import { Badge } from '@/components/ui/badge'
import { GripVertical, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

const TYPE_LABEL: Record<QuestionType, string> = {
  [QuestionType.SHORT_TEXT]: 'Texto curto',
  [QuestionType.LONG_TEXT]: 'Texto longo',
  [QuestionType.MULTIPLE_CHOICE]: 'Múltipla escolha',
  [QuestionType.MULTIPLE_SELECT]: 'Múltipla seleção',
  [QuestionType.SCALE]: 'Escala',
}

interface QuestionCardProps {
  question: Question
  index: number
  isSelected: boolean
  onClick: () => void
  onDelete: () => void
}

export function QuestionCard({ question, index, isSelected, onClick, onDelete }: QuestionCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: question.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onClick}
      className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer group transition-colors ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}
    >
      <button
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing shrink-0"
      >
        <GripVertical className="w-4 h-4" />
      </button>

      <span className="text-xs text-gray-400 w-5 shrink-0">{index + 1}</span>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {question.title || <span className="text-gray-400 italic">Sem título</span>}
        </p>
        <Badge variant="secondary" className="text-xs mt-0.5">
          {TYPE_LABEL[question.type]}
        </Badge>
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={(e) => { e.stopPropagation(); onDelete() }}
        className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 hover:bg-red-50 shrink-0"
      >
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  )
}
