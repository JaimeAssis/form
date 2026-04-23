import { describe, it, expect } from 'vitest'
import { toSlug, detectCircularCondition } from './formService'

describe('toSlug', () => {
  it('converte título simples para kebab-case com sufixo', () => {
    const result = toSlug('Briefing de Design')
    expect(result).toMatch(/^briefing-de-design-[a-z0-9]{4}$/)
  })

  it('remove acentos e caracteres especiais', () => {
    const result = toSlug('Formulário Ação!')
    expect(result).toMatch(/^formulario-acao-[a-z0-9]{4}$/)
  })

  it('colapsa espaços múltiplos', () => {
    const result = toSlug('Meu   Formulário')
    expect(result).toMatch(/^meu-formulario-[a-z0-9]{4}$/)
  })
})

describe('detectCircularCondition', () => {
  it('retorna false quando não há referência circular', () => {
    const questions = [
      { id: 'q1', condition: null },
      { id: 'q2', condition: { triggerQuestionId: 'q1' } },
    ]
    expect(detectCircularCondition('q2', 'q1', questions as any)).toBe(false)
  })

  it('retorna true quando há referência circular', () => {
    const questions = [
      { id: 'q1', condition: null },
      { id: 'q2', condition: { triggerQuestionId: 'q3' } },
      { id: 'q3', condition: null },
    ]
    expect(detectCircularCondition('q3', 'q2', questions as any)).toBe(true)
  })
})
