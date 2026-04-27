'use client'
import { useEffect } from 'react'
import { identifyUser } from '@/lib/posthog'

interface UserIdentifierProps {
  userId: string
  plan: string
  nicho?: string
}

export function UserIdentifier({ userId, plan, nicho }: UserIdentifierProps) {
  useEffect(() => {
    identifyUser(userId, { plan, nicho })
  }, [userId, plan, nicho])
  return null
}
