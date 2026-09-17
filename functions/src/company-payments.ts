import { createHash } from 'node:crypto'
import { getFirestore, type DocumentReference, type Transaction } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { companyIdentity, companyContext, companyRequireRole, companyAudit } from './company-accounting.js'
import { appendSettlementDocuments, outstanding, settle, today, type Books, type SettlementSupportingDocument } from './accounting-engine.js'
import { validBankDate, validateBankAccount } from './bank-reconciliation.js'
import { assertBankLedgerChangeAllowed } from './bank-locks.js'
import { settlementDocumentsValue, verifySettlementDocuments } from './settlement-storage.js'
import { paymentClearance, type PaymentRequest, type PaymentRequestInput } from './payment-workflow.js'
import { reservedPaymentAmount, type PaymentReservations } from './payment-reservations.js'
import type { BankAccountRecord, BankStatement } from './bank-workflow.js'

type Input = Record<string, unknown>
type StoredPayment = PaymentRequest & { inputHash: string }
const now = () => new Date().toISOString()
const fail = (message: string): never => { throw new HttpsError('invalid-argument', message) }
const object = (value: unknown): Input => { if (!value || typeof value !== 'object' || Array.isArray(value)) return fail('Supply a valid payment request.'); return value as Input }
const text = (value: unknown, label: string, max = 200, optional = false) => { if (optional && (value === undefined || value === '')) return ''; if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u001f\u007f]/.test(value)) return fail(`Enter a valid ${label}.`); return value.trim() }
const id = (value: unknown) => { const result = text(value, 'record ID', 128); if (!/^[A-Za-z0-9_-]+$/.test(result)) return fail('Invalid record ID.'); return result }
const version = (value: unknown) => { if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) return fail('Supply the current record version.'); return value }
const note = (value: unknown) => { if (typeof value !== 'string' || value.trim().length < 10 || value.length > 3000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) return fail('Describe the review or actual release using 10–3,000 characters.'); return value.trim() }
const clean = <T>(fn: () => T): T => { try { return fn() } catch (error) { if (error instanceof HttpsError) throw error; return fail(error instanceof Error ? error.message : 'Invalid payment data.') } }
const sha = (value: string) => createHash('sha256').update(value).digest('hex')
const isReviewer = (role: string) => role === 'admin' || role === 'manager'
const expected = (value: unknown, current: number) => { if (version(value) !== current) throw new HttpsError('aborted', 'Payment records changed. Reload before continuing.') }
function inputValue(value: unknown, companyId: string): PaymentRequestInput {
  const data = object(value), method = data.method
  if (!['transfer', 'check'].includes(String(method))) return fail('Choose bank transfer or check.')
  if (!Number.isSafeInteger(data.amount) || Number(data.amount) <= 0 || Number(data.amount) > 1e12) return fail('Enter a positive payment amount in centavos.')
  if (!validBankDate(data.plannedDate)) return fail('Choose a valid planned payment date.')
  const checkNumber = text(data.checkNumber, 'check number', 40, method !== 'check').toUpperCase().replace(/\s+/g, '')
  if ((method === 'check' && !/^[A-Z0-9-]{1,40}$/.test(checkNumber)) || (method !== 'check' && checkNumber)) return fail('Enter a check number only for check payments, using letters, numbers and hyphens.')
  return { invoiceId: id(data.invoiceId), bankId: id(data.bankId), amount: Number(data.amount), plannedDate: data.plannedDate, method: method as PaymentRequestInput['method'], checkNumber, reference: text(data.reference, 'unique payment reference'), notes: note(data.notes), supportingDocuments: settlementDocumentsValue(data.supportingDocuments, 'payable', companyId) }
}
function mergedDocuments(previous: SettlementSupportingDocument[], incoming: unknown, companyId: string) {
  const result = new Map(previous.map(file => [file.path, file]))
  for (const file of settlementDocumentsValue(incoming, 'payable', companyId)) {
    const saved = result.get(file.path)
    if (saved && JSON.stringify(saved) !== JSON.stringify(file)) return fail('An existing document cannot be renamed or recategorized. Attach the correct original.')
    result.set(file.path, file)
  }
  return settlementDocumentsValue([...result.values()], 'payable', companyId)
}
function validateCurrent(payment: PaymentRequestInput & { cashAccount?: string }, bank: BankAccountRecord, books: Books, control: PaymentReservations, excludingId?: string) {
  if (!bank.active) throw new HttpsError('failed-precondition', 'Reactivate this bank account before preparing, approving or releasing payments.')
  clean(() => validateBankAccount(bank, books.accounts))
  if (payment.cashAccount && payment.cashAccount !== bank.accountCode) throw new HttpsError('failed-precondition', 'The approved bank account changed. Cancel and prepare a fresh request.')
  const invoice = books.invoices.find(row => row.id === payment.invoiceId)
  if (!invoice || invoice.kind !== 'payable') throw new HttpsError('failed-precondition', 'Choose an existing supplier bill from this company.')
  if (payment.plannedDate < invoice.date) return fail('The planned payment date cannot precede the supplier bill.')
  if (payment.amount > outstanding(books, invoice) - reservedPaymentAmount(control, excludingId)) throw new HttpsError('failed-precondition', 'The bill balance is already paid or reserved by another payment request.')
  if (books.entries.some(entry => entry.reference.toLowerCase() === payment.reference.toLowerCase())) throw new HttpsError('already-exists', 'The payment reference is already used in the ledger.')
  return invoice
}
function saveVersion(tx: Transaction, companyRef: DocumentReference, payment: StoredPayment, action: string) {
  if (Buffer.byteLength(JSON.stringify(payment), 'utf8') > 100_000) throw new HttpsError('resource-exhausted', 'The payment request exceeds this release’s storage capacity.')
  tx.set(companyRef.collection('paymentRequests').doc(payment.id), payment)
  tx.create(companyRef.collection('paymentRequestVersions').doc(`${payment.id}-${payment.version}`), { ...payment, requestId: payment.id, changeAction: action })
}
function checkedBooks(books: Books) {
  if (Buffer.byteLength(JSON.stringify(books), 'utf8') > 650_000 || books.entries.length > 2000 || books.accounts.length > 500) throw new HttpsError('resource-exhausted', 'Company books have reached this release’s capacity. No payment was posted.')
}

export const companyPayments = onCall({ region: 'asia-southeast1', timeoutSeconds: 60, maxInstances: 20 }, async request => {
  const actor = await companyIdentity(request), data = object(request.data), action = text(data.action, 'payment action', 30)
  if (!['prepare', 'approve', 'reject', 'cancel', 'release', 'attachDocuments', 'getClearance'].includes(action)) return fail('Choose a supported payment action.')
  return getFirestore().runTransaction(async tx => {
    const { companyRef, member } = await companyContext(tx, actor)
    companyRequireRole(member, ['admin', 'manager', 'accountant'])
    if (['approve', 'reject', 'release'].includes(action)) companyRequireRole(member, ['admin', 'manager'])
    const paymentId = id(action === 'prepare' ? data.requestId : data.id), paymentRef = companyRef.collection('paymentRequests').doc(paymentId)
    if (action === 'prepare' && !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(paymentId)) return fail('Start a payment request with a fresh UUID retry key.')
    const booksRef = companyRef.collection('accounting').doc('books')
    const [paymentSnapshot, booksSnapshot] = await tx.getAll(paymentRef, booksRef)
    if (!booksSnapshot.exists) throw new HttpsError('failed-precondition', 'Company books are unavailable.')
    const books = booksSnapshot.get('books') as Books, booksRevision = booksSnapshot.get('revision') as number
    const previous = paymentSnapshot.exists ? paymentSnapshot.data() as StoredPayment : undefined
    if (action !== 'prepare' && !previous) throw new HttpsError('not-found', 'Payment request not found in this company.')
    const input = action === 'prepare' ? inputValue(data.input, companyRef.id) : previous!
    if (action === 'prepare' && previous) {
      if (previous.createdBy !== actor.uid || previous.inputHash !== sha(JSON.stringify(input))) throw new HttpsError('already-exists', 'This request ID already belongs to a different payment. Start a new request.')
      return { id: previous.id, version: previous.version, status: previous.status, alreadyPrepared: true }
    }
    if (action === 'getClearance') {
      const snapshots = await tx.get(companyRef.collection('bankStatements').where('bankId', '==', previous!.bankId))
      return paymentClearance(previous!, books, snapshots.docs.map(row => row.data() as BankStatement))
    }
    if (action === 'release' && previous!.status === 'released') return { id: previous!.id, version: previous!.version, status: 'released', alreadyReleased: true, settlementId: previous!.settlementId, entryId: previous!.entryId, revision: booksRevision }
    if (previous) expected(data.expectedVersion, previous.version)
    const controlRef = companyRef.collection('paymentControl').doc(`invoice-${input.invoiceId}`)
    const bankRef = companyRef.collection('bankAccounts').doc(input.bankId)
    const [controlSnapshot, bankSnapshot] = await tx.getAll(controlRef, bankRef)
    const control: PaymentReservations = controlSnapshot.exists ? controlSnapshot.data() as PaymentReservations : { version: 0, invoiceId: input.invoiceId, requests: {} }
    const nextControl = { ...control, version: control.version + 1, requests: { ...control.requests } }
    const timestamp = now()
    if (action === 'prepare') {
      if (!bankSnapshot.exists) throw new HttpsError('not-found', 'Choose a company bank account.')
      const bank = bankSnapshot.data() as BankAccountRecord, invoice = validateCurrent(input, bank, books, control)
      if (Object.keys(control.requests).length >= 100) throw new HttpsError('resource-exhausted', 'Review the existing payment requests for this bill before preparing more.')
      const checkRef = input.method === 'check' ? companyRef.collection('paymentControl').doc(`check-${sha(`${input.bankId}:${input.checkNumber}`)}`) : undefined
      if (checkRef && (await tx.get(checkRef)).exists) throw new HttpsError('already-exists', 'That check number is already used or reserved for this bank account, including cancelled requests. Use a different check number.')
      await verifySettlementDocuments({ type: 'settle', input: { invoiceId: input.invoiceId, supportingDocuments: input.supportingDocuments } }, books, companyRef.id)
      const payment: StoredPayment = { ...input, id: paymentId, version: 1, status: 'pending', cashAccount: bank.accountCode, bankName: bank.bankName, accountSuffix: bank.accountSuffix, payee: invoice.party, invoiceReference: invoice.reference, createdBy: actor.uid, createdAt: timestamp, updatedBy: actor.uid, updatedAt: timestamp, inputHash: sha(JSON.stringify(input)) }
      nextControl.requests[paymentId] = input.amount
      tx.set(controlRef, nextControl)
      if (checkRef) tx.create(checkRef, { requestId: paymentId, bankId: input.bankId, checkNumber: input.checkNumber, createdAt: timestamp })
      saveVersion(tx, companyRef, payment, action)
      companyAudit(tx, companyRef, actor, 'payment.prepare', `Prepared payment ${payment.reference} for ${payment.payee}; no cash posted.`, { requestId: payment.id, amount: payment.amount, invoiceId: payment.invoiceId })
      return { id: payment.id, version: payment.version, status: payment.status }
    }
    const payment = previous!, reviewNote = note(data.note)
    let next: StoredPayment = { ...payment, version: payment.version + 1, updatedBy: actor.uid, updatedAt: timestamp, reviewNote }
    if (action === 'approve') {
      if (payment.status !== 'pending') throw new HttpsError('failed-precondition', 'Only pending payment requests can be approved.')
      if (payment.createdBy === actor.uid) throw new HttpsError('permission-denied', 'Another manager or administrator must independently approve this payment.')
      if (!bankSnapshot.exists) throw new HttpsError('not-found', 'The approved bank account is unavailable.')
      validateCurrent(payment, bankSnapshot.data() as BankAccountRecord, books, control, payment.id)
      await verifySettlementDocuments({ type: 'settle', input: { invoiceId: payment.invoiceId, supportingDocuments: payment.supportingDocuments } }, books, companyRef.id)
      next = { ...next, status: 'approved', approvedBy: actor.uid, approvedAt: timestamp }
    } else if (action === 'reject' || action === 'cancel') {
      if ((action === 'reject' && payment.status !== 'pending') || !['pending', 'approved'].includes(payment.status)) throw new HttpsError('failed-precondition', 'Only pending or approved requests can be cancelled; released payments require an auditable ledger reversal.')
      if (action === 'cancel' && (!isReviewer(member.role) && (payment.status !== 'pending' || payment.createdBy !== actor.uid))) throw new HttpsError('permission-denied', 'Only the preparer may cancel their pending request. A manager must cancel approved requests.')
      next.status = action === 'reject' ? 'rejected' : 'cancelled'
      delete nextControl.requests[payment.id]
      tx.set(controlRef, nextControl)
    } else if (action === 'release') {
      if (payment.status !== 'approved' || !payment.approvedBy || payment.approvedBy === payment.createdBy) throw new HttpsError('failed-precondition', 'An independent approval is required before release.')
      expected(data.expectedBooksRevision, booksRevision)
      if (!validBankDate(data.releaseDate) || data.releaseDate > today()) return fail('Enter the actual completed payment date, no later than today.')
      if (data.confirmation !== (payment.method === 'check' ? 'check_released' : 'transfer_completed')) return fail('Explicitly confirm that the transfer completed or that the check was released to the payee. A prepared check is not a payment.')
      const confirmationReference = text(data.confirmationReference, 'actual transfer or check-release reference')
      if (!bankSnapshot.exists) throw new HttpsError('not-found', 'The payment bank account is unavailable.')
      validateCurrent(payment, bankSnapshot.data() as BankAccountRecord, books, control, payment.id)
      const documents = mergedDocuments(payment.supportingDocuments, data.supportingDocuments, companyRef.id)
      if (!documents.some(file => file.kind === (payment.method === 'check' ? 'check_copy' : 'transfer_confirmation'))) return fail(payment.method === 'check' ? 'Attach the released check copy and document delivery to the payee in the release note.' : 'Attach the completed bank transfer confirmation.')
      await verifySettlementDocuments({ type: 'settle', input: { invoiceId: payment.invoiceId, supportingDocuments: documents } }, books, companyRef.id)
      const updatedBooks = clean(() => settle(books, payment.invoiceId, payment.amount, data.releaseDate as string, payment.cashAccount, payment.reference, documents))
      checkedBooks(updatedBooks)
      await assertBankLedgerChangeAllowed(tx, companyRef, books, updatedBooks)
      const settlement = updatedBooks.settlements.at(-1)!, entry = updatedBooks.entries.at(-1)!, index = entry.lines.findIndex(line => line.account === payment.cashAccount && line.credit === payment.amount)
      if (index < 0) throw new HttpsError('internal', 'The released payment cash line could not be identified.')
      next = { ...next, status: 'released', releasedBy: actor.uid, releasedAt: timestamp, releaseDate: data.releaseDate as string, confirmationReference, supportingDocuments: documents, settlementId: settlement.id, entryId: entry.id, cashLineId: `${entry.id}:${index}` }
      delete nextControl.requests[payment.id]
      tx.set(controlRef, nextControl)
      tx.update(booksRef, { books: updatedBooks, revision: booksRevision + 1, updatedAt: timestamp })
    } else if (action === 'attachDocuments') {
      if (!['pending', 'approved', 'released'].includes(payment.status)) throw new HttpsError('failed-precondition', 'This request is already closed.')
      if (!isReviewer(member.role) && (payment.status !== 'pending' || payment.createdBy !== actor.uid)) throw new HttpsError('permission-denied', 'A manager must attach evidence to an approved or released request.')
      const documents = mergedDocuments(payment.supportingDocuments, data.supportingDocuments, companyRef.id)
      if (documents.length === payment.supportingDocuments.length) return fail('Attach at least one new document.')
      await verifySettlementDocuments({ type: 'settle', input: { invoiceId: payment.invoiceId, supportingDocuments: documents } }, books, companyRef.id)
      if (payment.status === 'released') {
        const savedSettlement = books.settlements.find(row => row.id === payment.settlementId)
        if (!savedSettlement) throw new HttpsError('failed-precondition', 'The original released settlement is unavailable.')
        const existingPaths = new Set((savedSettlement.supportingDocuments || []).map(file => file.path)), additions = documents.filter(file => !existingPaths.has(file.path))
        if (additions.length) {
          const updatedBooks = clean(() => appendSettlementDocuments(books, payment.settlementId!, additions))
          checkedBooks(updatedBooks)
          await assertBankLedgerChangeAllowed(tx, companyRef, books, updatedBooks)
          tx.update(booksRef, { books: updatedBooks, revision: booksRevision + 1, updatedAt: timestamp })
        }
      }
      next.supportingDocuments = documents
    }
    saveVersion(tx, companyRef, next, action)
    companyAudit(tx, companyRef, actor, `payment.${action}`, `${action === 'release' ? 'Recorded completed payment' : 'Reviewed payment request'} ${payment.reference}.`, { requestId: payment.id, version: next.version, status: next.status, reviewNote, ...(next.entryId ? { entryId: next.entryId, settlementId: next.settlementId } : {}) })
    return { id: next.id, version: next.version, status: next.status, ...(next.settlementId ? { settlementId: next.settlementId, entryId: next.entryId } : {}), ...(action === 'release' ? { revision: booksRevision + 1 } : {}) }
  })
})
