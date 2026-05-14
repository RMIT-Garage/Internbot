import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FirebaseError } from 'firebase/app'

const resetPasswordMock = vi.fn()
const toastErrorMock = vi.fn()
const toastSuccessMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/forgot-password',
}))

vi.mock('@/lib/firebase/auth', () => ({ resetPassword: resetPasswordMock }))

vi.mock('sonner', () => ({ toast: { error: toastErrorMock, success: toastSuccessMock } }))

const { ForgotPasswordForm } = await import('@/features/auth/components/ForgotPasswordForm')

describe('ForgotPasswordForm', () => {
  beforeEach(() => {
    resetPasswordMock.mockReset()
    toastErrorMock.mockReset()
    toastSuccessMock.mockReset()
  })

  it('rejects an empty or invalid email', async () => {
    const user = userEvent.setup()
    render(<ForgotPasswordForm />)
    await user.click(screen.getByRole('button', { name: /send reset link/i }))
    expect(await screen.findByText(/valid email/i)).toBeInTheDocument()
    expect(resetPasswordMock).not.toHaveBeenCalled()
  })

  it('calls resetPassword and shows the inbox-confirmation panel on success', async () => {
    resetPasswordMock.mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<ForgotPasswordForm />)

    await user.type(screen.getByLabelText(/^email$/i), 's1@student.rmit.edu.au')
    await user.click(screen.getByRole('button', { name: /send reset link/i }))

    await waitFor(() => expect(resetPasswordMock).toHaveBeenCalledWith('s1@student.rmit.edu.au'))
    expect(await screen.findByText(/check your inbox/i)).toBeInTheDocument()
    expect(screen.getByText(/s1@student\.rmit\.edu\.au/)).toBeInTheDocument()
    expect(toastSuccessMock).toHaveBeenCalled()
  })

  it('treats user-not-found as success to avoid email enumeration', async () => {
    resetPasswordMock.mockRejectedValue(new FirebaseError('auth/user-not-found', 'nope'))
    const user = userEvent.setup()
    render(<ForgotPasswordForm />)

    await user.type(screen.getByLabelText(/^email$/i), 'ghost@example.com')
    await user.click(screen.getByRole('button', { name: /send reset link/i }))

    expect(await screen.findByText(/check your inbox/i)).toBeInTheDocument()
    expect(toastSuccessMock).toHaveBeenCalled()
    expect(toastErrorMock).not.toHaveBeenCalled()
  })

  it('surfaces other Firebase errors via the friendly mapper', async () => {
    resetPasswordMock.mockRejectedValue(new FirebaseError('auth/too-many-requests', 'slow down'))
    const user = userEvent.setup()
    render(<ForgotPasswordForm />)

    await user.type(screen.getByLabelText(/^email$/i), 's1@student.rmit.edu.au')
    await user.click(screen.getByRole('button', { name: /send reset link/i }))

    await waitFor(() => expect(toastErrorMock).toHaveBeenCalled())
    expect(screen.queryByText(/check your inbox/i)).not.toBeInTheDocument()
  })
})
