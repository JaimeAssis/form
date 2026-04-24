import { createClient } from './supabase/client'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

async function getToken(): Promise<string | null> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ?? null
}

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = await getToken()
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw Object.assign(new Error(err.error || 'API error'), { status: res.status, data: err })
  }
  return res.json()
}

// ─── Forms ────────────────────────────────────────────────────────────────────
import type { Form, Question, QuestionType } from '@consorte/types'

export async function getForms(): Promise<Form[]> {
  return apiFetch<Form[]>('/forms')
}

export async function getForm(id: string): Promise<Form> {
  return apiFetch<Form>(`/forms/${id}`)
}

export async function createForm(data: { title?: string }): Promise<Form> {
  return apiFetch<Form>('/forms', { method: 'POST', body: JSON.stringify(data) })
}

export async function updateForm(
  id: string,
  data: Partial<Pick<Form, 'title' | 'description' | 'welcomeTitle' | 'welcomeMessage' | 'thankYouTitle' | 'thankYouMessage'>>,
): Promise<Form> {
  return apiFetch<Form>(`/forms/${id}`, { method: 'PUT', body: JSON.stringify(data) })
}

export async function deleteForm(id: string): Promise<void> {
  return apiFetch<void>(`/forms/${id}`, { method: 'DELETE' })
}

export async function updateFormStatus(
  id: string,
  status: 'PUBLISHED' | 'PAUSED' | 'DRAFT',
): Promise<Form> {
  return apiFetch<Form>(`/forms/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) })
}

// ─── Questions ────────────────────────────────────────────────────────────────

export async function createQuestion(formId: string, type: QuestionType): Promise<Question> {
  return apiFetch<Question>(`/forms/${formId}/questions`, { method: 'POST', body: JSON.stringify({ type }) })
}

export async function updateQuestion(
  formId: string,
  questionId: string,
  data: Partial<Pick<Question, 'title' | 'description' | 'required' | 'options' | 'scaleMin' | 'scaleMax'>> & {
    condition?: { triggerQuestionId: string; triggerValue: string } | null
  },
): Promise<Question> {
  return apiFetch<Question>(`/forms/${formId}/questions/${questionId}`, { method: 'PUT', body: JSON.stringify(data) })
}

export async function deleteQuestion(formId: string, questionId: string): Promise<void> {
  return apiFetch<void>(`/forms/${formId}/questions/${questionId}`, { method: 'DELETE' })
}

export async function reorderQuestions(formId: string, order: string[]): Promise<void> {
  return apiFetch<void>(`/forms/${formId}/questions/reorder`, { method: 'PATCH', body: JSON.stringify({ order }) })
}

// ─── Responses ────────────────────────────────────────────────────────────────

export interface ResponseSummary {
  id: string
  respondentName: string | null
  createdAt: string
  status: 'UNLOCKED' | 'QUARANTINED'
}

export interface ResponsesMeta {
  plan: string
  monthlyFreeUsed: number
  quarantinedCount: number
  accumulatedCostCents: number
}

export interface ResponsesListResult {
  responses: ResponseSummary[]
  meta: ResponsesMeta
}

export interface AnswerWithInfo {
  questionId: string
  questionTitle: string
  questionType: string
  value: string
}

export interface ResponseQuestion {
  id: string
  title: string
  type: string
  order: number
}

export interface ResponseDetail {
  id: string
  respondentName: string | null
  respondentEmail: string | null
  createdAt: string
  status: 'UNLOCKED'
  questions: ResponseQuestion[]
  answers: AnswerWithInfo[]
}

export async function getFormResponses(formId: string): Promise<ResponsesListResult> {
  return apiFetch<ResponsesListResult>(`/forms/${formId}/responses`)
}

export async function getResponseById(
  formId: string,
  responseId: string,
): Promise<ResponseDetail> {
  return apiFetch<ResponseDetail>(`/forms/${formId}/responses/${responseId}`)
}

// ─── Payments ─────────────────────────────────────────────────────────────────

export async function createOverageIntent(
  responseId: string,
): Promise<{ clientSecret: string }> {
  return apiFetch<{ clientSecret: string }>('/payments/overage/intent', {
    method: 'POST',
    body: JSON.stringify({ responseId }),
  })
}

export async function createOveragePack(): Promise<{ clientSecret: string }> {
  return apiFetch<{ clientSecret: string }>('/payments/overage/pack', {
    method: 'POST',
  })
}
