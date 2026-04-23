export enum Plan {
  FREE = 'FREE',
  PRO = 'PRO',
  AGENCY = 'AGENCY',
}

export enum FormStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  PAUSED = 'PAUSED',
}

export enum QuestionType {
  SHORT_TEXT = 'SHORT_TEXT',
  LONG_TEXT = 'LONG_TEXT',
  MULTIPLE_CHOICE = 'MULTIPLE_CHOICE',
  MULTIPLE_SELECT = 'MULTIPLE_SELECT',
  SCALE = 'SCALE',
}

export enum ResponseStatus {
  UNLOCKED = 'UNLOCKED',
  QUARANTINED = 'QUARANTINED',
}

export enum PaymentType {
  OVERAGE_SINGLE = 'OVERAGE_SINGLE',
  OVERAGE_PACK = 'OVERAGE_PACK',
  SUBSCRIPTION = 'SUBSCRIPTION',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  FAILED = 'FAILED',
}

export interface User {
  id: string
  email: string
  name: string | null
  slug: string | null
  niche: string | null
  avatarUrl: string | null
  plan: Plan
  onboardingDone: boolean
  createdAt: string
  updatedAt: string
}
