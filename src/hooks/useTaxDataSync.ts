import { FirebaseError } from 'firebase/app'
import { useEffect } from 'react'

import { subscribeToDeadlines } from '@/lib/firestore/deadlines'
import { subscribeToTransactions } from '@/lib/firestore/transactions'
import { useAuthUser } from '@/store/useAuthStore'
import { useTaxStore } from '@/store/useTaxStore'

function getFirebaseErrorMessage(error: unknown): string {
  if (error instanceof FirebaseError) {
    if (error.code === 'permission-denied') {
      return 'Tax data access denied. Try signing out and back in after verifying your email.'
    }
    return error.message
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'Failed to load tax data'
}

export function useTaxDataSync() {
  const user = useAuthUser()
  const setIncome = useTaxStore((state) => state.setIncome)
  const setExpenses = useTaxStore((state) => state.setExpenses)
  const setDeadlines = useTaxStore((state) => state.setDeadlines)
  const setLoading = useTaxStore((state) => state.setLoading)
  const setError = useTaxStore((state) => state.setError)

  useEffect(() => {
    if (!user?.uid || !user.emailVerified) {
      setIncome([])
      setExpenses([])
      setDeadlines([])
      setLoading(false)
      setError(null)
      return
    }

    let cancelled = false
    const userId = user.uid

    setIncome([]); setExpenses([]); setDeadlines([])
    setLoading(true); setError(null)
    const ready = { transactions: false, deadlines: false }
    const errors: { transactions: string | null; deadlines: string | null } = { transactions: null, deadlines: null }
    const complete = (source: 'transactions' | 'deadlines', error: unknown = null) => {
      if (cancelled) return
      ready[source] = true
      errors[source] = error ? getFirebaseErrorMessage(error) : null
      setError([errors.transactions, errors.deadlines].filter(Boolean).join(' ') || null)
      setLoading(!(ready.transactions && ready.deadlines))
    }

    const unsubscribeTransactions = subscribeToTransactions(
      userId,
      (transactions) => {
        if (cancelled) return

        setIncome(transactions.filter((item) => item.type === 'income'))
        setExpenses(transactions.filter((item) => item.type === 'expense'))
        complete('transactions')
      },
      (error) => {
        if (!cancelled) { setIncome([]); setExpenses([]); complete('transactions', error) }
      },
    )

    const unsubscribeDeadlines = subscribeToDeadlines(
      userId,
      (deadlines) => {
        if (!cancelled) {
          setDeadlines(deadlines)
          complete('deadlines')
        }
      },
      (error) => {
        if (!cancelled) { setDeadlines([]); complete('deadlines', error) }
      },
    )

    return () => {
      cancelled = true
      unsubscribeTransactions()
      unsubscribeDeadlines()
    }
  }, [
    user?.uid,
    user?.emailVerified,
    setDeadlines,
    setError,
    setExpenses,
    setIncome,
    setLoading,
  ])
}
