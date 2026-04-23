import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface PublicUser {
  name: string
  slug: string
  niche: string | null
  avatarUrl: string | null
  forms: { id: string; title: string; slug: string; description: string | null }[]
}

async function getProfile(slug: string): Promise<PublicUser | null> {
  const res = await fetch(`${API_URL}/users/${slug}/public`, { next: { revalidate: 60 } })
  if (!res.ok) return null
  return res.json()
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const user = await getProfile(params.slug)
  if (!user) return { title: 'Perfil não encontrado' }
  return { title: `${user.name} — Consorte Form`, description: `Formulários de ${user.name}` }
}

export default async function PublicProfilePage({ params }: { params: { slug: string } }) {
  const user = await getProfile(params.slug)
  if (!user) notFound()

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-16">
        <div className="text-center mb-10">
          {user.avatarUrl && (
            <img
              src={user.avatarUrl}
              alt={user.name}
              className="w-20 h-20 rounded-full mx-auto mb-4 object-cover"
            />
          )}
          {!user.avatarUrl && (
            <div className="w-20 h-20 rounded-full mx-auto mb-4 bg-muted flex items-center justify-center text-2xl font-bold text-muted-foreground">
              {user.name.charAt(0).toUpperCase()}
            </div>
          )}
          <h1 className="text-2xl font-bold">{user.name}</h1>
          {user.niche && <p className="text-muted-foreground text-sm mt-1">{user.niche}</p>}
        </div>

        {user.forms.length === 0 ? (
          <p className="text-center text-muted-foreground">Nenhum formulário publicado.</p>
        ) : (
          <div className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Formulários
            </h2>
            {user.forms.map((form) => (
              <Link
                key={form.id}
                href={`/f/${form.slug}`}
                className="block p-4 rounded-lg border hover:border-primary hover:bg-muted/50 transition-colors"
              >
                <p className="font-medium">{form.title}</p>
                {form.description && (
                  <p className="text-muted-foreground text-sm mt-0.5">{form.description}</p>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
