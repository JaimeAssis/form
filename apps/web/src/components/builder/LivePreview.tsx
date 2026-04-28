'use client'

import { Question, QuestionType } from '@consorte/types'

interface LivePreviewProps {
  question: Question | null
  isPro: boolean
}

function AnswerPreview({ question }: { question: Question }) {
  switch (question.type) {
    case QuestionType.SHORT_TEXT:
      return (
        <div className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-400 bg-gray-50">
          Resposta curta...
        </div>
      )
    case QuestionType.LONG_TEXT:
      return (
        <div className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-400 bg-gray-50 h-20">
          Resposta longa...
        </div>
      )
    case QuestionType.MULTIPLE_CHOICE:
      return (
        <div className="space-y-2">
          {(question.options?.length ? question.options : ['Opção A', 'Opção B']).map((opt) => (
            <div key={opt} className="flex items-center gap-3 p-3 border rounded-lg text-sm text-gray-600">
              <div className="w-4 h-4 rounded-full border-2 border-gray-300 flex-shrink-0" />
              {opt}
            </div>
          ))}
        </div>
      )
    case QuestionType.MULTIPLE_SELECT:
      return (
        <div className="space-y-2">
          {(question.options?.length ? question.options : ['Opção A', 'Opção B']).map((opt) => (
            <div key={opt} className="flex items-center gap-3 p-3 border rounded-lg text-sm text-gray-600">
              <div className="w-4 h-4 rounded border-2 border-gray-300 flex-shrink-0" />
              {opt}
            </div>
          ))}
        </div>
      )
    case QuestionType.SCALE:
      return (
        <div className="space-y-2">
          <div className="flex gap-2 justify-center">
            {[1, 2, 3, 4, 5].map((n) => (
              <div key={n} className="w-11 h-11 rounded-lg border-2 border-gray-200 flex items-center justify-center text-gray-600 font-medium text-sm">
                {n}
              </div>
            ))}
          </div>
          {(question.scaleMin || question.scaleMax) && (
            <div className="flex justify-between text-xs text-gray-400 px-1">
              <span>{question.scaleMin ?? ''}</span>
              <span>{question.scaleMax ?? ''}</span>
            </div>
          )}
        </div>
      )
    default:
      return null
  }
}

export function LivePreview({ question, isPro }: LivePreviewProps) {
  if (!isPro) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center border-l bg-gray-50">
        <p className="text-sm font-medium text-gray-700 mb-1">Pré-visualização ao vivo</p>
        <p className="text-xs text-gray-400 mb-3">Disponível no plano Pro</p>
        <a href="/upgrade" className="text-xs text-blue-600 hover:underline">
          Fazer upgrade →
        </a>
      </div>
    )
  }

  if (!question) {
    return (
      <div className="flex items-center justify-center h-full p-6 text-center border-l bg-gray-50">
        <p className="text-sm text-gray-400">Selecione uma pergunta para ver a pré-visualização</p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto border-l bg-gray-50">
      <div className="p-4 border-b bg-white">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Pré-visualização</p>
      </div>
      <div className="p-4">
        <div className="bg-white rounded-xl border p-5 space-y-4">
          <div className="h-1 bg-gray-100 rounded-full">
            <div className="h-1 bg-blue-500 rounded-full w-1/3" />
          </div>

          <div>
            <p className="text-xs text-gray-400 mb-1">Pergunta</p>
            <h2 className="text-base font-semibold text-gray-900">
              {question.title || <span className="text-gray-300 italic">Sem título</span>}
              {question.required && <span className="text-red-500 ml-1">*</span>}
            </h2>
            {question.description && (
              <p className="text-sm text-gray-500 mt-1">{question.description}</p>
            )}
          </div>

          <AnswerPreview question={question} />

          <div className="flex justify-between pt-1">
            <span className="text-sm text-gray-300">← Voltar</span>
            <button className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg">
              Próximo →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
