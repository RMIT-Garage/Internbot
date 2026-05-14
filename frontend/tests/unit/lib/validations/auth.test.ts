import { describe, it, expect } from 'vitest'
import { loginSchema, registerSchema, STUDENT_EMAIL_DOMAIN } from '@/lib/validations/auth'

describe('loginSchema', () => {
  it('accepts a valid email and a non-empty password', () => {
    const r = loginSchema.safeParse({ email: 'a@b.co', password: 'x' })
    expect(r.success).toBe(true)
  })

  it('rejects an invalid email', () => {
    const r = loginSchema.safeParse({ email: 'not-an-email', password: 'x' })
    expect(r.success).toBe(false)
  })

  it('rejects an empty password', () => {
    const r = loginSchema.safeParse({ email: 'a@b.co', password: '' })
    expect(r.success).toBe(false)
  })
})

describe('registerSchema', () => {
  const valid = {
    email: 's5000001@student.rmit.edu.au',
    password: 'Abcd1234!',
    confirmPassword: 'Abcd1234!',
  }

  it('accepts a valid RMIT student email and matching strong passwords', () => {
    const r = registerSchema.safeParse(valid)
    expect(r.success).toBe(true)
  })

  it(`rejects emails that are not on ${STUDENT_EMAIL_DOMAIN}`, () => {
    const r = registerSchema.safeParse({ ...valid, email: 'someone@gmail.com' })
    expect(r.success).toBe(false)
  })

  it('is case-insensitive for the institutional domain', () => {
    const r = registerSchema.safeParse({ ...valid, email: 'S1@Student.RMIT.Edu.AU' })
    expect(r.success).toBe(true)
  })

  it('rejects passwords without an uppercase letter', () => {
    const r = registerSchema.safeParse({
      ...valid,
      password: 'abcd1234',
      confirmPassword: 'abcd1234',
    })
    expect(r.success).toBe(false)
  })

  it('rejects passwords without a number', () => {
    const r = registerSchema.safeParse({
      ...valid,
      password: 'Abcdefgh!',
      confirmPassword: 'Abcdefgh!',
    })
    expect(r.success).toBe(false)
  })

  it('rejects passwords without a special character (matches Firebase password policy)', () => {
    const r = registerSchema.safeParse({
      ...valid,
      password: 'Abcd1234',
      confirmPassword: 'Abcd1234',
    })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues.some((i) => /special character/i.test(i.message))).toBe(true)
    }
  })

  it('rejects mismatched confirm password', () => {
    const r = registerSchema.safeParse({ ...valid, confirmPassword: 'Different1!' })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path.includes('confirmPassword'))).toBe(true)
    }
  })
})
