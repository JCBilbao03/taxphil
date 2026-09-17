import { addDoc, collection, doc, onSnapshot, runTransaction, serverTimestamp, type Unsubscribe } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { deadlinesCollectionPath } from '@/lib/firestore/paths'
import { normalizeDeadline, normalizeFilingEvidence, type ManualDeadlineInput, type FilingEvidence } from '@/lib/tax-workflows'
import type { TaxDeadline } from '@/store/useTaxStore'

export interface DeadlineDocument extends Omit<TaxDeadline, 'id'> { createdAt: unknown; updatedAt: unknown }
const deadlinesRef = (userId: string) => collection(db, deadlinesCollectionPath(userId))
const deadlineDocRef = (userId: string, deadlineId: string) => doc(db, deadlinesCollectionPath(userId), deadlineId)

export async function addDeadlineDocument(userId: string, input: ManualDeadlineInput): Promise<string> {
  const clean = normalizeDeadline(input)
  return (await addDoc(deadlinesRef(userId), { ...clean, status: 'upcoming', createdAt: serverTimestamp(), updatedAt: serverTimestamp() })).id
}

async function changeDeadline(userId: string, expected: TaxDeadline, changes: Record<string, unknown>) {
  await runTransaction(db, async tx => {
    const ref = deadlineDocRef(userId, expected.id)
    const snapshot = await tx.get(ref)
    if (!snapshot.exists()) throw Error('This obligation no longer exists.')
    const current = mapDeadlineDocument(snapshot.id, snapshot.data() as DeadlineDocument)
    for (const field of ['formType', 'title', 'dueDate', 'amountDue', 'status', 'taxPeriod', 'sourceUrl', 'notes', 'filingDate', 'filingReference', 'filingNotes', 'evidenceUrl'] as const) {
      if ((current[field] ?? '') !== (expected[field] ?? '')) throw Error('This obligation changed while you were editing. Cancel and reopen it to review the latest version.')
    }
    tx.update(ref, { ...changes, updatedAt: serverTimestamp() })
  })
}

export async function updateDeadlineDocument(userId: string, expected: TaxDeadline, input: ManualDeadlineInput): Promise<void> {
  await changeDeadline(userId, expected, { ...normalizeDeadline(input) })
}
export async function recordDeadlineFiling(userId: string, expected: TaxDeadline, evidence: FilingEvidence): Promise<void> {
  await changeDeadline(userId, expected, { ...normalizeFilingEvidence(evidence), status: 'filed' })
}
/** Reopening retains the previous filing evidence for review. */
export async function reopenDeadline(userId: string, expected: TaxDeadline): Promise<void> {
  await changeDeadline(userId, expected, { status: 'upcoming' })
}
function mapDeadlineDocument(id: string, data: DeadlineDocument): TaxDeadline {
  return { id, formType: data.formType, title: data.title, dueDate: data.dueDate, amountDue: data.amountDue, status: data.status,
    taxPeriod: data.taxPeriod || '', sourceUrl: data.sourceUrl || '', notes: data.notes || '',
    filingDate: data.filingDate || '', filingReference: data.filingReference || '', filingNotes: data.filingNotes || '', evidenceUrl: data.evidenceUrl || '' }
}
export function subscribeToDeadlines(userId: string, onData: (deadlines: TaxDeadline[]) => void, onError: (error: Error) => void): Unsubscribe {
  return onSnapshot(deadlinesRef(userId), snapshot => onData(snapshot.docs.map(row => mapDeadlineDocument(row.id, row.data() as DeadlineDocument))), onError)
}
