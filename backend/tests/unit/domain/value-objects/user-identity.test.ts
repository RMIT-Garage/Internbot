import { describe, it, expect } from 'vitest'
import { UserIdentity } from '../../../../src/domain/value-objects/user-identity'

describe('UserIdentity.create', () => {
  it('rejects empty providerUserId', () => {
    expect(() =>
      UserIdentity.create({
        provider: 'firebase',
        providerUserId: '',
        emailSnapshot: undefined,
      })
    ).toThrowError(/providerUserId/)
  })

  it('rejects whitespace-only providerUserId', () => {
    expect(() =>
      UserIdentity.create({
        provider: 'firebase',
        providerUserId: '   ',
        emailSnapshot: undefined,
      })
    ).toThrowError(/providerUserId/)
  })

  it('returns a UserIdentity instance with the props', () => {
    const i = UserIdentity.create({
      provider: 'firebase',
      providerUserId: 'fb_abc',
      emailSnapshot: 'a@b.com',
    })
    expect(i.provider).toBe('firebase')
    expect(i.providerUserId).toBe('fb_abc')
    expect(i.emailSnapshot).toBe('a@b.com')
  })

  it('accepts undefined emailSnapshot', () => {
    const i = UserIdentity.create({
      provider: 'firebase',
      providerUserId: 'fb_abc',
      emailSnapshot: undefined,
    })
    expect(i.emailSnapshot).toBeUndefined()
  })
})

describe('UserIdentity.rehydrate', () => {
  it('skips validation (storage path trusts persisted data)', () => {
    expect(() =>
      UserIdentity.rehydrate({
        provider: 'firebase',
        providerUserId: '',
        emailSnapshot: undefined,
      })
    ).not.toThrow()
  })
})

describe('UserIdentity.toLookupKey', () => {
  it('builds the deterministic Firestore doc id', () => {
    const i = UserIdentity.rehydrate({
      provider: 'firebase',
      providerUserId: 'fb_abc',
      emailSnapshot: undefined,
    })
    expect(i.toLookupKey()).toBe('firebase__fb_abc')
  })

  it('URL-encodes providerUserId so non-alphanumerics do not collide on the separator', () => {
    const i = UserIdentity.rehydrate({
      provider: 'firebase',
      providerUserId: 'a/b__c',
      emailSnapshot: undefined,
    })
    expect(i.toLookupKey()).toBe('firebase__a%2Fb__c')
  })
})

describe('UserIdentity.equals', () => {
  it('returns true for same provider + providerUserId', () => {
    const a = UserIdentity.rehydrate({
      provider: 'firebase',
      providerUserId: 'fb_abc',
      emailSnapshot: undefined,
    })
    const b = UserIdentity.rehydrate({
      provider: 'firebase',
      providerUserId: 'fb_abc',
      emailSnapshot: 'different@example.com',
    })
    expect(a.equals(b)).toBe(true)
  })

  it('returns false for different providerUserId', () => {
    const a = UserIdentity.rehydrate({
      provider: 'firebase',
      providerUserId: 'fb_abc',
      emailSnapshot: undefined,
    })
    const b = UserIdentity.rehydrate({
      provider: 'firebase',
      providerUserId: 'fb_xyz',
      emailSnapshot: undefined,
    })
    expect(a.equals(b)).toBe(false)
  })
})
