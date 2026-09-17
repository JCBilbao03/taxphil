import type { Books, SettlementSupportingDocument } from './accounting.ts'
import type { BankStatement } from './bank-workflow.ts'

export type PaymentMethod = 'transfer' | 'check'
export type PaymentRequestInput = {
  invoiceId: string; bankId: string; amount: number; plannedDate: string
  method: PaymentMethod; checkNumber: string; reference: string; notes: string
  supportingDocuments: SettlementSupportingDocument[]
}
export type PaymentRequest = PaymentRequestInput & {
  id: string; version: number; status: 'pending' | 'approved' | 'released' | 'rejected' | 'cancelled'
  cashAccount: string; bankName: string; accountSuffix: string; payee: string; invoiceReference: string
  createdBy: string; createdAt: string; updatedBy: string; updatedAt: string
  approvedBy?: string; approvedAt?: string; reviewNote?: string
  releasedBy?: string; releasedAt?: string; releaseDate?: string; confirmationReference?: string
  settlementId?: string; entryId?: string; cashLineId?: string
}
export type PaymentClearanceLink = { statementId: string; version: number; reference: string; bankRowId: string; date: string; amount: number }
export type PaymentClearance = {
  state: 'not_released' | 'outstanding' | 'partially_cleared' | 'cleared' | 'reversed' | 'unavailable'
  releasedAmount: number; clearedAmount: number; outstandingAmount: number; links: PaymentClearanceLink[]
}
export type CompanyPaymentRequest =
  | { action: 'prepare'; requestId: string; input: PaymentRequestInput }
  | { action: 'approve' | 'reject' | 'cancel'; id: string; expectedVersion: number; note: string }
  | { action: 'release'; id: string; expectedVersion: number; expectedBooksRevision: number; releaseDate: string; confirmation: 'transfer_completed' | 'check_released'; confirmationReference: string; supportingDocuments: SettlementSupportingDocument[]; note: string }
  | { action: 'attachDocuments'; id: string; expectedVersion: number; supportingDocuments: SettlementSupportingDocument[]; note: string }
  | { action: 'getClearance'; id: string }

/** Derive from CURRENT approved statements, never historical snapshots or a cached cleared flag. */
export function paymentClearance(payment: PaymentRequest, books: Books, statements: BankStatement[]): PaymentClearance {
  const base: PaymentClearance = { state: 'not_released', releasedAmount: 0, clearedAmount: 0, outstandingAmount: 0, links: [] }
  if (payment.status !== 'released') return base
  const entry = books.entries.find(row => row.id === payment.entryId)
  const settlement = books.settlements.find(row => row.id === payment.settlementId)
  const lineIndex = entry?.lines.findIndex(line => line.account === payment.cashAccount && line.credit === payment.amount && line.debit === 0) ?? -1
  if (!entry || !settlement || settlement.entryId !== entry.id || settlement.invoiceId !== payment.invoiceId || settlement.amount !== payment.amount || lineIndex < 0 || `${entry.id}:${lineIndex}` !== payment.cashLineId) return { ...base, state: 'unavailable' }
  if (books.entries.some(row => row.source === 'reversal' && row.reversalOf === entry.id)) return { ...base, state: 'reversed', releasedAmount: payment.amount }
  const links: PaymentClearanceLink[] = []
  const seen = new Set<string>()
  for (const statement of statements) {
    if (statement.status !== 'approved' || statement.bankId !== payment.bankId || seen.has(statement.id)) continue
    seen.add(statement.id)
    for (const allocation of statement.allocations) {
      if (allocation.bookLineId !== payment.cashLineId || !Number.isSafeInteger(allocation.amount) || allocation.amount <= 0) continue
      const row = statement.rows.find(row => row.id === allocation.bankRowId)
      if (row?.date) links.push({ statementId: statement.id, version: statement.version, reference: statement.reference, bankRowId: row.id, date: row.date, amount: allocation.amount })
    }
  }
  const clearedAmount = links.reduce((total, link) => total + link.amount, 0)
  if (!Number.isSafeInteger(clearedAmount) || clearedAmount > payment.amount) return { ...base, state: 'unavailable', releasedAmount: payment.amount }
  return { state: clearedAmount === payment.amount ? 'cleared' : clearedAmount > 0 ? 'partially_cleared' : 'outstanding', releasedAmount: payment.amount, clearedAmount, outstandingAmount: payment.amount - clearedAmount, links }
}
