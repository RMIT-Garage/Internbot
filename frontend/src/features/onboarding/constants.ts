export const ONBOARDING_STEPS = [
  {
    key: 'personal',
    label: 'Personal details',
    shortLabel: 'Identity',
    href: '/onboarding/personal',
    number: 1,
  },
  {
    key: 'academic',
    label: 'Academic profile',
    shortLabel: 'Academic',
    href: '/onboarding/academic',
    number: 2,
  },
  {
    key: 'credits',
    label: 'Course credits',
    shortLabel: 'Credits',
    href: '/onboarding/credits',
    number: 3,
  },
  {
    key: 'semester',
    label: 'Semester',
    shortLabel: 'Semester',
    href: '/onboarding/semester',
    number: 4,
  },
  {
    key: 'review',
    label: 'Review',
    shortLabel: 'Finalize',
    href: '/onboarding/review',
    number: 5,
  },
] as const

export type OnboardingStepKey = (typeof ONBOARDING_STEPS)[number]['key']

export function getOnboardingStepIndex(key: OnboardingStepKey): number {
  return ONBOARDING_STEPS.findIndex((s) => s.key === key)
}

export function isOnboardingStepReached(
  current: OnboardingStepKey,
  target: OnboardingStepKey
): boolean {
  return getOnboardingStepIndex(target) <= getOnboardingStepIndex(current)
}
