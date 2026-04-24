'use client'

import { Question } from '@consorte/types'
import { Button } from '@/components/ui/button'
import { AnswerInput } from './AnswerInput'
import { ProgressBar } from './ProgressBar'
import { ChevronLeft } from 'lucide-react'

interface QuestionStepProps {
  question: Question
  questionIndex: number
  totalVisible: number
  value: string
  error: string | null
  onChange: (value: string) => void
  onNext: () => void
  onBack: () => void
  isFirst: boolean
  isLast: boolean
  isSubmitting: boolean
  brandColor: string | null
}

export function QuestionStep({
  question,
  questionIndex,
  totalVisible,
  value,
  error,
  onChange,
  onNext,
  onBack,
  isFirst,
  isLast,
  isSubmitting,
  brandColor,
}: QuestionStepProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && question.type !== 'LONG_TEXT') {
      e.preventDefault()
      onNext()
    }
  }

  return (
    <div
      className="flex flex-col min-h-screen px-4 py-6 max-w-xl mx-auto w-full"
      onKeyDown={handleKeyDown}
    >
      <div className="mb-8">
        <ProgressBar
          current={questionIndex}
          total={totalVisible}
          brandColor={brandColor}
        />
      </div>

      <div className="flex-1">
        <div className="mb-6">
          <h2 className="text-xl font-semibold leading-snug">
            {question.title || 'Pergunta'}
            {question.required && (
              <span className="text-red-500 ml-1" aria-label="obrigatória">*</span>
            )}
          </h2>
          {question.description && (
            <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
              {question.description}
            </p>
          )}
        </div>

        <AnswerInput
          question={question}
          value={value}
          onChange={onChange}
          brandColor={brandColor}
        />

        {error && (
          <p className="mt-3 text-sm text-red-500" role="alert">
            {error}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-4 mt-8 pt-4">
        {!isFirst ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="flex items-center gap-1"
            disabled={isSubmitting}
          >
            <ChevronLeft className="w-4 h-4" />
            Voltar
          </Button>
        ) : (
          <div />
        )}

        <Button
          size="lg"
          onClick={onNext}
          disabled={isSubmitting}
          className="min-w-[140px]"
          style={brandColor ? { backgroundColor: brandColor, borderColor: brandColor } : {}}
        >
          {isSubmitting
            ? 'Enviando...'
            : isLast
            ? 'Enviar'
            : 'Próximo →'}
        </Button>
      </div>
    </div>
  )
}
