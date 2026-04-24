import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-center px-4">
      <h1 className="text-3xl font-bold mb-2">Formulário não encontrado</h1>
      <p className="text-muted-foreground mb-6">
        O formulário que você está procurando não existe ou foi removido.
      </p>
      <Link href="/" className="text-sm text-primary hover:underline">
        Ir para o início
      </Link>
    </div>
  )
}
