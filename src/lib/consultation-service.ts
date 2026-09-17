import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from '@/lib/firebase'
import type { Consultation, ConsultationAction, ConsultationRequest } from '@/lib/consultations'

export function subscribeConsultations(uid: string, admin: boolean, onData: (records: Consultation[]) => void, onError: (error: Error) => void) {
  const reference = collection(db, 'consultations')
  const scoped = admin ? reference : query(reference, where('ownerUid', '==', uid))
  return onSnapshot(scoped, (snapshot) => {
    onData(snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }) as Consultation).sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
  }, onError)
}

export async function createConsultation(details: ConsultationRequest, requestId: string) {
  const result = await httpsCallable<{ details: ConsultationRequest; requestId: string }, { id: string }>(functions, 'consultationCreate')({ details, requestId })
  return result.data
}

export async function updateConsultation(record: Consultation, action: ConsultationAction) {
  const result = await httpsCallable(functions, 'consultationUpdate')({ id: record.id, revision: record.revision, action })
  return result.data
}
