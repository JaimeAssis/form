import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { FormPublicClient } from '@/components/form-public/FormPublicClient'
import { PausedScreen } from '@/components/form-public/PausedScreen'
import { PublicFormData } from '@/components/form-public/types'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

async function getForm(slug: string): Promise<PublicFormData | null | 'paused'> {
  try {
    const res = await fetch(`${API_URL}/p/${slug}`, { cache: 'no-store' })

    if (res.status === 404) {
      try {
        const data = await res.json()
        if (data.paused) return 'paused'
      } catch {}
      return null
    }

    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string }
}): Promise<Metadata> {
  const form = await getForm(params.slug)
  if (!form || form === 'paused') return { title: 'Formulário' }
  return {
    title: form.title,
    description: form.description || `Preencha o formulário ${form.title}`,
  }
}

export default async function FormPublicPage({
  params,
}: {
  params: { slug: string }
}) {
  const form = await getForm(params.slug)

  if (form === 'paused') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <PausedScreen />
      </div>
    )
  }

  if (!form) {
    notFound()
    return null
  }

  return <FormPublicClient form={form} />
}
