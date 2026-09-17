const { test, beforeEach } = require('node:test')
const assert = require('node:assert/strict')
const { randomUUID, createHash } = require('node:crypto')
const Module = require('node:module')

const documents = new Map(), users = new Map(), files = new Map()
const reference = path => ({ path, id: path.split('/').at(-1), collection: name => collection(`${path}/${name}`) })
const collection = (path, filters = []) => ({ path, filters, isQuery: true, doc: (key = randomUUID()) => reference(`${path}/${key}`), where: (field, op, value) => collection(path, [...filters, [field, op, value]]) })
const snapshot = ref => ({ id: ref.id, ref, exists: documents.has(ref.path), data: () => structuredClone(documents.get(ref.path)), get: field => structuredClone(documents.get(ref.path)?.[field]) })
const read = ref => ref.isQuery ? { docs: [...documents.entries()].filter(([path, value]) => path.startsWith(`${ref.path}/`) && path.split('/').length === ref.path.split('/').length + 1 && ref.filters.every(([field, op, expected]) => op === '==' ? value[field] === expected : op === '>=' ? value[field] >= expected : op === '<=' ? value[field] <= expected : false)).map(([path]) => snapshot(reference(path))) } : snapshot(ref)
const db = { doc: reference, collection, async runTransaction(fn) {
  const writes = []
  const tx = {
    async get(ref) { assert.equal(writes.length, 0, 'All Firestore reads must happen before transaction writes'); return read(ref) },
    async getAll(...refs) { assert.equal(writes.length, 0, 'All Firestore reads must happen before transaction writes'); return refs.map(read) },
    create(ref, value) { assert.ok(!documents.has(ref.path), 'Cannot overwrite immutable snapshot'); writes.push([ref.path, structuredClone(value)]) },
    update(ref, value) { assert.ok(documents.has(ref.path)); writes.push([ref.path, { ...structuredClone(documents.get(ref.path)), ...structuredClone(value) }]) },
    set(ref, value) { writes.push([ref.path, structuredClone(value)]) },
  }
  const result = await fn(tx)
  for (const [path, value] of writes) documents.set(path, value)
  return result
} }
const original = Module._load
Module._load = function (name, ...args) {
  if (name === 'firebase-admin/auth') return { getAuth: () => ({ getUser: async uid => users.get(uid) }) }
  if (name === 'firebase-admin/firestore') return { getFirestore: () => db }
  if (name === 'firebase-admin/storage') return { getStorage: () => ({ bucket: () => ({ file: (path, options) => ({
    async getMetadata() { const file = files.get(path); if (!file) throw Error('Missing file'); return [{ name: path, size: String(file.bytes.length), contentType: file.type, generation: file.generation }] },
    async download() { const file = files.get(path); if (!file || (options?.generation && options.generation !== file.generation)) throw Error('Missing generation'); return [file.bytes] },
  }) }) }) }
  return original.call(this, name, ...args)
}
const api = { ...require('../lib/company-accounting.js'), ...require('../lib/company-bank.js') }
const { assertBankLedgerChangeAllowed } = require('../lib/bank-locks.js')
Module._load = original
const { post } = require('../lib/accounting-engine.js')
const profile = { registeredName: 'Example Trading', tin: '123-456-789', branchCode: '00000', rdo: '044', registeredAddress: 'Makati City', entityType: 'sole_proprietor', vatStatus: 'vat', incomeTaxRegime: 'graduated', fiscalYearEnd: '12-31', reportingFramework: 'pfrs_small', withholdingAgent: true, hasEmployees: true, casRegistrationReference: '', invoiceSeries: 'INV', secRegistrationNumber: '', businessNature: 'Trading', accountantReviewRequired: true }
const user = (uid, extra = {}) => users.set(uid, { uid, email: `${uid}@example.test`, emailVerified: true, disabled: false, ...extra })
const call = (name, uid, data) => { const actor = users.get(uid); return api[name].run({ data, auth: actor ? { uid, token: { email: actor.email, email_verified: actor.emailVerified } } : undefined }) }
const bankCall = (uid, data) => call('companyBank', uid, data)
const get = (companyId, path) => documents.get(`companies/${companyId}/${path}`)
const set = (companyId, path, value) => documents.set(`companies/${companyId}/${path}`, value)
beforeEach(() => { documents.clear(); users.clear(); files.clear() })

async function setup() {
  user('owner'); const company = await call('companyCreate', 'owner', { profile })
  for (const [uid, role] of [['manager', 'manager'], ['accountant', 'accountant'], ['viewer', 'viewer']]) {
    user(uid); const member = { uid, email: `${uid}@example.test`, displayName: uid, companyId: company.companyId, companyCode: company.companyCode, role, active: true }
    documents.set(`companyMemberships/${uid}`, member); set(company.companyId, `members/${uid}`, member)
  }
  const result = await bankCall('owner', { action: 'saveAccount', expectedVersion: 0, value: { name: 'Operating bank', bankName: 'Example bank', accountSuffix: '1234', accountCode: '1010', currency: 'PHP', active: true } })
  const ledger = get(company.companyId, 'accounting/books')
  ledger.books = post(ledger.books, { date: '2026-08-31', reference: 'OPENING', description: 'Reviewed opening balance', source: 'journal', lines: [{ account: '1010', debit: 100000, credit: 0 }, { account: '3000', debit: 0, credit: 100000 }] })
  return { ...company, bankId: result.id }
}
function bookMovement(c, amount = 10000, date = '2026-09-01', reference = 'RECEIPT') {
  const ledger = get(c.companyId, 'accounting/books'), positive = amount > 0, value = Math.abs(amount)
  ledger.books = post(ledger.books, { date, reference, description: reference, source: 'journal', lines: [{ account: '1010', debit: positive ? value : 0, credit: positive ? 0 : value }, { account: positive ? '4000' : '5900', debit: positive ? 0 : value, credit: positive ? value : 0 }] })
  return `${ledger.books.entries.at(-1).id}:0`
}
async function imported(c, options = {}) {
  const name = options.name || `statement-${randomUUID()}.csv`, bytes = Buffer.from(`Statement ${name}\nDate,Description,Amount\n2026-09-01,${options.description || name},100.00\n`), path = `companies/${c.companyId}/bank-statements/${randomUUID()}`
  const file = { path, name, size: bytes.length, type: 'text/csv', sha256: createHash('sha256').update(bytes).digest('hex') }
  files.set(path, { bytes, type: 'text/csv', generation: '1' })
  const input = { reference: name, from: options.from || '2026-09-01', to: options.to || '2026-09-30', openingBalance: options.openingBalance ?? 100000, closingBalance: options.closingBalance ?? 110000, order: 'ascending', openingReviewed: true, openingOutstandingLineIds: options.openingOutstandingLineIds || [], rows: [{ id: 'source-row', date: options.date || '2026-09-01', description: options.description || name, reference: options.reference || name, amount: options.amount ?? 10000, balance: options.closingBalance ?? 110000, source: { format: 'csv', fileName: name, row: 3, text: 'Original synthetic bank row' }, raw: { amount: '100.00' }, issues: [] }] }
  const request = { action: 'importStatement', bankId: c.bankId, file, input, reviewNote: 'Checked extracted statement rows against the original source file.' }
  const result = await bankCall('accountant', request)
  return { ...result, file, request }
}
const statement = (c, item) => get(c.companyId, `bankStatements/${item.id}`)
async function match(c, item, bookLineId, amount = 10000) {
  const current = statement(c, item)
  return bankCall('accountant', { action: 'saveMatches', id: item.id, expectedVersion: current.version, allocations: [{ bankRowId: current.rows[0].id, bookLineId, amount }] })
}
async function prepared(c, item, uid = 'accountant') {
  return bankCall(uid, { action: 'prepare', id: item.id, expectedVersion: statement(c, item).version, note: 'Compared statement, opening balances and every matched amount.' })
}
async function approve(c, item, uid = 'owner') {
  return bankCall(uid, { action: 'approve', id: item.id, expectedVersion: statement(c, item).version, expectedBooksRevision: get(c.companyId, 'accounting/books').revision, note: 'Independent review of original statement and reconciled balance.' })
}
async function matched(c, options = {}) { const lineId = bookMovement(c, options.amount ?? 10000, options.date || '2026-09-01', options.bookReference || randomUUID()); const item = await imported(c, options); await match(c, item, lineId, Math.abs(options.amount ?? 10000)); return { ...item, lineId } }

test('bank workflows require verified active company membership and role permissions', async () => {
  const c = await setup()
  await assert.rejects(bankCall('missing', { action: 'saveAccount' }), { code: 'unauthenticated' })
  await assert.rejects(bankCall('viewer', { action: 'importStatement', companyId: c.companyId, role: 'admin' }), { code: 'permission-denied' })
  await assert.rejects(bankCall('accountant', { action: 'saveAccount' }), { code: 'permission-denied' })
  users.get('accountant').disabled = true
  await assert.rejects(bankCall('accountant', { action: 'importStatement' }), { code: 'permission-denied' })
})
test('bank account GL assignment is unique and immutable', async () => {
  const c = await setup(), bank = get(c.companyId, `bankAccounts/${c.bankId}`)
  await assert.rejects(bankCall('owner', { action: 'saveAccount', expectedVersion: 0, value: bank }), { code: 'already-exists' })
  await assert.rejects(bankCall('owner', { action: 'saveAccount', id: bank.id, expectedVersion: 1, value: { ...bank, accountCode: '1000' } }), { code: 'failed-precondition' })
})
test('import verifies original bytes, is idempotent by bank and checksum, and never posts', async () => {
  const c = await setup(), before = get(c.companyId, 'accounting/books').books.entries.length, item = await imported(c)
  const retry = await bankCall('accountant', item.request)
  assert.equal(retry.alreadyImported, true); assert.equal(retry.id, item.id)
  assert.equal(statement(c, item).file.generation, '1')
  assert.ok(statement(c, item).rows[0].id.startsWith(item.id))
  assert.equal(get(c.companyId, 'accounting/books').books.entries.length, before)
  assert.ok(statement(c, item).reviewNote.length >= 10)
  await assert.rejects(bankCall('accountant', { ...item.request, reviewNote: '' }), { code: 'invalid-argument' })
  const bad = { ...item.request, file: { ...item.file, sha256: '0'.repeat(64) } }
  await assert.rejects(bankCall('accountant', bad), { code: 'failed-precondition' })
})
test('file references from another company cannot be imported', async () => {
  const c = await setup(), item = await imported(c)
  await assert.rejects(bankCall('accountant', { ...item.request, file: { ...item.file, path: 'companies/other/bank-statements/foreign' } }), { code: 'invalid-argument' })
  user('other'); await call('companyCreate', 'other', { profile })
  await assert.rejects(bankCall('other', item.request), { code: 'not-found' })
})
test('similar imported transactions remain present and need an explicit documented correction/review', async () => {
  const c = await setup(), first = await imported(c, { description: 'Same description', reference: 'Same reference' })
  const second = await imported(c, { description: 'Same description', reference: 'Same reference' })
  assert.notEqual(first.id, second.id)
  const current = statement(c, second)
  assert.ok(current.rows[0].issues.some(issue => issue.code === 'duplicate_candidate'))
  const input = { ...current, rows: current.rows.map(row => ({ ...row, issues: [] })) }
  await assert.rejects(bankCall('accountant', { action: 'saveStatement', id: second.id, expectedVersion: current.version, input, reviewNote: '' }), { code: 'invalid-argument' })
  await bankCall('accountant', { action: 'saveStatement', id: second.id, expectedVersion: current.version, input, reviewNote: 'Verified two separate original bank movements with identical details.' })
  assert.equal(statement(c, second).rows[0].issues.length, 0)
  assert.equal(get(c.companyId, `bankStatementVersions/${second.id}-1`).rows[0].issues.length, 1)
})
test('statement corrections preserve immutable source/raw values and reject stale versions', async () => {
  const c = await setup(), item = await imported(c), current = statement(c, item)
  await assert.rejects(bankCall('accountant', { action: 'saveStatement', id: item.id, expectedVersion: 0, input: current, reviewNote: 'Reviewed correction against source.' }), { code: 'aborted' })
  const tampered = { ...current, rows: current.rows.map(row => ({ ...row, raw: { amount: '999' } })) }
  await assert.rejects(bankCall('accountant', { action: 'saveStatement', id: item.id, expectedVersion: 1, input: tampered, reviewNote: 'Reviewed correction against source.' }), { code: 'invalid-argument' })
})
test('two draft statements cannot reserve the same ledger amount; clearing a draft releases it', async () => {
  const c = await setup(), lineId = bookMovement(c), first = await imported(c), second = await imported(c)
  await match(c, first, lineId)
  await assert.rejects(match(c, second, lineId), { code: 'failed-precondition' })
  await bankCall('accountant', { action: 'saveMatches', id: first.id, expectedVersion: statement(c, first).version, allocations: [] })
  await match(c, second, lineId)
  const control = get(c.companyId, `bankControl/bank-${c.bankId}`)
  assert.equal(control.pendingReservations[first.id], undefined)
  assert.equal(control.pendingReservations[second.id][lineId], 10000)
  assert.equal(control.bookUsed[lineId], undefined)
})
test('preparation requires all bank rows matched and an exact balance reconciliation', async () => {
  const c = await setup(), item = await imported(c)
  await assert.rejects(prepared(c, item), { code: 'failed-precondition' })
  const lineId = bookMovement(c); await match(c, item, lineId)
  await prepared(c, item)
  assert.equal(statement(c, item).report.difference, 0)
  assert.equal(statement(c, item).report.openingDifference, 0)
})
test('first opening review accounts for pre-period outstanding transactions', async () => {
  const c = await setup(), lineId = bookMovement(c, 10000, '2026-08-31', 'DEPOSIT-IN-TRANSIT')
  const item = await imported(c, { openingOutstandingLineIds: [lineId] })
  await match(c, item, lineId); await prepared(c, item); await approve(c, item)
  const report = statement(c, item).report
  assert.equal(report.openingBookBalance, 110000); assert.equal(report.openingOutstandingAmount, 10000); assert.equal(report.openingDifference, 0)
})
test('independent approval snapshots the report and converts draft reservations into cleared amounts', async () => {
  const c = await setup(), item = await matched(c), before = get(c.companyId, 'accounting/books').books.entries.length
  await prepared(c, item, 'manager')
  await assert.rejects(approve(c, item, 'manager'), { code: 'permission-denied' })
  await assert.rejects(approve(c, item, 'accountant'), { code: 'permission-denied' })
  await approve(c, item)
  const current = statement(c, item), control = get(c.companyId, `bankControl/bank-${c.bankId}`)
  assert.equal(current.status, 'approved'); assert.equal(control.pendingReservations[item.id], undefined)
  assert.equal(control.bookUsed[item.lineId], 10000)
  assert.equal(get(c.companyId, 'bankControl/locks').accounts['1010'].through, '2026-09-30')
  assert.equal(get(c.companyId, `bankStatementVersions/${item.id}-${current.version}`).report.difference, 0)
  assert.equal(get(c.companyId, 'accounting/books').books.entries.length, before)
})
test('source ledger changes after preparation block approval even if their net change is zero', async () => {
  const c = await setup(), item = await matched(c); await prepared(c, item)
  bookMovement(c, 200, '2026-09-02', 'EXTRA-IN'); bookMovement(c, -200, '2026-09-02', 'EXTRA-OUT')
  await assert.rejects(approve(c, item), { code: 'aborted' })
})
test('replaced original statement generation is rejected before approval', async () => {
  const c = await setup(), item = await matched(c); await prepared(c, item)
  files.get(item.file.path).generation = '2'
  await assert.rejects(approve(c, item), { code: 'failed-precondition' })
})
test('bank period locks reject historical cash changes but allow future lines and unrelated metadata', async () => {
  const c = await setup(), item = await matched(c); await prepared(c, item); await approve(c, item)
  const books = get(c.companyId, 'accounting/books').books, companyRef = reference(`companies/${c.companyId}`)
  const change = date => post(books, { date, reference: `FEE-${date}`, description: 'Fee', source: 'journal', lines: [{ account: '1010', debit: 0, credit: 100 }, { account: '5900', debit: 100, credit: 0 }] })
  await assert.rejects(db.runTransaction(tx => assertBankLedgerChangeAllowed(tx, companyRef, books, change('2026-09-30'))), { code: 'failed-precondition' })
  await db.runTransaction(tx => assertBankLedgerChangeAllowed(tx, companyRef, books, change('2026-10-01')))
  await db.runTransaction(tx => assertBankLedgerChangeAllowed(tx, companyRef, books, structuredClone(books)))
})
test('reopening requires another reviewer, preserves history and restores draft reservations', async () => {
  const c = await setup(), item = await matched(c); await prepared(c, item); await approve(c, item)
  const approvedVersion = statement(c, item).version, request = { action: 'reopen', id: item.id, expectedVersion: approvedVersion, note: 'Independent review requires correction of the matching record.' }
  await assert.rejects(bankCall('owner', request), { code: 'permission-denied' })
  await bankCall('manager', request)
  const control = get(c.companyId, `bankControl/bank-${c.bankId}`)
  assert.equal(statement(c, item).status, 'draft'); assert.equal(control.bookUsed[item.lineId], undefined)
  assert.equal(control.pendingReservations[item.id][item.lineId], 10000)
  assert.equal(get(c.companyId, 'bankControl/locks').accounts['1010'], undefined)
  assert.equal(get(c.companyId, `bankStatementVersions/${item.id}-${approvedVersion}`).status, 'approved')
})
test('later approved reconciliations must be reopened before earlier periods', async () => {
  const c = await setup(), first = await matched(c); await prepared(c, first); await approve(c, first)
  const second = await matched(c, { from: '2026-10-01', to: '2026-10-31', date: '2026-10-01', amount: 5000, openingBalance: 110000, closingBalance: 115000 })
  await prepared(c, second); await approve(c, second)
  await assert.rejects(bankCall('manager', { action: 'reopen', id: first.id, expectedVersion: statement(c, first).version, note: 'Request opening review for the earlier statement.' }), { code: 'failed-precondition' })
  assert.equal(statement(c, first).status, 'approved')
})
test('bank fees are independently approved, posted and matched once atomically', async () => {
  const c = await setup(), item = await imported(c, { amount: -2500, closingBalance: 97500 }), current = statement(c, item)
  const request = { action: 'prepareAdjustment', statementId: item.id, expectedVersion: current.version, input: { bankRowId: current.rows[0].id, date: current.rows[0].date, reference: 'BANK-FEE', description: 'Reviewed bank service charge', offsetAccount: '5900' } }
  const adjustment = await bankCall('accountant', request), before = get(c.companyId, 'accounting/books').books.entries.length
  const approval = { action: 'approveAdjustment', id: adjustment.id, expectedVersion: 1, expectedBooksRevision: 0, note: 'Independently checked service charge against original statement.' }
  await assert.rejects(bankCall('accountant', approval), { code: 'permission-denied' })
  const posted = await bankCall('owner', approval)
  assert.equal(get(c.companyId, 'accounting/books').books.entries.length, before + 1)
  assert.equal(statement(c, item).allocations[0].bookLineId, `${posted.entryId}:0`)
  assert.equal(get(c.companyId, `bankControl/bank-${c.bankId}`).pendingReservations[item.id][`${posted.entryId}:0`], 2500)
  const retry = await bankCall('manager', approval)
  assert.equal(retry.alreadyPosted, true); assert.equal(get(c.companyId, 'accounting/books').books.entries.length, before + 1)
  await prepared(c, item); await approve(c, item)
})
test('adjustments cannot bypass invoice, payroll or asset workflows and fail cleanly in closed periods', async () => {
  const c = await setup(), item = await imported(c, { amount: -2500, closingBalance: 97500 }), current = statement(c, item)
  const request = { action: 'prepareAdjustment', statementId: item.id, expectedVersion: current.version, input: { bankRowId: current.rows[0].id, date: current.rows[0].date, reference: 'BANK-FEE', description: 'Reviewed bank charge', offsetAccount: '1500' } }
  await assert.rejects(bankCall('accountant', request), { code: 'invalid-argument' })
  const adjustment = await bankCall('accountant', { ...request, input: { ...request.input, offsetAccount: '5900' } })
  get(c.companyId, 'accounting/books').books.closedThrough = '2026-09-30'
  await assert.rejects(bankCall('owner', { action: 'approveAdjustment', id: adjustment.id, expectedVersion: 1, expectedBooksRevision: 0, note: 'Independent fee review against original source.' }), { code: 'invalid-argument' })
  assert.equal(get(c.companyId, `bankAdjustments/${adjustment.id}`).status, 'pending'); assert.equal(statement(c, item).allocations.length, 0)
})
