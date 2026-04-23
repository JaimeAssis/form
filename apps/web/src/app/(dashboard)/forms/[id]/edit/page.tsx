'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, DragEndEvent
} from '@dnd-kit/core'
import {
  SortableContext, sortableKeyboardCoordinates,
  verticalListSortingStrategy, arrayMove
} from '@dnd-kit/sortable'
import { Form, Question, QuestionType } from '@consorte/types'
import {
  getForm, updateForm, updateFormStatus,
  createQuestion, updateQuestion, deleteQuestion, reorderQuestions
} from '@/lib/api'
import { QuestionCard } from '@/components/builder/QuestionCard'
import { QuestionEditor } from '@/components/builder/QuestionEditor'
import { AddQuestionButton } from '@/components/builder/QuestionTypePicker'
import { AutoSaveIndicator, SaveStatus } from '@/components/builder/AutoSaveIndicator'
import { PublishModal } from '@/components/builder/PublishModal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'
import { ArrowLeft, Eye, Globe, PauseCircle } from 'lucide-react'

const DEBOUNCE_MS = 800
const RETRY_DELAYS = [3000, 6000, 12000]

type UpdateFormData = Parameters<typeof updateForm>[1]
type UpdateQuestionData = Parameters<typeof updateQuestion>[2]

export default function BuilderPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { toast } = useToast()

  const [form, setForm] = useState<Form | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [publishModalOpen, setPublishModalOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  const pendingFormSave = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingQuestionSave = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  useEffect(() => {
    getForm(id).then(f => { setForm(f); setLoading(false) }).catch(() => router.push('/dashboard/forms'))
  }, [id])

  const selectedQuestion = form?.questions.find(q => q.id === selectedId) ?? null

  const scheduleFormSave = useCallback((data: UpdateFormData) => {
    if (pendingFormSave.current) clearTimeout(pendingFormSave.current)
    setSaveStatus('saving')
    pendingFormSave.current = setTimeout(async () => {
      const attempt = async (retry: number): Promise<void> => {
        try {
          await updateForm(id, data)
          setSaveStatus('saved')
          setTimeout(() => setSaveStatus('idle'), 2000)
        } catch {
          if (retry < RETRY_DELAYS.length) {
            setTimeout(() => attempt(retry + 1), RETRY_DELAYS[retry])
          } else {
            setSaveStatus('error')
          }
        }
      }
      await attempt(0)
    }, DEBOUNCE_MS)
  }, [id])

  const scheduleQuestionSave = useCallback((
    questionId: string,
    data: UpdateQuestionData
  ) => {
    const existing = pendingQuestionSave.current.get(questionId)
    if (existing) clearTimeout(existing)
    setSaveStatus('saving')
    const timeout = setTimeout(async () => {
      const attempt = async (retry: number): Promise<void> => {
        try {
          const updated = await updateQuestion(id, questionId, data)
          setForm(prev => prev ? {
            ...prev,
            questions: prev.questions.map((q: Question) => q.id === questionId ? updated : q)
          } : prev)
          setSaveStatus('saved')
          setTimeout(() => setSaveStatus('idle'), 2000)
        } catch (err: unknown) {
          if (retry < RETRY_DELAYS.length) {
            setTimeout(() => attempt(retry + 1), RETRY_DELAYS[retry])
          } else {
            setSaveStatus('error')
            const message = err instanceof Error ? err.message : 'Erro ao salvar pergunta'
            toast({ title: message, variant: 'destructive' })
          }
        }
      }
      await attempt(0)
    }, DEBOUNCE_MS)
    pendingQuestionSave.current.set(questionId, timeout)
  }, [id, toast])

  function handleQuestionChange(questionId: string, data: UpdateQuestionData) {
    setForm(prev => {
      if (!prev) return prev
      return {
        ...prev,
        questions: prev.questions.map((q: Question) => {
          if (q.id !== questionId) return q
          const { condition, ...rest } = data
          const updated = { ...q, ...rest }
          if (condition !== undefined) {
            updated.condition = condition ? {
              id: q.condition?.id ?? '',
              questionId,
              triggerQuestionId: condition.triggerQuestionId,
              triggerValue: condition.triggerValue,
            } : null
          }
          return updated
        })
      }
    })
    scheduleQuestionSave(questionId, data)
  }

  async function handleAddQuestion(type: QuestionType) {
    if (!form) return
    try {
      const created = await createQuestion(form.id, type)
      setForm(prev => prev ? { ...prev, questions: [...prev.questions, created] } : prev)
      setSelectedId(created.id)
    } catch {
      toast({ title: 'Erro ao adicionar pergunta', variant: 'destructive' })
    }
  }

  async function handleDeleteQuestion(questionId: string) {
    if (!confirm('Deseja excluir esta pergunta?')) return
    try {
      await deleteQuestion(id, questionId)
      setForm(prev => prev ? { ...prev, questions: prev.questions.filter((q: Question) => q.id !== questionId) } : prev)
      if (selectedId === questionId) setSelectedId(null)
      toast({ title: 'Pergunta excluída' })
    } catch {
      toast({ title: 'Erro ao excluir pergunta', variant: 'destructive' })
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    if (!form) return
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = form.questions.findIndex((q: Question) => q.id === active.id)
    const newIndex = form.questions.findIndex((q: Question) => q.id === over.id)
    const reordered = arrayMove(form.questions, oldIndex, newIndex).map((q: Question, i: number) => ({ ...q, order: i + 1 }))
    setForm(prev => prev ? { ...prev, questions: reordered } : prev)
    try {
      await reorderQuestions(id, reordered.map((q: Question) => q.id))
    } catch {
      toast({ title: 'Erro ao reordenar perguntas', variant: 'destructive' })
    }
  }

  async function handlePublish() {
    if (!form) return
    try {
      const updated = await updateFormStatus(id, 'PUBLISHED')
      setForm(prev => prev ? { ...prev, status: updated.status, slug: updated.slug } : prev)
      setPublishModalOpen(true)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao publicar'
      toast({ title: message, variant: 'destructive' })
    }
  }

  async function handlePause() {
    if (!form) return
    try {
      const updated = await updateFormStatus(id, 'PAUSED')
      setForm(prev => prev ? { ...prev, status: updated.status } : prev)
      toast({ title: 'Formulário pausado' })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao pausar'
      toast({ title: message, variant: 'destructive' })
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full text-gray-400 text-sm">Carregando editor…</div>
  )
  if (!form) return null

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* Topbar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-white">
        <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard/forms')}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
        </Button>

        <Input
          value={form.title}
          onChange={e => {
            setForm(prev => prev ? { ...prev, title: e.target.value } : prev)
            scheduleFormSave({ title: e.target.value })
          }}
          className="max-w-sm text-sm font-medium border-none shadow-none focus-visible:ring-0 px-0"
          placeholder="Título do formulário"
        />

        <div className="ml-auto flex items-center gap-2">
          <AutoSaveIndicator status={saveStatus} />
          <Button variant="outline" size="sm" onClick={() => window.open(`/api/forms/${id}/preview`, '_blank')}>
            <Eye className="w-4 h-4 mr-1" /> Pré-visualizar
          </Button>
          {form.status === 'PUBLISHED' ? (
            <Button variant="outline" size="sm" onClick={handlePause} className="text-orange-600 border-orange-300 hover:bg-orange-50">
              <PauseCircle className="w-4 h-4 mr-1" /> Pausar
            </Button>
          ) : (
            <Button size="sm" onClick={handlePublish} className="bg-blue-600 hover:bg-blue-700">
              <Globe className="w-4 h-4 mr-1" /> Publicar
            </Button>
          )}
        </div>
      </div>

      {/* Dois painéis */}
      <div className="flex flex-1 overflow-hidden">
        {/* Painel esquerdo */}
        <div className="w-72 border-r flex flex-col bg-gray-50">
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={form.questions.map((q: Question) => q.id)} strategy={verticalListSortingStrategy}>
                {form.questions.map((q: Question, i: number) => (
                  <QuestionCard
                    key={q.id}
                    question={q}
                    index={i}
                    isSelected={selectedId === q.id}
                    onClick={() => setSelectedId(q.id)}
                    onDelete={() => handleDeleteQuestion(q.id)}
                  />
                ))}
              </SortableContext>
            </DndContext>
            {form.questions.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-8">Nenhuma pergunta ainda.</p>
            )}
          </div>
          <div className="p-3 border-t bg-white">
            <AddQuestionButton onAdd={handleAddQuestion} />
          </div>
        </div>

        {/* Painel direito */}
        <div className="flex-1 overflow-y-auto p-6">
          {selectedQuestion ? (
            <>
              <h2 className="text-sm font-semibold text-gray-700 mb-4">
                Editando pergunta {form.questions.findIndex((q: Question) => q.id === selectedQuestion.id) + 1}
              </h2>
              <QuestionEditor
                question={selectedQuestion}
                allQuestions={form.questions}
                onChange={data => handleQuestionChange(selectedQuestion.id, data)}
              />
            </>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-gray-400">Selecione uma pergunta para editar</p>
            </div>
          )}
        </div>
      </div>

      <PublishModal
        open={publishModalOpen}
        onClose={() => setPublishModalOpen(false)}
        slug={form.slug}
      />
    </div>
  )
}
