import { createHash, randomUUID } from 'node:crypto'
import { getFirestore, type DocumentReference, type Transaction } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { companyIdentity, companyContext, companyRequireRole, companyAudit } from './company-accounting.js'
import { post, type Books } from './accounting-engine.js'
import { assertBankLedgerChangeAllowed, type BankLedgerLocks } from './bank-locks.js'
import { bankLedgerLines, bankRowFingerprint, findBankDuplicateCandidates, validateBankAccount, validateBankMatch, validateStatementBalances, validateStatementRows, validBankDate, validBankMoney, type BankAllocation, type BankStatementRow } from './bank-reconciliation.js'
import { BANK_WORKFLOW_LIMITS, type BankAccountRecord, type BankAdjustment, type BankReconciliationReport, type BankStatement, type BankStatementFile, type BankStatementInput } from './bank-workflow.js'

type Input = Record<string, unknown>
type BankControl = { version: number; bankId: string; accountCode: string; approved: { id: string; from: string; to: string; version: number }[]; bookUsed: Record<string, number>; pendingReservations?: Record<string, Record<string, number>>; baselineStatementId?: string; baselineBookUsed?: Record<string, number> }
const now = () => new Date().toISOString()
const fail = (message: string): never => { throw new HttpsError('invalid-argument', message) }
const object = (value: unknown): Input => { if (!value || typeof value !== 'object' || Array.isArray(value)) return fail('A valid bank request is required.'); return value as Input }
const text = (value: unknown, label: string, max = 200) => { if (typeof value !== 'string' || !value.trim() || value.length > max) return fail(`Enter a valid ${label}.`); return value.trim() }
const id = (value: unknown) => { const result = text(value, 'record ID', 128); if (!/^[A-Za-z0-9_-]+$/.test(result)) return fail('Invalid record ID.'); return result }
const version = (value: unknown) => { if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) return fail('Supply the current record version.'); return value }
const note = (value: unknown) => { const result = text(value, 'review note', 3000); if (result.length < 10) return fail('Document the review using at least 10 characters.'); return result }
const clean = <T>(fn: () => T): T => { try { return fn() } catch (error) { if (error instanceof HttpsError) throw error; return fail(error instanceof Error ? error.message : 'Invalid bank data.') } }
const sha = (value: string | Buffer) => createHash('sha256').update(value).digest('hex')
const sumMoney = (values: number[]) => { const result = values.reduce((sum, value) => sum + value, 0); if (!Number.isSafeInteger(result)) return fail('A reconciliation total exceeds the safe centavo range.'); return result }
const sized = (value: unknown, label: string, limit = BANK_WORKFLOW_LIMITS.statementBytes) => { if (Buffer.byteLength(JSON.stringify(value), 'utf8') > limit) throw new HttpsError('resource-exhausted', `${label} exceeds this release’s storage capacity. Use a smaller statement period; no records were truncated.`) }
function matchingVersion(expected: unknown, actual: number) { if (version(expected) !== actual) throw new HttpsError('aborted', 'The bank records changed. Reload before saving or reviewing.') }

function statementInput(value: unknown): BankStatementInput {
  const data = object(value)
  if (!validBankDate(data.from) || !validBankDate(data.to) || data.from > data.to) return fail('Choose a valid statement period.')
  if (!['ascending', 'descending'].includes(String(data.order))) return fail('Choose the transaction ordering.')
  if (![data.openingBalance, data.closingBalance].every(value => value === null || validBankMoney(value))) return fail('Use signed centavos for statement balances, or leave them unresolved.')
  if (typeof data.openingReviewed !== 'boolean' || !Array.isArray(data.openingOutstandingLineIds) || data.openingOutstandingLineIds.length > 2000 || new Set(data.openingOutstandingLineIds).size !== data.openingOutstandingLineIds.length || data.openingOutstandingLineIds.some(value => typeof value !== 'string' || !/^[A-Za-z0-9_-]+:\d+$/.test(value))) return fail('Review the opening balance and its outstanding ledger lines.')
  const rows = clean(() => validateStatementRows(data.rows, { allowUnresolved: true }))
  if (rows.length > BANK_WORKFLOW_LIMITS.rows) throw new HttpsError('resource-exhausted', 'This release supports up to 400 rows per statement. Export a shorter statement period; no rows were truncated.')
  const result: BankStatementInput = { reference: text(data.reference, 'statement reference'), from: data.from, to: data.to, openingBalance: data.openingBalance as number | null, closingBalance: data.closingBalance as number | null, order: data.order as BankStatementInput['order'], rows, openingReviewed: data.openingReviewed, openingOutstandingLineIds: data.openingOutstandingLineIds as string[] }
  sized(result, 'Statement'); return result
}
function fileValue(value: unknown, companyId: string): BankStatementFile {
  const data = object(value), path = text(data.path, 'statement file path', 400), name = text(data.name, 'statement filename', 200)
  if (!new RegExp(`^companies/${companyId}/bank-statements/[A-Za-z0-9_-]{1,128}$`).test(path)) return fail('The bank statement must belong to this company.')
  const extensions: Record<string, string> = { 'text/csv': 'csv', 'application/pdf': 'pdf', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx' }
  const type = String(data.type)
  if (!extensions[type] || !new RegExp(`\\.${extensions[type]}$`, 'i').test(name) || /[/\\\u0000-\u001f\u007f]/.test(name) || !Number.isSafeInteger(data.size) || Number(data.size) < 1 || Number(data.size) > BANK_WORKFLOW_LIMITS.fileBytes || typeof data.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(data.sha256)) return fail('Choose a valid CSV, XLSX or PDF bank statement no larger than 10 MB with its content checksum.')
  return { path, name, size: Number(data.size), type: type as BankStatementFile['type'], sha256: data.sha256, ...(data.generation ? { generation: text(data.generation, 'file generation', 100) } : {}) }
}
async function verifyFile(value: BankStatementFile, download: boolean): Promise<BankStatementFile> {
  try {
    const bucket = getStorage().bucket(), source = bucket.file(value.path), [metadata] = await source.getMetadata()
    if (metadata.name !== value.path || metadata.contentType !== value.type || Number(metadata.size) !== value.size || !metadata.generation || (value.generation && String(metadata.generation) !== value.generation)) throw Error('Stored file metadata changed.')
    if (download) {
      const [bytes] = await bucket.file(value.path, { generation: metadata.generation }).download({ validation: 'crc32c' })
      if (bytes.length !== value.size || bytes.length > BANK_WORKFLOW_LIMITS.fileBytes || sha(bytes) !== value.sha256) throw Error('Stored file bytes do not match the import.')
      if (value.type === 'application/pdf' && bytes.subarray(0, 5).toString() !== '%PDF-') throw Error('Invalid PDF signature.')
      if (value.type.includes('spreadsheetml') && !bytes.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 3, 4]))) throw Error('Invalid workbook signature.')
      if (value.type === 'text/csv') { if (bytes.includes(0)) throw Error('Invalid CSV encoding.'); new TextDecoder('utf-8', { fatal: true }).decode(bytes) }
    }
    return { ...value, generation: String(metadata.generation) }
  } catch { throw new HttpsError('failed-precondition', 'The original bank statement could not be verified. Check the uploaded file and storage access, then retry.') }
}
const emptyControl = (bank: BankAccountRecord): BankControl => ({ version: 0, bankId: bank.id, accountCode: bank.accountCode, approved: [], bookUsed: {} })
const nextDay = (date: string) => new Date(Date.parse(date) + 86400000).toISOString().slice(0, 10)
function allocationInput(value: unknown): BankAllocation[] {
  if (!Array.isArray(value) || value.length > BANK_WORKFLOW_LIMITS.allocations) return fail('Use at most 1,000 statement match allocations.')
  return value.map(item => { const row = object(item); if (typeof row.bankRowId !== 'string' || typeof row.bookLineId !== 'string' || !validBankMoney(row.amount) || row.amount <= 0) return fail('Enter valid bank match allocations.'); return { bankRowId: row.bankRowId, bookLineId: row.bookLineId, amount: row.amount } })
}

function bankState(statement: BankStatementInput & { id: string; allocations: BankAllocation[] }, bank: BankAccountRecord, books: Books, control: BankControl) {
  const lines = clean(() => bankLedgerLines(books, bank.accountCode, statement.to)), byId = new Map(lines.map(line => [line.id, line]))
  const used = { ...control.bookUsed }, baseline: Record<string, number> = {}
  const openingLines = lines.filter(line => line.date < statement.from)
  const openingBookBalance = sumMoney(openingLines.map(line => line.amount))
  let openingOutstandingAmount = 0
  if (!control.approved.length) {
    const outstanding = new Set(statement.openingOutstandingLineIds)
    for (const key of outstanding) if (!openingLines.some(line => line.id === key)) return fail('Opening outstanding items must be existing bank ledger lines before the statement period.')
    for (const line of openingLines) {
      if (outstanding.has(line.id)) openingOutstandingAmount = sumMoney([openingOutstandingAmount, line.amount])
      else { baseline[line.id] = Math.abs(line.amount); used[line.id] = Math.abs(line.amount) }
    }
  } else {
    if (statement.openingOutstandingLineIds.length) return fail('Later reconciliations carry their opening outstanding items from approved history.')
    openingOutstandingAmount = sumMoney(openingLines.map(line => Math.sign(line.amount) * (Math.abs(line.amount) - (used[line.id] || 0))))
  }
  for (const [key, amount] of Object.entries(used)) {
    const line = byId.get(key)
    if (!line || !Number.isSafeInteger(amount) || amount < 0 || amount > Math.abs(line.amount)) throw new HttpsError('failed-precondition', 'An approved bank allocation no longer agrees with the ledger. Review and reopen the affected reconciliation.')
  }
  const available = lines.flatMap(line => {
    const remainder = Math.abs(line.amount) - (used[line.id] || 0)
    return remainder ? [{ ...line, amount: Math.sign(line.amount) * remainder }] : []
  })
  // Draft/prepared statements reserve magnitude without claiming bank clearance.
  // Reports below still use only approved allocations plus this statement.
  const reserved: Record<string, number> = {}
  for (const [statementId, allocation] of Object.entries(control.pendingReservations || {})) {
    if (statementId === statement.id) continue
    for (const [lineId, amount] of Object.entries(allocation)) {
      if (!Number.isSafeInteger(amount) || amount <= 0) throw new HttpsError('failed-precondition', 'A pending bank match reservation needs review.')
      reserved[lineId] = sumMoney([reserved[lineId] || 0, amount])
    }
  }
  for (const allocation of statement.allocations) reserved[allocation.bookLineId] = sumMoney([reserved[allocation.bookLineId] || 0, allocation.amount])
  for (const line of lines) if ((reserved[line.id] || 0) + (used[line.id] || 0) > Math.abs(line.amount)) throw new HttpsError('failed-precondition', 'A ledger amount is reserved by another draft/prepared statement or already reconciled. Clear the conflicting draft match before using it again.')
  const match = statement.allocations.length ? clean(() => validateBankMatch({ bankRows: statement.rows, bookLines: available, allocations: statement.allocations.slice(0, 100), existingAllocations: statement.allocations.slice(100) })) : null
  const bankRemaining = match?.bankRemaining || Object.fromEntries(statement.rows.map(row => [row.id, row.amount]))
  const remainingLines = available.map(line => ({ ...line, remaining: match ? match.bookRemaining[line.id] : line.amount })).filter(line => line.remaining !== 0)
  return { lines, available, baseline, used, bankRemaining, remainingLines, openingBookBalance, openingOutstandingAmount }
}
function reserveStatement(control: BankControl, statementId: string, allocations: BankAllocation[]): BankControl {
  const pendingReservations = { ...(control.pendingReservations || {}) }
  const amounts: Record<string, number> = {}
  for (const allocation of allocations) amounts[allocation.bookLineId] = sumMoney([amounts[allocation.bookLineId] || 0, allocation.amount])
  if (allocations.length) pendingReservations[statementId] = amounts; else delete pendingReservations[statementId]
  const updated = { ...control, version: control.version + 1, pendingReservations }
  sized(updated, 'Bank match reservations'); return updated
}
function reportFor(statement: BankStatement, bank: BankAccountRecord, books: Books, booksRevision: number, control: BankControl): BankReconciliationReport {
  const check = clean(() => validateStatementBalances(statement))
  if (!check.valid) throw new HttpsError('failed-precondition', check.issues.map(issue => issue.message).slice(0, 5).join(' '))
  const last = control.approved.at(-1)
  if (last && statement.from !== nextDay(last.to)) throw new HttpsError('failed-precondition', `The next statement must start on ${nextDay(last.to)} so approved periods do not overlap or leave gaps.`)
  if (!statement.openingReviewed) throw new HttpsError('failed-precondition', 'Review the statement opening balance and outstanding items first.')
  const state = bankState(statement, bank, books, control)
  const bookBalance = sumMoney(state.lines.map(line => line.amount))
  const outstandingDeposits = sumMoney(state.remainingLines.filter(line => line.remaining > 0).map(line => line.remaining))
  const outstandingPayments = Math.abs(sumMoney(state.remainingLines.filter(line => line.remaining < 0).map(line => line.remaining)))
  const adjustedBankBalance = sumMoney([statement.closingBalance!, outstandingDeposits, -outstandingPayments])
  const openingDifference = sumMoney([state.openingBookBalance, -state.openingOutstandingAmount, -statement.openingBalance!])
  const unmatchedBankRowIds = statement.rows.filter(row => state.bankRemaining[row.id] !== 0).map(row => row.id)
  const report: BankReconciliationReport = { asOf: statement.to, booksRevision, booksFingerprint: sha(JSON.stringify(state.lines)), bankBalance: statement.closingBalance!, bookBalance, outstandingDeposits, outstandingPayments, adjustedBankBalance, difference: sumMoney([bookBalance, -adjustedBankBalance]), unmatchedBankRowIds, outstandingBookLines: state.remainingLines, openingBookBalance: state.openingBookBalance, openingOutstandingAmount: state.openingOutstandingAmount, openingDifference }
  if (report.openingDifference !== 0 || report.difference !== 0 || unmatchedBankRowIds.length) throw new HttpsError('failed-precondition', 'Resolve unmatched bank rows and reconcile opening/closing balances to zero difference before preparing or approving.')
  return report
}
function draftVersion(statement: BankStatement): BankStatement {
  const next = { ...statement, status: 'draft' as const }
  for (const key of ['preparedBy', 'preparedAt', 'preparedBooksRevision', 'preparedBooksFingerprint', 'approvedBy', 'approvedAt', 'report'] as const) delete next[key]
  return next
}
function saveVersion(tx: Transaction, companyRef: DocumentReference, statement: BankStatement) {
  sized(statement, 'Statement')
  tx.set(companyRef.collection('bankStatements').doc(statement.id), statement)
  tx.create(companyRef.collection('bankStatementVersions').doc(`${statement.id}-${statement.version}`), statement)
}
async function duplicateIndexes(tx: Transaction, companyRef: DocumentReference, bankId: string, rows: BankStatementRow[]) {
  const keys = [...new Set(rows.map(bankRowFingerprint).filter((value): value is string => !!value))]
  const refs = keys.map(key => companyRef.collection('bankRowIndex').doc(sha(`${bankId}:${key}`)))
  const snapshots = refs.length ? await tx.getAll(...refs) : []
  return { keys, refs, snapshots }
}

export const companyBank = onCall({ region: 'asia-southeast1', timeoutSeconds: 120, maxInstances: 20 }, async request => {
  const actor = await companyIdentity(request), data = object(request.data), action = String(data.action)
  if (!['saveAccount', 'importStatement', 'saveStatement', 'saveMatches', 'prepare', 'approve', 'reopen', 'prepareAdjustment', 'approveAdjustment', 'rejectAdjustment'].includes(action)) return fail('Choose a supported bank action.')
  return getFirestore().runTransaction(async tx => {
    const { member, companyRef } = await companyContext(tx, actor)
    companyRequireRole(member, ['saveAccount', 'approve', 'reopen', 'approveAdjustment', 'rejectAdjustment'].includes(action) ? ['admin', 'manager'] : ['admin', 'manager', 'accountant'])
    const booksRef = companyRef.collection('accounting').doc('books'), ledger = await tx.get(booksRef)
    if (!ledger.exists) throw new HttpsError('failed-precondition', 'Company books are not available.')
    const books = ledger.get('books') as Books, booksRevision = Number(ledger.get('revision'))

    if (action === 'saveAccount') {
      const bankId = data.id ? id(data.id) : randomUUID(), ref = companyRef.collection('bankAccounts').doc(bankId), previous = await tx.get(ref)
      if (data.id && !previous.exists) throw new HttpsError('not-found', 'The bank account was not found in this company.')
      matchingVersion(data.expectedVersion, previous.get('version') || 0)
      const value = clean(() => validateBankAccount({ ...object(data.value), id: bankId }, books.accounts))
      if (previous.exists && previous.get('accountCode') !== value.accountCode) throw new HttpsError('failed-precondition', 'A bank’s linked ledger account is immutable. Create a new bank/ledger account for a change.')
      const indexRef = companyRef.collection('bankControl').doc(`account-${value.accountCode}`)
      const [index, all] = await Promise.all([tx.get(indexRef), tx.get(companyRef.collection('bankAccounts'))])
      if (index.exists && index.get('bankId') !== bankId) throw new HttpsError('already-exists', 'Another bank record already uses this ledger account.')
      if (!previous.exists && all.docs.length >= BANK_WORKFLOW_LIMITS.accounts) throw new HttpsError('resource-exhausted', 'This release supports up to 50 bank accounts per company.')
      const timestamp = now(), record: BankAccountRecord = { ...value, version: (previous.get('version') || 0) + 1, createdBy: previous.get('createdBy') || actor.uid, createdAt: previous.get('createdAt') || timestamp, updatedBy: actor.uid, updatedAt: timestamp }
      tx.set(ref, record); tx.set(indexRef, { bankId, accountCode: value.accountCode })
      companyAudit(tx, companyRef, actor, 'bank.account.save', `Saved bank account ${value.name}.`, { bankId, version: record.version })
      return { id: bankId, version: record.version }
    }

    let adjustment: BankAdjustment | undefined
    if (['approveAdjustment', 'rejectAdjustment'].includes(action)) {
      const snapshot = await tx.get(companyRef.collection('bankAdjustments').doc(id(data.id)))
      if (!snapshot.exists) throw new HttpsError('not-found', 'The bank adjustment was not found.')
      adjustment = snapshot.data() as BankAdjustment
      if (adjustment.status === 'approved' && action === 'approveAdjustment') return { id: adjustment.id, status: 'approved', entryId: adjustment.entryId, alreadyPosted: true }
      matchingVersion(data.expectedVersion, adjustment.version)
      if (adjustment.status !== 'pending') throw new HttpsError('failed-precondition', 'This adjustment is no longer awaiting review.')
      if (action === 'approveAdjustment' && adjustment.createdBy === actor.uid) throw new HttpsError('permission-denied', 'Another Admin or Manager must approve your bank adjustment.')
    }
    const statementId = action === 'importStatement' ? randomUUID() : adjustment?.statementId || (action === 'prepareAdjustment' ? id(data.statementId) : id(data.id))
    const statementRef = companyRef.collection('bankStatements').doc(statementId)
    const previous = action === 'importStatement' ? null : await tx.get(statementRef)
    if (previous && !previous.exists) throw new HttpsError('not-found', 'The bank statement was not found in this company.')
    let statement = previous?.data() as BankStatement | undefined
    const bankId = action === 'importStatement' ? id(data.bankId) : statement!.bankId
    const bankSnapshot = await tx.get(companyRef.collection('bankAccounts').doc(bankId))
    if (!bankSnapshot.exists) throw new HttpsError('not-found', 'The bank account was not found.')
    const bank = bankSnapshot.data() as BankAccountRecord
    clean(() => validateBankAccount(bank, books.accounts))
    if (!bank.active) throw new HttpsError('failed-precondition', 'Reactivate this bank account before changing its reconciliation.')
    const controlRef = companyRef.collection('bankControl').doc(`bank-${bankId}`), controlSnapshot = await tx.get(controlRef)
    const control = controlSnapshot.exists ? controlSnapshot.data() as BankControl : emptyControl(bank)
    const locksRef = companyRef.collection('bankControl').doc('locks'), locksSnapshot = await tx.get(locksRef)
    const locks: BankLedgerLocks = locksSnapshot.exists ? locksSnapshot.data() as BankLedgerLocks : { version: 0, accounts: {} }

    if (action === 'importStatement') {
      const input = statementInput(data.input), suppliedFile = fileValue(data.file, companyRef.id), reviewNote = note(data.reviewNote)
      const fileIndexRef = companyRef.collection('bankStatementImports').doc(sha(`${bankId}:${suppliedFile.sha256}`)), fileIndex = await tx.get(fileIndexRef)
      if (fileIndex.exists) return { id: fileIndex.get('statementId'), alreadyImported: true }
      const file = await verifyFile(suppliedFile, true)
      const format = file.type === 'text/csv' ? 'csv' : file.type === 'application/pdf' ? 'pdf' : 'xlsx'
      if (input.rows.some(row => row.source.format !== format || row.source.fileName !== file.name)) return fail('Imported rows must retain the original file name and format.')
      input.rows = input.rows.map((row, index) => ({ ...row, id: `${statementId}:${index + 1}` }))
      const indexes = await duplicateIndexes(tx, companyRef, bankId, input.rows)
      const duplicates = new Set(findBankDuplicateCandidates(input.rows).map(row => row.rowId))
      for (const row of input.rows) {
        const key = bankRowFingerprint(row), snapshot = key ? indexes.snapshots[indexes.keys.indexOf(key)] : undefined
        if (duplicates.has(row.id) || snapshot?.exists) row.issues.push({ code: 'duplicate_candidate', message: 'A transaction with the same date, amount, reference and description already exists. Review whether this is a separate genuine movement.' })
      }
      const timestamp = now()
      statement = { ...input, id: statementId, bankId, version: 1, status: 'draft', allocations: [], file, reviewNote, importedRowIds: input.rows.map(row => row.id), createdBy: actor.uid, createdAt: timestamp, updatedBy: actor.uid, updatedAt: timestamp }
      sized(statement, 'Statement')
      indexes.refs.forEach((ref, index) => { if (!indexes.snapshots[index].exists) tx.create(ref, { bankId, firstStatementId: statementId }) })
      tx.create(fileIndexRef, { bankId, statementId, sha256: file.sha256 }); saveVersion(tx, companyRef, statement)
      companyAudit(tx, companyRef, actor, 'bank.statement.import', `Imported ${input.rows.length} statement rows for ${bank.name}.`, { statementId, sha256: file.sha256, rows: input.rows.length, reviewNote })
      return { id: statementId, version: 1, status: 'draft', rows: input.rows.length }
    }
    if (!statement) throw new HttpsError('not-found', 'Bank statement unavailable.')
    if (!adjustment) matchingVersion(data.expectedVersion, statement.version)
    const next = { ...statement, version: statement.version + 1, updatedBy: actor.uid, updatedAt: now() }

    if (action === 'saveStatement') {
      if (statement.status !== 'draft' || statement.allocations.length) throw new HttpsError('failed-precondition', 'Clear draft matches before correcting rows. Prepared or approved statements must be reopened first.')
      const input = statementInput(data.input), reviewNote = note(data.reviewNote)
      const original = await tx.get(companyRef.collection('bankStatementVersions').doc(`${statementId}-1`))
      const originals = new Map((original.get('rows') as BankStatementRow[] || []).map(row => [row.id, row]))
      for (const row of input.rows) {
        const old = originals.get(row.id)
        if (!old || JSON.stringify(old.source) !== JSON.stringify(row.source) || JSON.stringify(old.raw) !== JSON.stringify(row.raw)) return fail('Original statement source references and raw values are immutable. Change only reviewed fields or exclude a row with a review note.')
      }
      const indexes = await duplicateIndexes(tx, companyRef, bankId, input.rows)
      for (const row of input.rows) {
        const old = statement.rows.find(value => value.id === row.id), key = bankRowFingerprint(row), snapshot = key ? indexes.snapshots[indexes.keys.indexOf(key)] : undefined
        if (key && key !== (old ? bankRowFingerprint(old) : null) && snapshot?.exists && snapshot.get('firstStatementId') !== statementId) row.issues.push({ code: 'duplicate_candidate', message: 'The corrected transaction matches an earlier imported movement. Review it before accepting.' })
      }
      const record = { ...next, ...input, reviewNote }
      sized(record, 'Statement')
      indexes.refs.forEach((ref, index) => { if (!indexes.snapshots[index].exists) tx.create(ref, { bankId, firstStatementId: statementId }) })
      saveVersion(tx, companyRef, record)
      companyAudit(tx, companyRef, actor, 'bank.statement.correct', `Reviewed statement corrections: ${input.reference}.`, { statementId, version: record.version, reviewNote, excludedRowIds: statement.importedRowIds.filter(id => !input.rows.some(row => row.id === id)) })
      return { id: statementId, version: record.version, status: record.status }
    }
    if (action === 'saveMatches') {
      if (statement.status !== 'draft') throw new HttpsError('failed-precondition', 'Reopen the statement before changing its matches.')
      const allocations = allocationInput(data.allocations), record = { ...next, allocations }
      bankState(record, bank, books, control)
      tx.set(controlRef, reserveStatement(control, statementId, allocations))
      saveVersion(tx, companyRef, record)
      companyAudit(tx, companyRef, actor, 'bank.matches.save', `Reviewed ${allocations.length} bank/book match allocations.`, { statementId, version: record.version })
      return { id: statementId, version: record.version, status: record.status }
    }
    if (action === 'prepare') {
      if (statement.status !== 'draft') throw new HttpsError('failed-precondition', 'Only a draft statement can be prepared.')
      const reviewNote = note(data.note), report = reportFor(statement, bank, books, booksRevision, control)
      await verifyFile(statement.file, false)
      const record: BankStatement = { ...next, status: 'prepared', preparedBy: actor.uid, preparedAt: now(), preparedBooksRevision: booksRevision, preparedBooksFingerprint: report.booksFingerprint, reviewNote, report }
      saveVersion(tx, companyRef, record)
      companyAudit(tx, companyRef, actor, 'bank.reconciliation.prepare', `Prepared ${statement.reference} for independent review.`, { statementId, version: record.version, booksRevision })
      return { id: statementId, version: record.version, status: record.status, report }
    }
    if (action === 'approve') {
      if (statement.status !== 'prepared') throw new HttpsError('failed-precondition', 'Prepare this reconciliation before approving it.')
      if (statement.preparedBy === actor.uid) throw new HttpsError('permission-denied', 'Another Admin or Manager must approve your bank reconciliation.')
      matchingVersion(data.expectedBooksRevision, booksRevision)
      const reviewNote = note(data.note), report = reportFor(statement, bank, books, booksRevision, control)
      if (statement.preparedBooksFingerprint !== report.booksFingerprint) throw new HttpsError('aborted', 'The bank ledger changed after preparation. Reopen and prepare the reconciliation again.')
      await verifyFile(statement.file, false)
      const state = bankState(statement, bank, books, control), bookUsed = { ...state.used }
      for (const allocation of statement.allocations) bookUsed[allocation.bookLineId] = (bookUsed[allocation.bookLineId] || 0) + allocation.amount
      const updatedControl: BankControl = { ...reserveStatement(control, statementId, []), bookUsed, approved: [...control.approved, { id: statementId, from: statement.from, to: statement.to, version: next.version }], ...(!control.approved.length ? { baselineStatementId: statementId, baselineBookUsed: state.baseline } : {}) }
      sized(updatedControl, 'Bank reconciliation history')
      const record: BankStatement = { ...next, status: 'approved', approvedBy: actor.uid, approvedAt: now(), reviewNote, report }
      tx.set(controlRef, updatedControl)
      tx.set(locksRef, { version: locks.version + 1, accounts: { ...locks.accounts, [bank.accountCode]: { bankId, statementId, through: statement.to } } })
      saveVersion(tx, companyRef, record)
      companyAudit(tx, companyRef, actor, 'bank.reconciliation.approve', `Approved ${statement.reference} with zero reconciliation difference.`, { statementId, version: record.version, booksRevision, reviewNote })
      return { id: statementId, version: record.version, status: record.status, report }
    }
    if (action === 'reopen') {
      if (statement.status === 'draft') throw new HttpsError('failed-precondition', 'This statement is already a draft.')
      const reviewNote = note(data.note)
      if (statement.status === 'approved') {
        if (statement.approvedBy === actor.uid) throw new HttpsError('permission-denied', 'Another Admin or Manager must review reopening a reconciliation you approved.')
        if (control.approved.at(-1)?.id !== statementId) throw new HttpsError('failed-precondition', 'Reopen later approved reconciliations first so their opening balances cannot change silently.')
        const bookUsed = { ...control.bookUsed }
        for (const allocation of statement.allocations) { bookUsed[allocation.bookLineId] = (bookUsed[allocation.bookLineId] || 0) - allocation.amount; if (bookUsed[allocation.bookLineId] === 0) delete bookUsed[allocation.bookLineId] }
        const updated: BankControl = { ...reserveStatement(control, statementId, statement.allocations), bookUsed, approved: control.approved.slice(0, -1) }
        if (control.baselineStatementId === statementId) { for (const [key, amount] of Object.entries(control.baselineBookUsed || {})) { bookUsed[key] = (bookUsed[key] || 0) - amount; if (bookUsed[key] === 0) delete bookUsed[key] }; delete updated.baselineStatementId; delete updated.baselineBookUsed }
        if (Object.values(bookUsed).some(value => value < 0)) throw new HttpsError('failed-precondition', 'The approved allocation history needs administrator review.')
        const accounts = { ...locks.accounts }, last = updated.approved.at(-1)
        if (last) accounts[bank.accountCode] = { bankId, statementId: last.id, through: last.to }; else delete accounts[bank.accountCode]
        tx.set(controlRef, updated); tx.set(locksRef, { version: locks.version + 1, accounts })
      }
      const record = { ...draftVersion(next), reviewNote }
      saveVersion(tx, companyRef, record)
      companyAudit(tx, companyRef, actor, 'bank.reconciliation.reopen', `Reopened ${statement.reference}; earlier snapshots remain retained.`, { statementId, version: record.version, reviewNote })
      return { id: statementId, version: record.version, status: record.status }
    }

    if (action === 'rejectAdjustment' && adjustment) {
      const reviewNote = note(data.note)
      tx.update(companyRef.collection('bankAdjustments').doc(adjustment.id), { status: 'rejected', version: adjustment.version + 1, approvedBy: actor.uid, approvedAt: now(), reviewNote })
      companyAudit(tx, companyRef, actor, 'bank.adjustment.reject', `Rejected bank adjustment ${adjustment.reference}.`, { adjustmentId: adjustment.id, reviewNote })
      return { id: adjustment.id, status: 'rejected', version: adjustment.version + 1 }
    }
    if (statement.status !== 'draft') throw new HttpsError('failed-precondition', 'Reopen the statement before preparing or posting a bank adjustment.')
    const state = bankState(statement, bank, books, control)
    if (action === 'prepareAdjustment') {
      const input = object(data.input), row = statement.rows.find(row => row.id === input.bankRowId)
      if (!row || row.issues.length || !row.date || row.amount === null || input.date !== row.date) return fail('Choose a reviewed bank transaction and use its date for the bank adjustment.')
      const amount = state.bankRemaining[row.id]
      if (!amount) throw new HttpsError('failed-precondition', 'This bank row is already fully matched. No additional posting is needed.')
      const offsetAccount = text(input.offsetAccount, 'offset account', 8), offset = books.accounts.find(account => account.code === offsetAccount)
      if (!offset || offset.cash || !['Expense', 'Revenue'].includes(offset.type)) return fail('Bank adjustments support expense/revenue accounts for fees and interest. Use the dedicated invoice, payroll or asset workflow for other postings.')
      const reference = text(input.reference, 'adjustment reference'), description = text(input.description, 'adjustment description', 500)
      const adjustmentId = sha(JSON.stringify([statementId, statement.version, row.id, amount, input.date, reference, offsetAccount, description]))
      const ref = companyRef.collection('bankAdjustments').doc(adjustmentId), existing = await tx.get(ref)
      if (existing.exists) return { id: adjustmentId, version: existing.get('version'), status: existing.get('status'), alreadyPrepared: true }
      const record: BankAdjustment & { preparedStatementVersion: number } = { id: adjustmentId, statementId, bankRowId: row.id, version: 1, status: 'pending', date: row.date, reference, description, offsetAccount, amount, createdBy: actor.uid, createdAt: now(), preparedStatementVersion: statement.version }
      tx.create(ref, record)
      companyAudit(tx, companyRef, actor, 'bank.adjustment.prepare', `Prepared bank adjustment ${reference}; no ledger entry posted yet.`, { adjustmentId, statementId, bankRowId: row.id, amount })
      return { id: adjustmentId, version: 1, status: 'pending' }
    }
    if (action === 'approveAdjustment' && adjustment) {
      matchingVersion(data.expectedBooksRevision, booksRevision)
      const prepared = adjustment as BankAdjustment & { preparedStatementVersion: number }
      matchingVersion(prepared.preparedStatementVersion, statement.version)
      if (state.bankRemaining[adjustment.bankRowId] !== adjustment.amount) throw new HttpsError('aborted', 'The bank transaction was matched or changed after adjustment preparation.')
      const reviewNote = note(data.note), offset = books.accounts.find(account => account.code === adjustment.offsetAccount)
      if (!offset || offset.cash || !['Expense', 'Revenue'].includes(offset.type)) return fail('The reviewed expense/revenue adjustment account is no longer valid.')
      const amount = Math.abs(adjustment.amount)
      const lines = adjustment.amount > 0 ? [{ account: bank.accountCode, debit: amount, credit: 0 }, { account: offset.code, debit: 0, credit: amount }] : [{ account: bank.accountCode, debit: 0, credit: amount }, { account: offset.code, debit: amount, credit: 0 }]
      const updatedBooks = clean(() => post(books, { date: adjustment.date, reference: adjustment.reference, description: adjustment.description, source: 'journal', lines }))
      if (updatedBooks.entries.length > 2000) throw new HttpsError('resource-exhausted', 'The company ledger reached its supported entry capacity.')
      sized(updatedBooks, 'Company ledger'); await assertBankLedgerChangeAllowed(tx, companyRef, books, updatedBooks)
      const entryId = updatedBooks.entries.at(-1)!.id, allocations = [...statement.allocations, { bankRowId: adjustment.bankRowId, bookLineId: `${entryId}:0`, amount }]
      const record = { ...next, allocations }
      bankState(record, bank, updatedBooks, control)
      tx.set(controlRef, reserveStatement(control, statementId, allocations))
      tx.update(booksRef, { books: updatedBooks, revision: booksRevision + 1, updatedAt: now() })
      tx.update(companyRef.collection('bankAdjustments').doc(adjustment.id), { status: 'approved', version: adjustment.version + 1, approvedBy: actor.uid, approvedAt: now(), reviewNote, entryId })
      saveVersion(tx, companyRef, record)
      companyAudit(tx, companyRef, actor, 'bank.adjustment.approve', `Approved and matched bank adjustment ${adjustment.reference}.`, { adjustmentId: adjustment.id, statementId, entryId, booksRevision: booksRevision + 1, reviewNote })
      return { id: adjustment.id, status: 'approved', version: adjustment.version + 1, entryId, statementVersion: record.version }
    }
    return fail('Unsupported bank action.')
  })
})
