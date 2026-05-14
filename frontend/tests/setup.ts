import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock Firebase Auth client — never call real Firebase in unit tests.
// Firestore/Storage SDKs are not imported by the frontend, so no mocks
// for `db`/`storage` are needed.
vi.mock('@/lib/firebase/client', () => ({
  auth: { currentUser: null, onAuthStateChanged: vi.fn() },
  app: {},
}))
