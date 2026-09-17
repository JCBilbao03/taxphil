import { useEffect, useState } from 'react'
import { subscribeConsultations } from '@/lib/consultation-service'
import type { Consultation } from '@/lib/consultations'
import { useAuthUser } from '@/store/useAuthStore'

export function useConsultations(admin = false) {
  const uid = useAuthUser()?.uid
  const [state, setState] = useState<{ uid?: string; admin: boolean; records: Consultation[]; loading: boolean; error: string }>({ admin, records: [], loading: true, error: '' })
  useEffect(() => {
    if (!uid) return
    return subscribeConsultations(uid, admin,
      (records) => setState({ uid, admin, records, loading: false, error: '' }),
      (error) => setState({ uid, admin, records: [], loading: false, error: error.message }),
    )
  }, [uid, admin])
  if (!uid) return { records: [], loading: false, error: 'Sign in to view your consultations.' }
  if (state.uid !== uid || state.admin !== admin) return { records: [], loading: true, error: '' }
  return state
}
