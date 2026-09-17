import { randomUUID } from 'node:crypto'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { companyIdentity, companyContext, companyRequireRole, companyAudit } from './company-accounting.js'
import { post, type Books } from './accounting-engine.js'
import { calculatePayrollRun, assertPayrollContributionAllocation, payrollJournal, payrollOverlaps, validateEmployee, type EmployeeRecord, type PayrollRun } from './payroll.js'
import type { TaxRegister } from './tax-returns.js'
import { assertBankLedgerChangeAllowed } from './bank-locks.js'
const now = () => new Date().toISOString()
const object = (value: unknown): Record<string, unknown> => { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new HttpsError('invalid-argument', 'A valid request is required.'); return value as Record<string, unknown> }
const id = (value: unknown) => { if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(value)) throw new HttpsError('invalid-argument', 'Invalid record identifier.'); return value }
const revision = (value: unknown) => { if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new HttpsError('invalid-argument', 'A current record version is required.'); return value }
const clean = <T>(fn: () => T): T => { try { return fn() } catch (reason) { throw new HttpsError('invalid-argument', reason instanceof Error ? reason.message : 'Invalid payroll data.') } }
const capacity = (data: unknown, limit: number, message: string) => { if (Buffer.byteLength(JSON.stringify(data), 'utf8') > limit) throw new HttpsError('resource-exhausted', message) }

export const companyPayroll = onCall({ region: 'asia-southeast1', timeoutSeconds: 60, maxInstances: 20 }, async request => {
  const actor = await companyIdentity(request), data = object(request.data), expected = revision(data.expectedRevision)
  if (!['saveEmployee', 'saveRun', 'approveRun'].includes(String(data.action))) throw new HttpsError('invalid-argument', 'Choose a payroll action.')
  return getFirestore().runTransaction(async tx => {
    const { member, companyRef, company } = await companyContext(tx, actor)
    companyRequireRole(member, data.action === 'approveRun' ? ['admin', 'manager'] : ['admin', 'manager', 'accountant'])
    const employeeRef = companyRef.collection('employees').doc('default'), employeeSnapshot = await tx.get(employeeRef)
    const employeeRevision = employeeSnapshot.get('revision') || 0, employees = (employeeSnapshot.get('employees') || []) as EmployeeRecord[]
    if (data.action === 'saveEmployee') {
      if (expected !== employeeRevision) throw new HttpsError('aborted', 'Employee records changed. Reload before saving.')
      const employeeId = data.employeeId ? id(data.employeeId) : randomUUID(), previous = employees.find(row => row.id === employeeId)
      if (data.employeeId && !previous) throw new HttpsError('not-found', 'The employee record no longer exists.')
      const employee = clean(() => validateEmployee(data.input, employeeId, (previous?.version || 0) + 1))
      if (employees.some(row => row.id !== employeeId && (row.code === employee.code || row.tin === employee.tin))) throw new HttpsError('already-exists', 'The employee code or TIN already belongs to another employee.')
      const next = previous ? employees.map(row => row.id === employeeId ? employee : row) : [...employees, employee]
      if (next.length > 100) throw new HttpsError('resource-exhausted', 'This release supports up to 100 employee records per company.')
      capacity(next, 500000, 'Employee records exceed the supported size. Reduce long notes before saving.')
      const payload = { employees: next, revision: employeeRevision + 1, updatedAt: now(), updatedBy: actor.uid }
      if (employeeSnapshot.exists) tx.update(employeeRef, payload); else tx.create(employeeRef, payload)
      companyAudit(tx, companyRef, actor, 'employee.save', 'Updated the private employee register.', { employeeId, employeeVersion: employee.version })
      return { id: employeeId, revision: employeeRevision + 1 }
    }
    const runId = data.id ? id(data.id) : randomUUID(), runRef = companyRef.collection('payrollRuns').doc(runId), old = await tx.get(runRef)
    if (data.action === 'saveRun') {
      if (old.exists && old.get('status') !== 'draft') throw new HttpsError('failed-precondition', 'Posted payroll is immutable. Use a reviewed accounting correction for adjustments.')
      if ((old.get('version') || 0) !== expected || revision(data.expectedEmployeeRevision) !== employeeRevision) throw new HttpsError('aborted', 'The payroll or employee records changed. Reload and review the current data.')
      if (old.exists && old.get('createdBy') !== actor.uid) throw new HttpsError('permission-denied', 'Only the payroll preparer can edit this draft. Another Admin or Manager must approve it.')
      const run = clean(() => calculatePayrollRun(data.input, employees, employeeRevision))
      if (run.rows.some(row => row.statutoryEvidence?.monthly)) {
        const posted = await tx.get(companyRef.collection('payrollRuns').where('status', '==', 'posted'))
        clean(() => assertPayrollContributionAllocation(run, posted.docs.map(snapshot => snapshot.data() as PayrollRun)))
      }
      capacity(run, 500000, 'The payroll run exceeds the supported size. Split large evidenced payrolls into smaller employee groups.')
      const payload = { ...run, status: 'draft', version: expected + 1, createdAt: old.get('createdAt') || now(), createdBy: old.get('createdBy') || actor.uid, createdByEmail: old.get('createdByEmail') || actor.email, updatedAt: now(), companyName: company.profile.registeredName }
      if (old.exists) tx.update(runRef, payload); else tx.create(runRef, payload)
      companyAudit(tx, companyRef, actor, 'payroll.prepare', `Prepared payroll ${run.reference}.`, { runId, runVersion: payload.version })
      return { id: runId, version: payload.version, status: 'draft' }
    }
    if (!old.exists) throw new HttpsError('not-found', 'The payroll draft does not exist.')
    if (old.get('status') === 'posted') return { id: runId, status: 'posted', entryId: old.get('entryId'), alreadyPosted: true }
    if (old.get('status') !== 'draft' || old.get('version') !== expected) throw new HttpsError('aborted', 'This payroll changed. Reload before approval.')
    if (old.get('createdBy') === actor.uid) throw new HttpsError('permission-denied', 'Another Admin or Accounting Manager must approve your payroll.')
    if (old.get('employeeRevision') !== employeeRevision) throw new HttpsError('aborted', 'Employee records changed. Ask the preparer to refresh and save this draft again.')
    if (typeof data.reviewNote !== 'string' || data.reviewNote.trim().length < 10 || data.reviewNote.length > 3000) throw new HttpsError('invalid-argument', 'Document the independent payroll review using 10–3,000 characters.')
    const booksRef = companyRef.collection('accounting').doc('books'), registersRef = companyRef.collection('taxRegisters').doc('default')
    const [ledger, registers, postedRuns] = await Promise.all([tx.get(booksRef), tx.get(registersRef), tx.get(companyRef.collection('payrollRuns').where('status', '==', 'posted'))])
    if (!ledger.exists || ledger.get('revision') !== revision(data.expectedBooksRevision)) throw new HttpsError('aborted', 'Company books changed. Review the current books before posting.')
    const run = clean(() => calculatePayrollRun(old.data(), employees, employeeRevision))
    clean(() => assertPayrollContributionAllocation(run, postedRuns.docs.map(snapshot => snapshot.data() as PayrollRun)))
    if (postedRuns.docs.some(snapshot => payrollOverlaps(run, snapshot.data() as PayrollRun))) throw new HttpsError('already-exists', 'A posted payroll already includes one of these employees in an overlapping period. Review that run before making an accounting adjustment.')
    const books = ledger.get('books') as Books, lines = clean(() => payrollJournal(run, books.accounts))
    const next = clean(() => post(books, { date: run.payDate, reference: run.reference, description: `Payroll accrual for ${run.periodStart} to ${run.periodEnd}`, source: 'journal', lines }))
    if (next.entries.length > 2000) throw new HttpsError('resource-exhausted', 'The company ledger reached its supported entry limit.')
    capacity(next, 650000, 'The company ledger exceeds its supported size.')
    const entryId = next.entries[next.entries.length - 1].id
    const existing = (registers.get('records') || []) as TaxRegister[]
    const payrollRecords: TaxRegister[] = run.rows.map(row => ({ id: `payroll-${runId}-${row.employeeId}`, entryId, date: run.payDate, kind: 'payroll', partyId: '', partyName: row.employee.fullName, tin: row.employee.tin, address: row.employee.address, atc: row.employee.compensationAtc, classification: 'Compensation', taxBase: row.taxableCompensation, taxAmount: row.withholdingTax, notes: `Payroll ${run.reference}`, active: true }))
    const records = [...existing, ...payrollRecords]
    if (records.length > 1000) throw new HttpsError('resource-exhausted', 'The tax register reached its supported 1,000-record limit.')
    capacity(records, 500000, 'The tax register exceeds its supported size.')
    const taxPayload = { records, version: (registers.get('version') || 0) + 1, updatedAt: now(), updatedBy: actor.uid }
    await assertBankLedgerChangeAllowed(tx, companyRef, books, next)
    tx.update(booksRef, { books: next, revision: ledger.get('revision') + 1, updatedAt: now() })
    if (registers.exists) tx.update(registersRef, taxPayload); else tx.create(registersRef, taxPayload)
    tx.update(runRef, { rows: run.rows, status: 'posted', version: expected + 1, entryId, booksRevision: ledger.get('revision') + 1, approvedAt: now(), approvedBy: actor.uid, reviewNote: data.reviewNote.trim() })
    companyAudit(tx, companyRef, actor, 'payroll.post', `Approved and posted payroll ${run.reference}.`, { runId, entryId, employeeCount: run.rows.length })
    return { id: runId, status: 'posted', entryId }
  })
})
