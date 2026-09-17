import type { DocumentReference, Transaction } from 'firebase-admin/firestore'
import { HttpsError } from 'firebase-functions/v2/https'
import type { Books } from './accounting-engine.js'

export type BankLedgerLock = { bankId: string; statementId: string; through: string }
export type BankLedgerLocks = { version: number; accounts: Record<string, BankLedgerLock> }

function protectedLines(books: Books, account: string, through: string) {
  return books.entries.filter(entry => entry.date <= through).flatMap(entry => entry.lines.flatMap((line, index) => line.account === account
    ? [{ id: entry.id, index, date: entry.date, reference: entry.reference, description: entry.description, source: entry.source, reversalOf: entry.reversalOf || '', debit: line.debit, credit: line.credit }]
    : [])).sort((a, b) => a.id.localeCompare(b.id) || a.index - b.index)
}

/** Call before ANY transaction writes, including payroll, assets and general accounting. */
export async function assertBankLedgerChangeAllowed(tx: Transaction, companyRef: DocumentReference, before: Books, after: Books): Promise<void> {
  const snapshot = await tx.get(companyRef.collection('bankControl').doc('locks'))
  if (!snapshot.exists) return
  const locks = snapshot.data() as BankLedgerLocks
  for (const [account, lock] of Object.entries(locks.accounts || {})) {
    const previous = before.accounts.find(row => row.code === account), next = after.accounts.find(row => row.code === account)
    if (!next || next.cash !== previous?.cash || next.type !== previous?.type
      || JSON.stringify(protectedLines(before, account, lock.through)) !== JSON.stringify(protectedLines(after, account, lock.through))) {
      throw new HttpsError('failed-precondition', `Bank account ${account} is reconciled through ${lock.through}. Reopen the latest affected bank reconciliation with a documented review before changing those books.`)
    }
  }
}
