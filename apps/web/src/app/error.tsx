'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Sentry já captura via integração automática do @sentry/nextjs
    console.error(error)
  }, [error])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-4">
      <p className="text-6xl font-bold text-gray-200 mb-4">500</p>
      <h1 className="text-xl font-semibold text-gray-800 mb-2">Algo deu errado</h1>
      <p className="text-gray-500 mb-6">Ocorreu um erro inesperado. Já fomos notificados.</p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          Tentar novamente
        </button>
        <Link
          href="/dashboard"
          className="border border-gray-200 px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          Voltar ao dashboard
        </Link>
      </div>
    </div>
  )
}
