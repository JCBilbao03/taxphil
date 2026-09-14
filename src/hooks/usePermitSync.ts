import { FirebaseError } from 'firebase/app'
import { useEffect } from 'react'

import {
  subscribeToPayments,
  subscribeToPermits,
} from '@/lib/firestore/permits'
import { useAuthUser } from '@/store/useAuthStore'
import { usePermitStore } from '@/store/usePermitStore'

function getFirebaseErrorMessage(error: unknown): string {
  if (error instanceof FirebaseError) {
    if (error.code === 'permission-denied') {
      return 'Permit data access denied. Sign out and back in if you recently verified your email. If the issue persists, Firestore rules may need to be deployed (firebase deploy --only firestore:rules).'
    }
    return error.message
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'Failed to load permit data'
}

export function usePermitSync() {
  const user = useAuthUser()
  const setPermits = usePermitStore((state) => state.setPermits)
  const setPayments = usePermitStore((state) => state.setPayments)
  const setLoading = usePermitStore((state) => state.setLoading)
  const setError = usePermitStore((state) => state.setError)

  useEffect(() => {
    if (!user?.uid || !user.emailVerified) {
      setPermits([])
      setPayments([])
      setLoading(false)
      setError(null)
      return
    }

    let cancelled = false
    const userId = user.uid
    let permitsLoaded = false
    let paymentsLoaded = false
    let unsubscribePermits: (() => void) | undefined
    let unsubscribePayments: (() => void) | undefined

    const markLoaded = () => {
      if (permitsLoaded && paymentsLoaded && !cancelled) {
        setLoading(false)
      }
    }

    setLoading(true)
    setError(null)

    void (async () => {
      try {
        // Firestore rules check request.auth.token.email_verified, not user.emailVerified.
        await user.getIdToken(true)
      } catch (error) {
        if (!cancelled) {
          setError(getFirebaseErrorMessage(error))
          setLoading(false)
        }
        return
      }

      if (cancelled) return

      unsubscribePermits = subscribeToPermits(
        userId,
        (permits) => {
          if (cancelled) return
          setPermits(permits)
          permitsLoaded = true
          markLoaded()
        },
        (error) => {
          if (!cancelled) {
            setError(getFirebaseErrorMessage(error))
            setLoading(false)
          }
        },
      )

      unsubscribePayments = subscribeToPayments(
        userId,
        (payments) => {
          if (cancelled) return
          setPayments(payments)
          paymentsLoaded = true
          markLoaded()
        },
        (error) => {
          if (!cancelled) {
            setError(getFirebaseErrorMessage(error))
            setLoading(false)
          }
        },
      )
    })()

    return () => {
      cancelled = true
      unsubscribePermits?.()
      unsubscribePayments?.()
    }
  }, [
    user?.uid,
    user?.emailVerified,
    setError,
    setLoading,
    setPayments,
    setPermits,
  ])
}
