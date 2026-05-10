import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FirebaseError } from 'firebase/app'

const pushMock = vi.fn()
const signInWithEmailMock = vi.fn()
const toastErrorMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
  usePathname: () => '/login',
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: null,
    profile: null,
    loading: false,
    signInWithEmail: signInWithEmailMock,
    signUpWithEmail: vi.fn(),
    signInWithGoogle: vi.fn(),
    signOut: vi.fn(),
  }),
}))

vi.mock('sonner', () => ({ toast: { error: toastErrorMock, success: vi.fn() } }))

const { StaffLoginForm } = await import('@/features/auth/components/StaffLoginForm')

describe('StaffLoginForm', () => {
  beforeEach(() => {
    pushMock.mockReset()
    signInWithEmailMock.mockReset()
    toastErrorMock.mockReset()
    window.history.replaceState({}, '', '/login')
  })

  it('renders email and password fields with labels', () => {
    render(<StaffLoginForm />)
    expect(screen.getByLabelText(/staff email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in with staff id/i })).toBeInTheDocument()
  })

  it('shows validation errors when submitted empty', async () => {
    const user = userEvent.setup()
    render(<StaffLoginForm />)

    await user.click(screen.getByRole('button', { name: /sign in with staff id/i }))

    expect(await screen.findByText(/valid email/i)).toBeInTheDocument()
    expect(await screen.findByText(/password is required/i)).toBeInTheDocument()
    expect(signInWithEmailMock).not.toHaveBeenCalled()
  })

  it('calls signInWithEmail and navigates on success', async () => {
    signInWithEmailMock.mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<StaffLoginForm />)

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
    render(<StaffLoginForm />)

    await user.type(screen.getByLabelText(/staff email/i), 'jane@rmit.edu.au')
    await user.type(screen.getByLabelText(/^password$/i), 'secret')
    await user.click(screen.getByRole('button', { name: /sign in with staff id/i }))

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/tickets/42'))
  })

  it('surfaces a friendly toast when Firebase rejects the credential', async () => {
    signInWithEmailMock.mockRejectedValue(new FirebaseError('auth/invalid-credential', 'bad'))
    const user = userEvent.setup()
    render(<StaffLoginForm />)

    await user.type(screen.getByLabelText(/staff email/i), 'jane@rmit.edu.au')
    await user.type(screen.getByLabelText(/^password$/i), 'secret')
    await user.click(screen.getByRole('button', { name: /sign in with staff id/i }))

    await waitFor(() =>
      expect(toastErrorMock).toHaveBeenCalledWith('Email or password is incorrect.')
    )
    expect(pushMock).not.toHaveBeenCalled()
  })

  it('routes too-many-requests errors to a throttle message', async () => {
    signInWithEmailMock.mockRejectedValue(new FirebaseError('auth/too-many-requests', 'x'))
    const user = userEvent.setup()
    render(<StaffLoginForm />)

    await user.type(screen.getByLabelText(/staff email/i), 'jane@rmit.edu.au')
    await user.type(screen.getByLabelText(/^password$/i), 'secret')
    await user.click(screen.getByRole('button', { name: /sign in with staff id/i }))

    await waitFor(() =>
      expect(toastErrorMock).toHaveBeenCalledWith(
        'Too many attempts. Please try again in a few minutes.'
      )
    )
  })
})
