import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FirebaseError } from 'firebase/app'

const pushMock = vi.fn()
const signUpWithEmailMock = vi.fn()
const toastErrorMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
  usePathname: () => '/register',
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: null,
    profile: null,
    loading: false,
    signInWithEmail: vi.fn(),
    signUpWithEmail: signUpWithEmailMock,
    signInWithGoogle: vi.fn(),
    signOut: vi.fn(),
  }),
}))

vi.mock('sonner', () => ({ toast: { error: toastErrorMock, success: vi.fn() } }))

const { RegisterForm } = await import('@/features/auth/components/RegisterForm')

describe('RegisterForm', () => {
  beforeEach(() => {
    pushMock.mockReset()
    signUpWithEmailMock.mockReset()
    toastErrorMock.mockReset()
    window.history.replaceState({}, '', '/register')
  })

  it('rejects emails that are not on the RMIT student domain', async () => {
    const user = userEvent.setup()
    render(<RegisterForm />)

    await user.type(screen.getByLabelText(/institutional email/i), 'someone@gmail.com')
    await user.type(screen.getByLabelText(/^password$/i), 'Abcd1234')
    await user.type(screen.getByLabelText(/confirm/i), 'Abcd1234')
    await user.click(screen.getByRole('button', { name: /create account/i }))

    expect(await screen.findByText(/@student\.rmit\.edu\.au/i)).toBeInTheDocument()
    expect(signUpWithEmailMock).not.toHaveBeenCalled()
  })

  it('flags mismatched confirm password', async () => {
    const user = userEvent.setup()
    render(<RegisterForm />)

    await user.type(screen.getByLabelText(/institutional email/i), 's5000001@student.rmit.edu.au')
    await user.type(screen.getByLabelText(/^password$/i), 'Abcd1234')
    await user.type(screen.getByLabelText(/confirm/i), 'Different1')
    await user.click(screen.getByRole('button', { name: /create account/i }))

    expect(await screen.findByText(/passwords do not match/i)).toBeInTheDocument()
    expect(signUpWithEmailMock).not.toHaveBeenCalled()
  })

  it('submits with the email local part as displayName and navigates to /dashboard', async () => {
    signUpWithEmailMock.mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<RegisterForm />)

    await user.type(screen.getByLabelText(/institutional email/i), 's5000001@student.rmit.edu.au')
    await user.type(screen.getByLabelText(/^password$/i), 'Abcd1234')
    await user.type(screen.getByLabelText(/confirm/i), 'Abcd1234')
    await user.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() =>
      expect(signUpWithEmailMock).toHaveBeenCalledWith(
        's5000001@student.rmit.edu.au',
        'Abcd1234',
        's5000001'
      )
    )
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/dashboard'))
  })

  it('surfaces a friendly message when the email is already in use', async () => {
    signUpWithEmailMock.mockRejectedValue(new FirebaseError('auth/email-already-in-use', 'dup'))
    const user = userEvent.setup()
    render(<RegisterForm />)

    await user.type(screen.getByLabelText(/institutional email/i), 's5000001@student.rmit.edu.au')
    await user.type(screen.getByLabelText(/^password$/i), 'Abcd1234')
    await user.type(screen.getByLabelText(/confirm/i), 'Abcd1234')
    await user.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() =>
      expect(toastErrorMock).toHaveBeenCalledWith('An account with this email already exists.')
    )
    expect(pushMock).not.toHaveBeenCalled()
  })
})
