'use client'

import { useState, useCallback } from 'react'
import { PublicFormData } from './types'
import { getVisibleQuestions } from '@/lib/formPublicLogic'
import { WelcomeScreen } from './WelcomeScreen'
import { QuestionStep } from './QuestionStep'
import { ThankYouScreen } from './ThankYouScreen'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

type Stage = 'welcome' | 'questions' | 'success'

interface FormPublicClientProps {
  form: PublicFormData
}

export function FormPublicClient({ form }: FormPublicClientProps) {
  const [stage, setStage] = useState<Stage>('welcome')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [currentError, setCurrentError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const visibleQuestions = getVisibleQuestions(form.questions, answers)
  const currentQuestion = visibleQuestions[currentIndex]
  const isFirst = currentIndex === 0
  const isLast = currentIndex === visibleQuestions.length - 1

  const getCurrentValue = useCallback(
    (questionId: string) => answers[questionId] ?? '',
    [answers]
  )

  const handleChange = useCallback((questionId: string, value: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }))
    setCurrentError(null)
  }, [])

  const validateCurrent = (): boolean => {
    if (!currentQuestion) return true
    if (!currentQuestion.required) return true

    const value = answers[currentQuestion.id] ?? ''
    const isEmpty = value.trim() === '' || value === '[]'
    if (isEmpty) {
      setCurrentError('Esta pergunta é obrigatória.')
      return false
    }
    return true
  }

  const handleNext = useCallback(async () => {
    if (!validateCurrent()) return
    setCurrentError(null)

    if (isLast) {
      setIsSubmitting(true)
      setSubmitError(null)

      const visibleNow = getVisibleQuestions(form.questions, answers)
      const payload = {
        answers: visibleNow
          .filter(q => answers[q.id] !== undefined && answers[q.id] !== '')
          .map(q => ({ questionId: q.id, value: answers[q.id] })),
      }

      try {
        const res = await fetch(`${API_URL}/p/${form.slug}/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error((data as any).error || 'Erro ao enviar respostas')
        }

        setStage('success')
      } catch (err: unknown) {
        setSubmitError(err instanceof Error ? err.message : 'Algo deu errado. Tente novamente.')
      } finally {
        setIsSubmitting(false)
      }
      return
    }

    setCurrentIndex(prev => Math.min(prev + 1, visibleQuestions.length - 1))
  }, [currentQuestion, isLast, answers, visibleQuestions, form.slug, form.questions])

  const handleBack = useCallback(() => {
    setCurrentError(null)
    setCurrentIndex(prev => Math.max(0, prev - 1))
  }, [])

  if (stage === 'welcome') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <WelcomeScreen
          title={form.title}
          welcomeTitle={form.welcomeTitle}
          welcomeMessage={form.welcomeMessage}
          logoUrl={form.logoUrl}
          userAvatarUrl={form.user.avatarUrl}
          userName={form.user.name}
          brandColor={form.brandColor}
          onStart={() => {
            setStage('questions')
            setCurrentIndex(0)
          }}
        />
      </div>
    )
  }

  if (stage === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <ThankYouScreen
          thankYouTitle={form.thankYouTitle}
          thankYouMessage={form.thankYouMessage}
        />
      </div>
    )
  }

  if (!currentQuestion) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Nenhuma pergunta disponível.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {submitError && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2 rounded-lg shadow z-50">
          {submitError}
        </div>
      )}
      <div
        key={currentQuestion.id}
        className="animate-in fade-in slide-in-from-right-4 duration-200"
      >
        <QuestionStep
          question={currentQuestion}
          questionIndex={currentIndex}
          totalVisible={visibleQuestions.length}
          value={getCurrentValue(currentQuestion.id)}
          error={currentError}
          onChange={value => handleChange(currentQuestion.id, value)}
          onNext={handleNext}
          onBack={handleBack}
          isFirst={isFirst}
          isLast={isLast}
          isSubmitting={isSubmitting}
          brandColor={form.brandColor}
        />
      </div>
    </div>
  )
}
