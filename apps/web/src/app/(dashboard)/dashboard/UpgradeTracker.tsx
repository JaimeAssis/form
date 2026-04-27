'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { trackEvent } from '@/lib/posthog'
import { getSubscription } from '@/lib/api'

export function UpgradeTracker() {
  const searchParams = useSearchParams()

  useEffect(() => {
    if (searchParams.get('upgraded') !== 'true') return

    // Buscar o plano real e disparar o evento
    getSubscription()
      .then((sub) => {
        trackEvent('upgrade_completed', { plan: sub.plan })
      })
      .catch(() => {
        trackEvent('upgrade_completed', { plan: 'unknown' })
      })
      .finally(() => {
        window.history.replaceState({}, '', '/dashboard')
      })
  }, [searchParams])

  return null
}
