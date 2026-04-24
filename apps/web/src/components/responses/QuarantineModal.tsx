'use client'

import { useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js'
import { apiFetch, createOverageIntent, createOveragePack } from '@/lib/api'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

// Load Stripe once at module level to avoid recreating on each render
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

// ─── Poll GET /forms/:id/responses/:rid until UNLOCKED ────────────────────────
async function pollForUnlock(
  formId: string,
  responseId: string,
  maxAttempts = 15,
): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise<void>((resolve) => setTimeout(resolve, 2000))
    try {
      await apiFetch(`/forms/${formId}/responses/${responseId}`)
      return true // 200 = UNLOCKED
    } catch (err: unknown) {
      // 402 = still quarantined, keep polling
      if (err instanceof Error && (err as { status?: number }).status === 402) continue
      throw err // unexpected error
    }
  }
  return false // timed out after 30s
}

// ─── Stripe payment form (must be inside <Elements>) ─────────────────────────
interface PaymentFormProps {
  formId: string
  responseId: string
  onUnlocked: () => void
  onError: (msg: string) => void
}

function PaymentForm({ formId, responseId, onUnlocked, onError }: PaymentFormProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [paying, setPaying] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return

    setPaying(true)
    try {
      const result = await stripe.confirmPayment({
        elements,
        redirect: 'if_required',
        confirmParams: { return_url: window.location.href },
      })

      if (result.error) {
        onError(result.error.message ?? 'Erro no pagamento')
        return
      }

      const unlocked = await pollForUnlock(formId, responseId)
      if (unlocked) {
        onUnlocked()
      } else {
        onError('Pagamento confirmado! A resposta será desbloqueada em instantes. Tente recarregar.')
      }
    } catch {
      onError('Erro inesperado no pagamento. Tente novamente.')
    } finally {
      setPaying(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 mt-4">
      <PaymentElement />
      <Button
        type="submit"
        disabled={paying || !stripe}
        className="w-full bg-blue-600 hover:bg-blue-700"
      >
        {paying ? 'Processando…' : 'Confirmar pagamento'}
      </Button>
    </form>
  )
}

// ─── Main modal ───────────────────────────────────────────────────────────────
interface QuarantineModalProps {
  open: boolean
  formId: string
  responseId: string
  respondentName: string | null
  createdAt: string
  accumulatedCostCents: number
  onUnlocked: () => void
  onClose: () => void
}

export function QuarantineModal({
  open,
  formId,
  responseId,
  respondentName,
  createdAt,
  accumulatedCostCents,
  onUnlocked,
  onClose,
}: QuarantineModalProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [loadingIntent, setLoadingIntent] = useState(false)

  const accumulatedBRL = (accumulatedCostCents / 100).toFixed(2).replace('.', ',')
  const showProHint = accumulatedCostCents >= 4000 // R$ 40

  function resetState() {
    setClientSecret(null)
    setPaymentError(null)
    setLoadingIntent(false)
  }

  function handleClose() {
    resetState()
    onClose()
  }

  function handleUnlocked() {
    resetState()
    onUnlocked()
    onClose()
  }

  async function handlePaySingle() {
    setLoadingIntent(true)
    setPaymentError(null)
    try {
      const { clientSecret: cs } = await createOverageIntent(responseId)
      setClientSecret(cs)
    } catch {
      setPaymentError('Erro ao iniciar pagamento. Tente novamente.')
    } finally {
      setLoadingIntent(false)
    }
  }

  async function handlePayPack() {
    setLoadingIntent(true)
    setPaymentError(null)
    try {
      const { clientSecret: cs } = await createOveragePack()
      setClientSecret(cs)
    } catch {
      setPaymentError('Erro ao iniciar pagamento. Tente novamente.')
    } finally {
      setLoadingIntent(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Resposta bloqueada</DialogTitle>
        </DialogHeader>

        {/* Name + datetime — always visible */}
        <div className="text-sm mb-3">
          <p className="font-medium text-gray-800">{respondentName ?? 'Anônimo'}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {new Date(createdAt).toLocaleString('pt-BR', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>

        {/* Blurred content preview */}
        <div className="bg-gray-50 rounded-lg p-4 mb-4 select-none" aria-hidden="true">
          {[1, 2, 3].map((i) => (
            <div key={i} className="blur-sm text-gray-400 text-sm mb-2">
              ●●●●● ●●●●●●●● ●●●●●●●
            </div>
          ))}
        </div>

        <p className="text-sm font-medium text-amber-700 mb-1">
          Você atingiu o limite de 10 respostas gratuitas este mês.
        </p>
        <p className="text-xs text-gray-500 mb-1">
          Custo acumulado este mês: R$ {accumulatedBRL}
        </p>
        <p className="text-xs text-gray-400 mb-4">
          A partir de 22 respostas/mês, o plano Pro (R$ 57) é mais econômico.
        </p>

        {paymentError && (
          <p className="text-sm text-red-500 mb-3" role="alert">
            {paymentError}
          </p>
        )}

        {!clientSecret ? (
          <div className="space-y-2">
            <Button
              onClick={handlePaySingle}
              disabled={loadingIntent}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              {loadingIntent ? 'Aguarde…' : 'Pagar R$ 3,00 para ver esta resposta'}
            </Button>
            <Button
              variant="outline"
              onClick={handlePayPack}
              disabled={loadingIntent}
              className="w-full"
            >
              Ou adquira 20 respostas por R$ 20,00
            </Button>
            {showProHint && (
              <Button variant="ghost" className="w-full text-xs text-gray-500" asChild>
                <a href="/dashboard/upgrade">Ver plano Pro →</a>
              </Button>
            )}
          </div>
        ) : (
          <Elements stripe={stripePromise} options={{ clientSecret }}>
            <PaymentForm
              formId={formId}
              responseId={responseId}
              onUnlocked={handleUnlocked}
              onError={setPaymentError}
            />
          </Elements>
        )}
      </DialogContent>
    </Dialog>
  )
}
