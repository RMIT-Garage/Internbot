import { describe, it, expect, vi, beforeEach } from 'vitest'

const createUserMock = vi.fn()
const updateProfileMock = vi.fn()
const sendEmailVerificationMock = vi.fn()
const signInMock = vi.fn()

vi.mock('firebase/auth', async () => {
  const actual = await vi.importActual<typeof import('firebase/auth')>('firebase/auth')
  return {
    ...actual,
    createUserWithEmailAndPassword: createUserMock,
    updateProfile: updateProfileMock,
    sendEmailVerification: sendEmailVerificationMock,
    signInWithEmailAndPassword: signInMock,
  }
})

const { signUpWithEmail, resendVerificationEmail } = await import('@/lib/firebase/auth')
const { auth } = (await import('@/lib/firebase/client')) as unknown as {
  auth: { currentUser: unknown }
}

describe('signUpWithEmail', () => {
  beforeEach(() => {
    createUserMock.mockReset()
    updateProfileMock.mockReset()
    sendEmailVerificationMock.mockReset()
  })

  it('creates the user, sets displayName, and sends a verification email', async () => {
    const fakeUser = { uid: 'u1' }
    createUserMock.mockResolvedValue({ user: fakeUser })
    updateProfileMock.mockResolvedValue(undefined)
    sendEmailVerificationMock.mockResolvedValue(undefined)

    const result = await signUpWithEmail('s5000001@student.rmit.edu.au', 'Abcd1234', 's5000001')

    expect(createUserMock).toHaveBeenCalledTimes(1)
    expect(updateProfileMock).toHaveBeenCalledWith(fakeUser, { displayName: 's5000001' })
    expect(sendEmailVerificationMock).toHaveBeenCalledWith(fakeUser)
    expect(result).toBe(fakeUser)
  })

  it('still resolves with the user when the verification email send fails', async () => {
    const fakeUser = { uid: 'u2' }
    createUserMock.mockResolvedValue({ user: fakeUser })
    updateProfileMock.mockResolvedValue(undefined)
    sendEmailVerificationMock.mockRejectedValue(new Error('throttled'))
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = await signUpWithEmail('s5000001@student.rmit.edu.au', 'Abcd1234', 's5000001')

    expect(result).toBe(fakeUser)
    expect(errorSpy).toHaveBeenCalled()
    errorSpy.mockRestore()
  })

  it('propagates failures from createUserWithEmailAndPassword', async () => {
    createUserMock.mockRejectedValue(new Error('email-already-in-use'))

    await expect(
      signUpWithEmail('s5000001@student.rmit.edu.au', 'Abcd1234', 's5000001')
    ).rejects.toThrow('email-already-in-use')
    expect(updateProfileMock).not.toHaveBeenCalled()
    expect(sendEmailVerificationMock).not.toHaveBeenCalled()
  })
})

describe('resendVerificationEmail', () => {
  beforeEach(() => {
    sendEmailVerificationMock.mockReset()
    ;(auth as { currentUser: unknown }).currentUser = null
  })

  it('throws when there is no signed-in user', async () => {
    await expect(resendVerificationEmail()).rejects.toThrow(/no signed-in user/i)
    expect(sendEmailVerificationMock).not.toHaveBeenCalled()
  })

  it('forwards to sendEmailVerification when a user is signed in', async () => {
    const fakeUser = { uid: 'u3' }
    ;(auth as { currentUser: unknown }).currentUser = fakeUser
    sendEmailVerificationMock.mockResolvedValue(undefined)

    await resendVerificationEmail()

    expect(sendEmailVerificationMock).toHaveBeenCalledWith(fakeUser)
  })
})
