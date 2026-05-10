import type { User } from 'firebase/auth'
import type { UserResponse } from './api'

export interface AuthContextValue {
  user: User | null
  profile: UserResponse | null
  /** True while either Firebase Auth state or the backend profile is still resolving. */
  loading: boolean
  /** True when Firebase has a user but the backend refuses to mint a platform user (email unverified). */
  needsVerification: boolean
  signInWithEmail: (email: string, password: string) => Promise<void>
  signUpWithEmail: (email: string, password: string, displayName: string) => Promise<void>
  signOut: () => Promise<void>
  /** Re-runs `GET /api/v1/users/me`. Use after the user clicks "I've verified my email". */
  refreshProfile: () => Promise<void>
}
