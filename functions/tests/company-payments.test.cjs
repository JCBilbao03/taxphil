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
const api = { ...require('../lib/company-accounting.js'), ...require('../lib/company-bank.js'), ...require('../lib/company-payments.js') }
const { assertPaymentSettlementAllowed } = require('../lib/payment-reservations.js')
Module._load = original
const { post, addInvoice, settle, outstanding, reverse, addAccount } = require('../lib/accounting-engine.js')
const profile = { registeredName: 'Example Trading', tin: '123-456-789', branchCode: '00000', rdo: '044', registeredAddress: 'Makati City', entityType: 'sole_proprietor', vatStatus: 'vat', incomeTaxRegime: 'graduated', fiscalYearEnd: '12-31', reportingFramework: 'pfrs_small', withholdingAgent: true, hasEmployees: true, casRegistrationReference: '', invoiceSeries: 'INV', secRegistrationNumber: '', businessNature: 'Trading', accountantReviewRequired: true }
const user = (uid, extra = {}) => users.set(uid, { uid, email: `${uid}@example.test`, emailVerified: true, disabled: false, ...extra })
const call = (name, uid, data) => { const actor = users.get(uid); return api[name].run({ data, auth: actor ? { uid, token: { email: actor.email, email_verified: actor.emailVerified } } : undefined }) }
const bankCall = (uid, data) => call('companyBank', uid, data)
const get = (companyId, path) => documents.get(`companies/${companyId}/${path}`)
const set = (companyId, path, value) => documents.set(`companies/${companyId}/${path}`, value)
beforeEach(() => { documents.clear(); users.clear(); files.clear() })

const payments = (uid, data) => call('companyPayments', uid, data)
async function setup() {
  user('owner'); const company = await call('companyCreate', 'owner', { profile })
  for (const [uid, role] of [['manager', 'manager'], ['accountant', 'accountant'], ['viewer', 'viewer']]) {
    user(uid); const member = { uid, email: `${uid}@example.test`, displayName: uid, companyId: company.companyId, companyCode: company.companyCode, role, active: true }
    documents.set(`companyMemberships/${uid}`, member); set(company.companyId, `members/${uid}`, member)
  }
  const bank = await bankCall('owner', { action: 'saveAccount', expectedVersion: 0, value: { name: 'Operating bank', bankName: 'Example bank', accountSuffix: '1234', accountCode: '1010', currency: 'PHP', active: true } })
  const ledger = get(company.companyId, 'accounting/books')
  ledger.books = post(ledger.books, { date: '2020-01-01', reference: 'OPENING', description: 'Reviewed opening balance', source: 'journal', lines: [{ account: '1010', debit: 100000, credit: 0 }, { account: '3000', debit: 0, credit: 100000 }] })
  ledger.books = addInvoice(ledger.books, { kind: 'payable', party: 'Vendor', reference: 'BILL-1', date: '2020-01-01', due: '2020-01-31', amount: 10000, account: '5900' })
  return { ...company, bankId: bank.id, invoiceId: ledger.books.invoices.at(-1).id }
}
const ledger = c => get(c.companyId, 'accounting/books')
const payment = (c, item) => get(c.companyId, `paymentRequests/${item.id}`)
const supporting = (c, kind = 'transfer_confirmation') => {
  const path = `companies/${c.companyId}/settlement-evidence/${randomUUID()}`, bytes = Buffer.from('%PDF-1.7 synthetic evidence')
  files.set(path, { bytes, type: 'application/pdf', generation: '1' })
  return { path, name: 'Evidence.pdf', size: bytes.length, type: 'application/pdf', kind }
}
async function preparedPayment(c, options = {}, actor = 'accountant') {
  const request = { action: 'prepare', requestId: randomUUID(), input: { invoiceId: c.invoiceId, bankId: c.bankId, amount: 10000, plannedDate: '2020-01-02', method: 'transfer', checkNumber: '', reference: `PAY-${randomUUID()}`, notes: 'Prepared against approved supplier bill and planned due date.', supportingDocuments: [], ...options } }
  return { ...await payments(actor, request), request }
}
async function approvedPayment(c, options = {}) { const item = await preparedPayment(c, options); await payments('owner', { action: 'approve', id: item.id, expectedVersion: 1, note: 'Independently checked vendor, bill, amount and destination bank.' }); return item }
function releaseRequest(c, item, options = {}) {
  const current = payment(c, item), check = current.method === 'check'
  return { action: 'release', id: item.id, expectedVersion: current.version, expectedBooksRevision: ledger(c).revision, releaseDate: '2020-01-02', confirmation: check ? 'check_released' : 'transfer_completed', confirmationReference: 'CONFIRMED-123', supportingDocuments: [supporting(c, check ? 'check_copy' : 'transfer_confirmation')], note: check ? 'Signed check was physically delivered to the vendor on this date.' : 'Bank confirmed this transfer was completed to the supplier.', ...options }
}
async function releasedPayment(c, options = {}) { const item = await approvedPayment(c, options); const request = releaseRequest(c, item); await payments('manager', request); return { ...item, releaseRequest: request } }

 test('payment workflows require current verified active company membership and allowed roles', async () => {
  const c = await setup()
  await assert.rejects(payments('absent', { action: 'prepare' }), { code: 'unauthenticated' })
  await assert.rejects(payments('viewer', { action: 'prepare' }), { code: 'permission-denied' })
  const item = await preparedPayment(c)
  await assert.rejects(payments('accountant', { action: 'approve', id: item.id }), { code: 'permission-denied' })
  await assert.rejects(payments('accountant', releaseRequest(c, item)), { code: 'permission-denied' })
  users.get('accountant').disabled = true
  await assert.rejects(payments('accountant', { action: 'getClearance', id: item.id }), { code: 'permission-denied' })
})
test('prepare is retry-safe, keeps bank/check dates unposted, snapshots bill and bank, and reserves amount', async () => {
  const c = await setup(), before = structuredClone(ledger(c)), item = await preparedPayment(c, { method: 'check', checkNumber: ' check-001 ' })
  const retry = await payments('accountant', item.request)
  assert.equal(retry.alreadyPrepared, true); assert.equal(retry.id, item.id)
  assert.deepEqual(ledger(c), before)
  assert.equal(payment(c, item).checkNumber, 'CHECK-001'); assert.equal(payment(c, item).payee, 'Vendor')
  assert.equal(get(c.companyId, `paymentControl/invoice-${c.invoiceId}`).requests[item.id], 10000)
  assert.equal(get(c.companyId, `paymentRequestVersions/${item.id}-1`).requestId, item.id)
  await assert.rejects(payments('accountant', { ...item.request, input: { ...item.request.input, amount: 9000 } }), { code: 'already-exists' })
})
test('another company cannot prepare using a foreign bill, bank, request or attachment', async () => {
  const c = await setup(), item = await preparedPayment(c)
  user('other'); await call('companyCreate', 'other', { profile })
  await assert.rejects(payments('other', { action: 'getClearance', id: item.id }), { code: 'not-found' })
  await assert.rejects(payments('other', item.request), { code: 'not-found' })
  const attachment = supporting(c, 'payment_approval')
  await assert.rejects(preparedPayment(c, { supportingDocuments: [{ ...attachment, path: 'companies/other/settlement-evidence/evidence' }] }), { code: 'invalid-argument' })
})
test('pending reservations prevent competing requests and direct settlements; cancellation releases only its amount', async () => {
  const c = await setup(), first = await preparedPayment(c, { amount: 6000 }), second = await preparedPayment(c, { amount: 4000 })
  await assert.rejects(preparedPayment(c, { amount: 1 }), { code: 'failed-precondition' })
  await assert.rejects(db.runTransaction(tx => assertPaymentSettlementAllowed(tx, reference(`companies/${c.companyId}`), ledger(c).books, c.invoiceId, 1)), { code: 'failed-precondition' })
  await assert.rejects(call('companyAccountingCommand', 'owner', { expectedRevision: ledger(c).revision, command: { type: 'settle', input: { invoiceId: c.invoiceId, amount: 1, date: '2020-01-02', cash: '1010', reference: 'DIRECT-PAYMENT' } } }), { code: 'failed-precondition' })
  await payments('accountant', { action: 'cancel', id: first.id, expectedVersion: 1, note: 'Cancelled the first planned partial supplier payment.' })
  await db.runTransaction(tx => assertPaymentSettlementAllowed(tx, reference(`companies/${c.companyId}`), ledger(c).books, c.invoiceId, 6000))
  assert.deepEqual(get(c.companyId, `paymentControl/invoice-${c.invoiceId}`).requests, { [second.id]: 4000 })
})
test('payment approval requires an independent reviewer and still leaves accounts payable outstanding', async () => {
  const c = await setup(), item = await preparedPayment(c, {}, 'owner'), before = structuredClone(ledger(c))
  await assert.rejects(payments('owner', { action: 'approve', id: item.id, expectedVersion: 1, note: 'Attempted same person review.' }), { code: 'permission-denied' })
  await payments('manager', { action: 'approve', id: item.id, expectedVersion: 1, note: 'Independent review of payable and payment destination.' })
  assert.deepEqual(ledger(c), before); assert.equal(payment(c, item).status, 'approved')
  assert.equal(outstanding(ledger(c).books, ledger(c).books.invoices[0]), 10000)
})
test('check numbers are unique per bank ignoring case and spaces, including after cancellation', async () => {
  const c = await setup(), item = await preparedPayment(c, { method: 'check', checkNumber: 'Ab-001' })
  await payments('accountant', { action: 'cancel', id: item.id, expectedVersion: 1, note: 'Cancelled the written check before its release to supplier.' })
  await assert.rejects(preparedPayment(c, { method: 'check', checkNumber: ' aB-001 ' }), { code: 'already-exists' })
  ledger(c).books = addAccount(ledger(c).books, { code: '1020', name: 'Another bank', type: 'Asset', cash: true })
  const bank = await bankCall('owner', { action: 'saveAccount', expectedVersion: 0, value: { name: 'Other bank', bankName: 'Another bank', accountSuffix: '9876', accountCode: '1020', currency: 'PHP', active: true } })
  await preparedPayment(c, { bankId: bank.id, method: 'check', checkNumber: 'AB-001' })
})
test('release rejects pending approval, missing actual completion, wrong evidence kind, and future dates', async () => {
  const c = await setup(), item = await preparedPayment(c)
  await assert.rejects(payments('manager', releaseRequest(c, item)), { code: 'failed-precondition' })
  await payments('owner', { action: 'approve', id: item.id, expectedVersion: 1, note: 'Independent review completed before transfer release.' })
  const before = structuredClone(ledger(c))
  await assert.rejects(payments('manager', releaseRequest(c, item, { confirmation: undefined })), { code: 'invalid-argument' })
  await assert.rejects(payments('manager', releaseRequest(c, item, { supportingDocuments: [supporting(c, 'payment_approval')] })), { code: 'invalid-argument' })
  await assert.rejects(payments('manager', releaseRequest(c, item, { releaseDate: '9999-12-31' })), { code: 'invalid-argument' })
  await assert.rejects(payments('manager', releaseRequest(c, item, { note: 'done' })), { code: 'invalid-argument' })
  assert.deepEqual(ledger(c), before); assert.equal(payment(c, item).status, 'approved')
})
test('completed transfer settles AP and credits the original bank line exactly once on retries', async () => {
  const c = await setup(), before = structuredClone(ledger(c)), item = await releasedPayment(c), stored = payment(c, item)
  assert.equal(ledger(c).books.entries.length, before.books.entries.length + 1)
  assert.equal(ledger(c).books.settlements.length, 1)
  assert.equal(outstanding(ledger(c).books, ledger(c).books.invoices[0]), 0)
  assert.equal(stored.cashLineId, `${stored.entryId}:1`)
  assert.deepEqual(ledger(c).books.entries.at(-1).lines, [{ account: '2000', debit: 10000, credit: 0 }, { account: '1010', debit: 0, credit: 10000 }])
  const after = structuredClone(ledger(c)), retry = await payments('manager', item.releaseRequest)
  assert.equal(retry.alreadyReleased, true); assert.equal(retry.settlementId, stored.settlementId); assert.deepEqual(ledger(c), after)
  assert.deepEqual(get(c.companyId, `paymentControl/invoice-${c.invoiceId}`).requests, {})
  await assert.rejects(payments('owner', { action: 'cancel', id: item.id, expectedVersion: stored.version, note: 'Cannot cancel actual completed payment.' }), { code: 'failed-precondition' })
})
test('released check requires its copy and explicit delivered-check confirmation; preparation is not release', async () => {
  const c = await setup(), item = await approvedPayment(c, { method: 'check', checkNumber: '001', supportingDocuments: [supporting(c, 'check_copy')] })
  assert.equal(ledger(c).books.settlements.length, 0)
  await assert.rejects(payments('manager', releaseRequest(c, item, { confirmation: 'transfer_completed', supportingDocuments: [] })), { code: 'invalid-argument' })
  await payments('manager', releaseRequest(c, item, { supportingDocuments: [] }))
  assert.equal(ledger(c).books.settlements.length, 1); assert.equal(payment(c, item).status, 'released')
})
test('stale books, closed periods, reconciled bank periods and changed bill balances fail without partial release', async () => {
  const c = await setup(), item = await approvedPayment(c), before = structuredClone(ledger(c)), request = releaseRequest(c, item)
  await assert.rejects(payments('manager', { ...request, expectedBooksRevision: 20 }), { code: 'aborted' })
  ledger(c).books.closedThrough = '2020-01-31'
  await assert.rejects(payments('manager', request), { code: 'invalid-argument' })
  ledger(c).books.closedThrough = ''
  set(c.companyId, 'bankControl/locks', { version: 1, accounts: { '1010': { bankId: c.bankId, statementId: 'approved', through: '2020-01-31' } } })
  await assert.rejects(payments('manager', request), { code: 'failed-precondition' })
  documents.delete(`companies/${c.companyId}/bankControl/locks`)
  assert.deepEqual(ledger(c), before)
  ledger(c).books = settle(ledger(c).books, c.invoiceId, 1, '2020-01-02', '1010', 'EXTERNAL-PAYMENT')
  await assert.rejects(payments('manager', request), { code: 'failed-precondition' })
  assert.equal(payment(c, item).status, 'approved')
})
test('missing or mismatched private evidence rejects preparation and release before any posting', async () => {
  const c = await setup(), file = supporting(c, 'payment_approval')
  await assert.rejects(preparedPayment(c, { supportingDocuments: [{ ...file, size: file.size + 1 }] }), { code: 'failed-precondition' })
  const item = await approvedPayment(c), request = releaseRequest(c, item), before = structuredClone(ledger(c))
  files.delete(request.supportingDocuments[0].path)
  await assert.rejects(payments('manager', request), { code: 'failed-precondition' })
  assert.deepEqual(ledger(c), before)
})
test('verified additional evidence is retained on request and settlement without another ledger posting', async () => {
  const c = await setup(), item = await releasedPayment(c), beforeEntries = structuredClone(ledger(c).books.entries), receipt = supporting(c, 'vendor_collection_receipt')
  const request = { action: 'attachDocuments', id: item.id, expectedVersion: payment(c, item).version, supportingDocuments: [receipt], note: 'Attached collection receipt issued by the paid supplier.' }
  await assert.rejects(payments('accountant', request), { code: 'permission-denied' })
  await payments('manager', request)
  assert.deepEqual(ledger(c).books.entries, beforeEntries)
  assert.equal(payment(c, item).supportingDocuments.length, 2); assert.equal(ledger(c).books.settlements[0].supportingDocuments.length, 2)
  assert.equal(get(c.companyId, `paymentRequestVersions/${item.id}-4`).changeAction, 'attachDocuments')
  await assert.rejects(payments('manager', { ...request, expectedVersion: 4, supportingDocuments: [{ ...receipt, kind: 'check_copy' }] }), { code: 'invalid-argument' })
})
test('clearance follows only the released cash line and current approved bank matches; reopening never posts cash', async () => {
  const c = await setup(), item = await releasedPayment(c), stored = payment(c, item), before = structuredClone(ledger(c))
  const statement = { id: 'statement', bankId: c.bankId, version: 1, status: 'draft', reference: 'BANK-1', rows: [{ id: 'row', date: '2020-01-03', amount: -6000 }], allocations: [{ bankRowId: 'row', bookLineId: stored.cashLineId, amount: 6000 }, { bankRowId: 'row', bookLineId: `${stored.entryId}:0`, amount: 10000 }] }
  set(c.companyId, 'bankStatements/statement', statement)
  assert.equal((await payments('accountant', { action: 'getClearance', id: item.id })).state, 'outstanding')
  statement.status = 'approved'; statement.version++
  const partial = await payments('accountant', { action: 'getClearance', id: item.id })
  assert.equal(partial.state, 'partially_cleared'); assert.equal(partial.clearedAmount, 6000)
  set(c.companyId, 'bankStatements/statement2', { ...statement, id: 'statement2', reference: 'BANK-2', rows: [{ id: 'row2', date: '2020-01-04', amount: -4000 }], allocations: [{ bankRowId: 'row2', bookLineId: stored.cashLineId, amount: 4000 }] })
  const full = await payments('accountant', { action: 'getClearance', id: item.id })
  assert.equal(full.state, 'cleared'); assert.equal(full.links.length, 2)
  statement.status = 'draft'
  assert.equal((await payments('accountant', { action: 'getClearance', id: item.id })).clearedAmount, 4000)
  assert.deepEqual(ledger(c), before)
})
test('reversed released payments are reported as reversed and cannot be released a second time', async () => {
  const c = await setup(), item = await releasedPayment(c), stored = payment(c, item)
  ledger(c).books = reverse(ledger(c).books, stored.entryId, '2020-01-03')
  const before = structuredClone(ledger(c))
  assert.equal((await payments('accountant', { action: 'getClearance', id: item.id })).state, 'reversed')
  assert.equal((await payments('manager', item.releaseRequest)).alreadyReleased, true)
  assert.deepEqual(ledger(c), before); assert.equal(outstanding(ledger(c).books, ledger(c).books.invoices[0]), 10000)
})
test('payment workflow browser/server contracts remain exact mirrors apart from local import paths', async () => {
  const fs = require('node:fs'), path = require('node:path')
  const front = fs.readFileSync(path.resolve(__dirname, '../../src/lib/payment-workflow.ts'), 'utf8').replace("'./accounting.ts'", "'./accounting-engine.js'").replace("'./bank-workflow.ts'", "'./bank-workflow.js'")
  assert.equal(fs.readFileSync(path.resolve(__dirname, '../src/payment-workflow.ts'), 'utf8'), front)
})
test('request keys cannot target object prototype names and multiline review notes are accepted', async () => {
  const c = await setup(), item = await preparedPayment(c, { notes: 'Reviewed original supplier bill.\nConfirmed planned transfer date.' })
  await assert.rejects(payments('accountant', { ...item.request, requestId: '__proto__' }), { code: 'invalid-argument' })
  await assert.rejects(payments('accountant', { ...item.request, requestId: 'constructor' }), { code: 'invalid-argument' })
  await payments('owner', { action: 'approve', id: item.id, expectedVersion: 1, note: 'Independently reviewed amount and supplier.\nTransfer authorized for release.' })
  assert.equal(payment(c, item).status, 'approved')
})
