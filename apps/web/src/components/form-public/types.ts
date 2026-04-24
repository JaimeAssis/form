import { Question } from '@consorte/types'

export interface PublicFormUser {
  name: string
  avatarUrl: string | null
  slug: string
}

export interface PublicFormData {
  id: string
  title: string
  description: string | null
  slug: string
  status: string
  brandColor: string | null
  logoUrl: string | null
  welcomeTitle: string | null
  welcomeMessage: string | null
  thankYouTitle: string | null
  thankYouMessage: string | null
  questions: Question[]
  user: PublicFormUser
}
