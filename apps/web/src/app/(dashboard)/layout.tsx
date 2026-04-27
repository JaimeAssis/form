import Link from 'next/link'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { LogoutButton } from '@/components/dashboard/logout-button'
import { UserIdentifier } from '@/components/UserIdentifier'

async function getUser() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    redirect('/login')
  }

  const cookieStore = cookies()
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) { return cookieStore.get(name)?.value },
      set() {},
      remove() {},
    },
  })

  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) redirect('/login')
    return session.user
  } catch {
    redirect('/login')
  }
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser()

  return (
    <div className="min-h-screen bg-background">
      <UserIdentifier userId={user.id} plan={(user.user_metadata?.plan as string) ?? 'free'} nicho={user.user_metadata?.nicho as string | undefined} />
      <header className="border-b">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/dashboard" className="font-semibold text-primary">
            Consorte Form
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/forms" className="text-muted-foreground hover:text-foreground transition-colors">
              Formulários
            </Link>
            <Link href="/settings/profile" className="text-muted-foreground hover:text-foreground transition-colors">
              Perfil
            </Link>
            <LogoutButton />
          </nav>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
    </div>
  )
}
