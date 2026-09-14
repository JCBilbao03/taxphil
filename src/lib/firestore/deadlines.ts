import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore'

import { db } from '@/lib/firebase'
import { deadlinesCollectionPath } from '@/lib/firestore/paths'
import type { TaxDeadline } from '@/store/useTaxStore'

export interface DeadlineDocument {
  formType: TaxDeadline['formType']
  title: string
  dueDate: string
  amountDue: number
  status: TaxDeadline['status']
  createdAt: unknown
  updatedAt: unknown
}

function deadlinesRef(userId: string) {
  return collection(db, deadlinesCollectionPath(userId))
}

function deadlineDocRef(userId: string, deadlineId: string) {
  return doc(db, deadlinesCollectionPath(userId), deadlineId)
}

export async function markDeadlineFiled(
  userId: string,
  deadlineId: string,
): Promise<void> {
  await updateDoc(deadlineDocRef(userId, deadlineId), {
    status: 'filed',
    updatedAt: serverTimestamp(),
  })
}

function mapDeadlineDocument(id: string, data: DeadlineDocument): TaxDeadline {
  return {
    id,
    formType: data.formType,
    title: data.title,
    dueDate: data.dueDate,
    amountDue: data.amountDue,
    status: data.status,
  }
}

export function subscribeToDeadlines(
  userId: string,
  onData: (deadlines: TaxDeadline[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    deadlinesRef(userId),
    (snapshot) => {
      const deadlines = snapshot.docs.map((docSnap) =>
        mapDeadlineDocument(docSnap.id, docSnap.data() as DeadlineDocument),
      )
      onData(deadlines)
    },
    (error) => onError(error),
  )
}
