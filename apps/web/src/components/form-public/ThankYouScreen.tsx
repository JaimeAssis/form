import { CheckCircle2 } from 'lucide-react'

interface ThankYouScreenProps {
  thankYouTitle: string | null
  thankYouMessage: string | null
}

export function ThankYouScreen({ thankYouTitle, thankYouMessage }: ThankYouScreenProps) {
  return (
    <div className="flex flex-col items-center text-center max-w-md mx-auto px-4 py-16">
      <CheckCircle2 className="w-14 h-14 text-green-500 mb-6" strokeWidth={1.5} />
      <h2 className="text-2xl font-bold mb-3">
        {thankYouTitle || 'Obrigado!'}
      </h2>
      <p className="text-muted-foreground leading-relaxed">
        {thankYouMessage || 'Suas respostas foram enviadas com sucesso.'}
      </p>
    </div>
  )
}
