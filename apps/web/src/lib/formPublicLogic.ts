import { Question } from '@consorte/types'

/**
 * Avalia se a condição de exibição de uma pergunta é atendida.
 * Sem condição → sempre visível.
 * Para MULTIPLE_SELECT o valor armazenado é JSON array: verifica inclusão.
 */
export function isConditionMet(
  question: Question,
  answers: Record<string, string>
): boolean {
  if (!question.condition) return true

  const { triggerQuestionId, triggerValue } = question.condition
  const raw = answers[triggerQuestionId]
  if (raw === undefined) return false

  try {
    const parsed: unknown = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed.includes(triggerValue)
  } catch {
    // não é JSON — comparação direta
  }

  return raw === triggerValue
}

/** Retorna apenas as perguntas visíveis dado o estado atual das respostas. */
export function getVisibleQuestions(
  questions: Question[],
  answers: Record<string, string>
): Question[] {
  return questions.filter(q => isConditionMet(q, answers))
}
