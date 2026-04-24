'use client'

import { Question } from '@consorte/types'
import { cn } from '@/lib/utils'

interface AnswerInputProps {
  question: Question
  value: string
  onChange: (value: string) => void
  brandColor?: string | null
}

export function AnswerInput({ question, value, onChange, brandColor }: AnswerInputProps) {
  switch (question.type) {
    case 'SHORT_TEXT':
      return (
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="Sua resposta..."
          className="w-full border rounded-lg px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary bg-background"
          autoFocus
        />
      )

    case 'LONG_TEXT':
      return (
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="Sua resposta..."
          rows={4}
          className="w-full border rounded-lg px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary bg-background resize-none"
          autoFocus
        />
      )

    case 'MULTIPLE_CHOICE': {
      return (
        <div className="space-y-2">
          {question.options.map(option => {
            const selected = value === option
            return (
              <button
                key={option}
                type="button"
                onClick={() => onChange(option)}
                className={cn(
                  'w-full text-left px-4 py-3 rounded-lg border text-base transition-colors',
                  selected
                    ? 'border-primary bg-primary/10 font-medium'
                    : 'border-border hover:border-primary/50 hover:bg-muted/50'
                )}
                style={selected && brandColor
                  ? { borderColor: brandColor, backgroundColor: `${brandColor}18` }
                  : {}
                }
              >
                {option}
              </button>
            )
          })}
        </div>
      )
    }

    case 'MULTIPLE_SELECT': {
      const selectedValues: string[] = (() => {
        try { return JSON.parse(value || '[]') as string[] }
        catch { return [] }
      })()

      const toggle = (option: string) => {
        const next = selectedValues.includes(option)
          ? selectedValues.filter(v => v !== option)
          : [...selectedValues, option]
        onChange(JSON.stringify(next))
      }

      return (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground mb-3">Selecione todas que se aplicam</p>
          {question.options.map(option => {
            const selected = selectedValues.includes(option)
            return (
              <button
                key={option}
                type="button"
                onClick={() => toggle(option)}
                className={cn(
                  'w-full text-left px-4 py-3 rounded-lg border text-base transition-colors flex items-center gap-3',
                  selected
                    ? 'border-primary bg-primary/10 font-medium'
                    : 'border-border hover:border-primary/50 hover:bg-muted/50'
                )}
                style={selected && brandColor
                  ? { borderColor: brandColor, backgroundColor: `${brandColor}18` }
                  : {}
                }
              >
                <span
                  className={cn(
                    'w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center',
                    selected ? 'border-primary bg-primary' : 'border-muted-foreground'
                  )}
                  style={selected && brandColor ? { borderColor: brandColor, backgroundColor: brandColor } : {}}
                >
                  {selected && (
                    <svg viewBox="0 0 10 10" className="w-2.5 h-2.5 fill-white">
                      <path d="M1.5 5l2.5 2.5L8.5 2" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                {option}
              </button>
            )
          })}
        </div>
      )
    }

    case 'SCALE': {
      const numValue = value ? parseInt(value, 10) : null
      return (
        <div>
          <div className="flex gap-2 justify-between">
            {[1, 2, 3, 4, 5].map(n => {
              const selected = numValue === n
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => onChange(String(n))}
                  className={cn(
                    'flex-1 aspect-square rounded-lg border text-base font-medium transition-colors min-h-[48px]',
                    selected
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border hover:border-primary/50 hover:bg-muted/50'
                  )}
                  style={selected && brandColor
                    ? { borderColor: brandColor, backgroundColor: brandColor }
                    : {}
                  }
                >
                  {n}
                </button>
              )
            })}
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-2 px-1">
            <span>{question.scaleMin || '1'}</span>
            <span>{question.scaleMax || '5'}</span>
          </div>
        </div>
      )
    }

    default:
      return null
  }
}
