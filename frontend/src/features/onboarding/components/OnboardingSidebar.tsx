'use client'

import { useRouter } from 'next/navigation'
import {
  UserCircle,
  GraduationCap,
  BookOpen,
  CheckCircle,
  MessageCircle,
  LogOut,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

const steps = [
  { key: 'personal', label: 'Personal Details', icon: UserCircle },
  { key: 'academic', label: 'Academic Profile', icon: GraduationCap },
  { key: 'credits', label: 'Course Credits', icon: BookOpen },
  { key: 'review', label: 'Review', icon: CheckCircle },
] as const

type StepKey = (typeof steps)[number]['key']

interface Props {
  currentStep: StepKey
}

export function OnboardingSidebar({ currentStep }: Props) {
  const router = useRouter()
  const { signOut } = useAuth()

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
  }

  return (
    <aside className="flex w-64 shrink-0 flex-col justify-between border-r border-gray-100 bg-white p-8">
      <div>
        {/* Logo */}
        <div className="mb-12 flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-red-600 text-xs font-bold text-white">
            i
          </div>
          <span className="text-lg font-semibold text-red-600">Internbot</span>
        </div>

        {/* Heading */}
        <div className="mb-12">
          <h1 className="mb-1 text-2xl font-semibold">Profile Setup</h1>
          <p className="text-[10px] font-medium uppercase tracking-widest text-gray-400">
            Onboarding Progress
          </p>
        </div>

        {/* Step nav */}
        <nav className="space-y-1.5">
          {steps.map(({ key, label, icon: Icon }) => {
            const active = key === currentStep
            return (
              <div
                key={key}
                className={`flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm transition-colors ${
                  active ? 'bg-red-50 font-medium text-red-600' : 'cursor-not-allowed text-gray-400'
                }`}
              >
                <Icon size={20} className={active ? 'text-red-600' : 'text-gray-300'} />
                {label}
              </div>
            )
          })}
        </nav>
      </div>

      {/* Footer */}
      <div className="space-y-1.5 border-t border-gray-100 pt-6">
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-lg px-4 py-2 text-sm text-gray-500 hover:bg-gray-50"
        >
          <LogOut size={20} className="text-gray-400" />
          Sign Out
        </button>
      </div>
    </aside>
  )
}
