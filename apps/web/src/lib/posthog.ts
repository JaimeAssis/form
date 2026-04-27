import posthog from 'posthog-js'

let initialized = false

export function initPostHog() {
  if (initialized || typeof window === 'undefined') return
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://app.posthog.com'
  if (!key) return
  posthog.init(key, { api_host: host, capture_pageview: true })
  initialized = true
}

export function identifyUser(userId: string, props: { plan: string; nicho?: string }) {
  posthog.identify(userId, props)
}

export function trackEvent(event: string, properties?: Record<string, unknown>) {
  posthog.capture(event, properties)
}

export function resetUser() {
  posthog.reset()
}
