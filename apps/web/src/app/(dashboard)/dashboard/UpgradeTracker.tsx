'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { trackEvent } from '@/lib/posthog'

export function UpgradeTracker() {
  const searchParams = useSearchParams()
  useEffect(() => {
    if (searchParams.get('upgraded') === 'true') {
      trackEvent('upgrade_completed', { plan: 'unknown' })
      window.history.replaceState({}, '', '/dashboard')
    }
  }, [searchParams])
  return null
}
