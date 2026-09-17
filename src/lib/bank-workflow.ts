import type { BankAccount, BankAllocation, BankBookLine, BankStatementRow } from './bank-reconciliation.ts'

export const BANK_WORKFLOW_LIMITS = Object.freeze({ rows: 400, statementBytes: 650_000, accounts: 50, allocations: 1000, fileBytes: 10 * 1024 * 1024 })
export type BankAccountRecord = BankAccount & { version: number; createdBy: string; createdAt: string; updatedBy: string; updatedAt: string }
export type BankStatementFile = {
  path: string; name: string; size: number; sha256: string
  type: 'text/csv' | 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' | 'application/pdf'
  generation?: string
}
export type BankStatementInput = {
  reference: string; from: string; to: string; openingBalance: number | null; closingBalance: number | null
  order: 'ascending' | 'descending'; rows: BankStatementRow[]
  openingReviewed: boolean; openingOutstandingLineIds: string[]
}
export type BankReconciliationReport = {
  asOf: string; booksRevision: number; booksFingerprint: string
  bankBalance: number; bookBalance: number; outstandingDeposits: number; outstandingPayments: number
  adjustedBankBalance: number; difference: number; unmatchedBankRowIds: string[]
  outstandingBookLines: (BankBookLine & { remaining: number })[]
  openingBookBalance: number; openingOutstandingAmount: number; openingDifference: number
}
export type BankStatement = BankStatementInput & {
  id: string; bankId: string; version: number; status: 'draft' | 'prepared' | 'approved'
  allocations: BankAllocation[]; file: BankStatementFile
  createdBy: string; createdAt: string; updatedBy: string; updatedAt: string
  preparedBy?: string; preparedAt?: string; preparedBooksRevision?: number; preparedBooksFingerprint?: string
  approvedBy?: string; approvedAt?: string; reviewNote?: string; report?: BankReconciliationReport
  importedRowIds: string[]
}
export type BankAdjustment = {
  id: string; statementId: string; bankRowId: string; version: number; status: 'pending' | 'approved' | 'rejected'
  date: string; reference: string; description: string; offsetAccount: string; amount: number
  createdBy: string; createdAt: string; approvedBy?: string; approvedAt?: string; reviewNote?: string; entryId?: string
}

/** API request contract. The callable always derives company identity from membership. */
export type CompanyBankRequest =
  | { action: 'saveAccount'; id?: string; expectedVersion: number; value: Omit<BankAccount, 'id'> }
  | { action: 'importStatement'; bankId: string; file: BankStatementFile; input: BankStatementInput; reviewNote: string }
  | { action: 'saveStatement'; id: string; expectedVersion: number; input: BankStatementInput; reviewNote: string }
  | { action: 'saveMatches'; id: string; expectedVersion: number; allocations: BankAllocation[] }
  | { action: 'prepare'; id: string; expectedVersion: number; note: string }
  | { action: 'approve'; id: string; expectedVersion: number; expectedBooksRevision: number; note: string }
  | { action: 'reopen'; id: string; expectedVersion: number; note: string }
  | { action: 'prepareAdjustment'; statementId: string; expectedVersion: number; input: { bankRowId: string; date: string; reference: string; description: string; offsetAccount: string } }
  | { action: 'approveAdjustment'; id: string; expectedVersion: number; expectedBooksRevision: number; note: string }
  | { action: 'rejectAdjustment'; id: string; expectedVersion: number; note: string }
