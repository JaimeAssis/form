import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Inter } from 'next/font/google'
import './globals.css'
import { PostHogInit } from '@/components/PostHogInit'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: { default: 'Consorte Form', template: '%s | Consorte Form' },
  description: 'Formulários interativos passo a passo para prestadores de serviço',
  openGraph: {
    title: 'Consorte Form',
    description: 'Crie formulários de briefing profissionais e receba clientes mais preparados.',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        <PostHogInit />
        {children}
      </body>
    </html>
  )
}
