import { create } from 'zustand'
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  type User,
} from 'firebase/auth'
import { ref, serverTimestamp, set as rtdbSet } from 'firebase/database'

import { getAuthErrorMessage } from '@/lib/auth-errors'
import { sendVerificationEmail } from '@/lib/email-verification'
import { sendPasswordReset } from '@/lib/password-reset'
import { auth, rtdb } from '@/lib/firebase'

export interface UserProfile {
  email: string
  displayName: string
  createdAt: ReturnType<typeof serverTimestamp>
}

interface AuthState {
  user: User | null
  loading: boolean
  initialized: boolean
  initialize: () => () => void
  signUp: (email: string, password: string, displayName: string) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  resendVerificationEmail: () => Promise<void>
  reloadUser: () => Promise<boolean>
  sendPasswordResetEmail: (email: string) => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: false,
  initialized: false,

  initialize: () => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      set({ user, initialized: true })
    })

    return unsubscribe
  },

  signUp: async (email, password, displayName) => {
    set({ loading: true })

    try {
      const { user } = await createUserWithEmailAndPassword(auth, email, password)
      await updateProfile(user, { displayName })

      const profile: UserProfile = {
        email,
        displayName,
        createdAt: serverTimestamp(),
      }

      await rtdbSet(ref(rtdb, `users/${user.uid}`), profile)
      await sendVerificationEmail(user)
      set({ user, loading: false })
    } catch (error) {
      set({ loading: false })
      throw new Error(getAuthErrorMessage(error))
    }
  },

  signIn: async (email, password) => {
    set({ loading: true })

    try {
      const { user } = await signInWithEmailAndPassword(auth, email, password)
      set({ user, loading: false })
    } catch (error) {
      set({ loading: false })
      throw new Error(getAuthErrorMessage(error))
    }
  },

  signOut: async () => {
    set({ loading: true })

    try {
      await firebaseSignOut(auth)
      set({ user: null, loading: false })
    } catch (error) {
      set({ loading: false })
      throw new Error(getAuthErrorMessage(error))
    }
  },

  resendVerificationEmail: async () => {
    const user = auth.currentUser

    if (!user) {
      throw new Error('You must be signed in to resend a verification email.')
    }

    if (user.emailVerified) {
      throw new Error('Your email is already verified.')
    }

    set({ loading: true })

    try {
      await sendVerificationEmail(user)
      set({ loading: false })
    } catch (error) {
      set({ loading: false })
      throw new Error(getAuthErrorMessage(error))
    }
  },

  reloadUser: async () => {
    const user = auth.currentUser

    if (!user) {
      return false
    }

    set({ loading: true })

    try {
      await user.reload()
      await user.getIdToken(true)
      set({ user: auth.currentUser, loading: false })
      return auth.currentUser?.emailVerified ?? false
    } catch (error) {
      set({ loading: false })
      throw new Error(getAuthErrorMessage(error))
    }
  },

  sendPasswordResetEmail: async (email) => {
    set({ loading: true })

    try {
      await sendPasswordReset(email)
      set({ loading: false })
    } catch (error) {
      set({ loading: false })
      throw new Error(getAuthErrorMessage(error))
    }
  },
}))

export function useAuthInitialized() {
  return useAuthStore((state) => state.initialized)
}

export function useAuthUser() {
  return useAuthStore((state) => state.user)
}

export function useAuthLoading() {
  return useAuthStore((state) => state.loading)
}
