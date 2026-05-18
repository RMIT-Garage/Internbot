import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FirebaseError } from 'firebase/app'

const pushMock = vi.fn()
const signInWithEmailMock = vi.fn()
const toastErrorMock = vi.fn()
const fetchCurrentUserMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
  usePathname: () => '/login',
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: null,
    profile: null,
    loading: false,
    needsVerification: false,
    signInWithEmail: signInWithEmailMock,
    signUpWithEmail: vi.fn(),
    signOut: vi.fn(),
    refreshProfile: vi.fn(),
  }),
}))

vi.mock('@/features/auth/api/users', () => ({
  fetchCurrentUser: fetchCurrentUserMock,
}))

vi.mock('sonner', () => ({ toast: { error: toastErrorMock, success: vi.fn() } }))

const { EmailPasswordLoginForm } = await import('@/features/auth/components/EmailPasswordLoginForm')

const baseProps = {
  idPrefix: 'staff',
  emailLabel: 'Staff Email',
  emailPlaceholder: 'e.g. j.doe@rmit.edu.au',
  submitLabel: 'Sign in with Staff ID',
}

describe('EmailPasswordLoginForm', () => {
  beforeEach(() => {
    pushMock.mockReset()
    signInWithEmailMock.mockReset()
    toastErrorMock.mockReset()
    fetchCurrentUserMock.mockReset()
    fetchCurrentUserMock.mockResolvedValue({ kind: 'ok', user: { role: 'student' } })
    window.history.replaceState({}, '', '/login')
  })

  it('renders email and password fields with the supplied labels and submit copy', () => {
    render(<EmailPasswordLoginForm {...baseProps} />)
    expect(screen.getByLabelText(/staff email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in with staff id/i })).toBeInTheDocument()
  })

  it('shows the Forgot Password link only when showForgotPassword is true', () => {
    const { rerender } = render(<EmailPasswordLoginForm {...baseProps} />)
    expect(screen.queryByRole('link', { name: /forgot password/i })).not.toBeInTheDocument()

    rerender(<EmailPasswordLoginForm {...baseProps} showForgotPassword />)
    expect(screen.getByRole('link', { name: /forgot password/i })).toBeInTheDocument()
  })

  it('shows validation errors when submitted empty', async () => {
    const user = userEvent.setup()
    render(<EmailPasswordLoginForm {...baseProps} />)

    await user.click(screen.getByRole('button', { name: /sign in with staff id/i }))

    expect(await screen.findByText(/valid email/i)).toBeInTheDocument()
    expect(await screen.findByText(/password is required/i)).toBeInTheDocument()
    expect(signInWithEmailMock).not.toHaveBeenCalled()
  })

  it('calls signInWithEmail and navigates to /dashboard on success', async () => {
    signInWithEmailMock.mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<EmailPasswordLoginForm {...baseProps} />)

    await user.type(screen.getByLabelText(/staff email/i), 'jane@rmit.edu.au')
    await user.type(screen.getByLabelText(/^password$/i), 'secret')
    await user.click(screen.getByRole('button', { name: /sign in with staff id/i }))

    await waitFor(() =>
      expect(signInWithEmailMock).toHaveBeenCalledWith('jane@rmit.edu.au', 'secret')
    )
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/dashboard'))
    expect(toastErrorMock).not.toHaveBeenCalled()
  })

  it('honors ?redirect= when navigating after success', async () => {
    signInWithEmailMock.mockResolvedValue(undefined)
    window.history.replaceState({}, '', '/login?redirect=%2Ftickets%2F42')

    const user = userEvent.setup()
    render(<EmailPasswordLoginForm {...baseProps} />)

    await user.type(screen.getByLabelText(/staff email/i), 'jane@rmit.edu.au')
    await user.type(screen.getByLabelText(/^password$/i), 'secret')
    await user.click(screen.getByRole('button', { name: /sign in with staff id/i }))

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/tickets/42'))
  })

  it('routes to /verify-email when the backend reports the email is not verified', async () => {
    signInWithEmailMock.mockResolvedValue(undefined)
    fetchCurrentUserMock.mockResolvedValue({ kind: 'unverified' })
    const user = userEvent.setup()
    render(<EmailPasswordLoginForm {...baseProps} />)

    await user.type(screen.getByLabelText(/staff email/i), 'jane@rmit.edu.au')
    await user.type(screen.getByLabelText(/^password$/i), 'secret')
    await user.click(screen.getByRole('button', { name: /sign in with staff id/i }))

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/verify-email'))
    expect(toastErrorMock).not.toHaveBeenCalled()
  })

  it('routes invalid-credential errors through the friendly auth-error mapper', async () => {
    signInWithEmailMock.mockRejectedValue(new FirebaseError('auth/invalid-credential', 'bad'))
    const user = userEvent.setup()
    render(<EmailPasswordLoginForm {...baseProps} />)

    await user.type(screen.getByLabelText(/staff email/i), 'jane@rmit.edu.au')
    await user.type(screen.getByLabelText(/^password$/i), 'secret')
    await user.click(screen.getByRole('button', { name: /sign in with staff id/i }))

    await waitFor(() =>
      expect(toastErrorMock).toHaveBeenCalledWith('Email or password is incorrect.')
    )
    expect(pushMock).not.toHaveBeenCalled()
  })

  it('uses the supplied idPrefix for input ids (allows two instances on the same page)', () => {
    const { rerender } = render(<EmailPasswordLoginForm {...baseProps} idPrefix="student" />)
    expect(document.getElementById('student-email')).not.toBeNull()
    expect(document.getElementById('student-password')).not.toBeNull()

    rerender(<EmailPasswordLoginForm {...baseProps} idPrefix="staff" />)
    expect(document.getElementById('staff-email')).not.toBeNull()
    expect(document.getElementById('staff-password')).not.toBeNull()
  })
})
