import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-4">
      <p className="text-6xl font-bold text-gray-200 mb-4">404</p>
      <h1 className="text-xl font-semibold text-gray-800 mb-2">Página não encontrada</h1>
      <p className="text-gray-500 mb-6">O endereço que você acessou não existe ou foi removido.</p>
      <Link
        href="/dashboard"
        className="bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
      >
        Voltar ao dashboard
      </Link>
    </div>
  )
}
