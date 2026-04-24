import { PauseCircle } from 'lucide-react'

export function PausedScreen() {
  return (
    <div className="flex flex-col items-center text-center max-w-md mx-auto px-4 py-16">
      <PauseCircle className="w-14 h-14 text-muted-foreground mb-6" strokeWidth={1.5} />
      <h2 className="text-2xl font-bold mb-3">Formulário indisponível</h2>
      <p className="text-muted-foreground">
        Este formulário não está disponível no momento.
      </p>
    </div>
  )
}
