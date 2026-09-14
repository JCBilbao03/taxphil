import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore'

import { db } from '@/lib/firebase'
import { transactionsCollectionPath } from '@/lib/firestore/paths'
import type { Transaction, TransactionType } from '@/store/useTaxStore'

export interface TransactionDocument {
  type: TransactionType
  description: string
  amount: number
  date: string
  category: string
  reference?: string
  createdAt: unknown
}

export interface TransactionInput {
  type: TransactionType
  description: string
  amount: number
  date: string
  category: string
  reference?: string
}

function transactionsRef(userId: string) {
  return collection(db, transactionsCollectionPath(userId))
}

function transactionDocRef(userId: string, transactionId: string) {
  return doc(db, transactionsCollectionPath(userId), transactionId)
}

export async function addTransactionDocument(
  userId: string,
  transaction: TransactionInput,
): Promise<string> {
  const docRef = await addDoc(transactionsRef(userId), {
    ...transaction,
    createdAt: serverTimestamp(),
  })
  return docRef.id
}

export async function removeTransactionDocument(
  userId: string,
  transactionId: string,
): Promise<void> {
  await deleteDoc(transactionDocRef(userId, transactionId))
}

function mapTransactionDocument(
  id: string,
  data: TransactionDocument,
): Transaction {
  return {
    id,
    type: data.type,
    description: data.description,
    amount: data.amount,
    date: data.date,
    category: data.category,
    reference: data.reference,
  }
}

export function subscribeToTransactions(
  userId: string,
  onData: (transactions: Transaction[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    transactionsRef(userId),
    (snapshot) => {
      const transactions = snapshot.docs.map((docSnap) =>
        mapTransactionDocument(
          docSnap.id,
          docSnap.data() as TransactionDocument,
        ),
      )
      onData(transactions)
    },
    (error) => onError(error),
  )
}
