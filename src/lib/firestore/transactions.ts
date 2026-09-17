import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  runTransaction,
  type Unsubscribe,
} from 'firebase/firestore'

import { db } from '@/lib/firebase'
import { transactionsCollectionPath } from '@/lib/firestore/paths'
import type { Transaction, TransactionType } from '@/store/useTaxStore'
import { normalizeTransaction } from '@/lib/tax-workflows'

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
    ...normalizeTransaction(transaction),
    createdAt: serverTimestamp(),
  })
  return docRef.id
}

export async function removeTransactionDocument(
  userId: string,
  transactionId: string,
  expected: Transaction,
): Promise<void> {
  await runTransaction(db, async tx => {
    const ref = transactionDocRef(userId, transactionId)
    const snapshot = await tx.get(ref)
    if (!snapshot.exists()) throw Error('This transaction no longer exists.')
    const current = mapTransactionDocument(snapshot.id, snapshot.data() as TransactionDocument)
    for (const field of ['type', 'description', 'amount', 'date', 'category', 'reference'] as const) {
      if ((current[field] ?? '') !== (expected[field] ?? '')) throw Error('This transaction changed. Cancel removal and review the latest record first.')
    }
    tx.delete(ref)
  })
}

export async function updateTransactionDocument(userId: string, transactionId: string, input: TransactionInput, expected: Transaction): Promise<void> {
  const clean = normalizeTransaction(input)
  await runTransaction(db, async tx => {
    const ref = transactionDocRef(userId, transactionId)
    const snapshot = await tx.get(ref)
    if (!snapshot.exists()) throw Error('This transaction no longer exists.')
    const current = mapTransactionDocument(snapshot.id, snapshot.data() as TransactionDocument)
    for (const field of ['type', 'description', 'amount', 'date', 'category', 'reference'] as const) {
      if ((current[field] ?? '') !== (expected[field] ?? '')) throw Error('This transaction changed while you were editing. Cancel and reopen it to review the latest version.')
    }
    tx.update(ref, { ...clean, updatedAt: serverTimestamp() })
  })
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
