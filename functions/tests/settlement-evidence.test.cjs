const { test, beforeEach } = require('node:test')
const assert = require('node:assert/strict')
const { randomUUID } = require('node:crypto')
const Module = require('node:module')
let documents; let users; let objects; let metadataReads
const reference = path => ({ path, id: path.split('/').at(-1), collection: name => ({ doc: (id = randomUUID()) => reference(`${path}/${name}/${id}`) }) })
const snap = ref => ({ id: ref.id, exists: documents.has(ref.path), data: () => structuredClone(documents.get(ref.path)), get: field => documents.get(ref.path)?.[field] })
const db = { doc: reference, async runTransaction(fn) {
  const writes = []
  const result = await fn({
    async get(ref) { assert.equal(writes.length, 0); return snap(ref) },
    async getAll(...refs) { assert.equal(writes.length, 0); return refs.map(snap) },
    create(ref, value) { assert.ok(!documents.has(ref.path)); writes.push([ref.path, structuredClone(value)]) },
    update(ref, value) { assert.ok(documents.has(ref.path)); writes.push([ref.path, { ...documents.get(ref.path), ...structuredClone(value) }]) },
  })
  for (const [path, value] of writes) documents.set(path, value)
  return result
} }
const originalLoad = Module._load
Module._load = function (name, ...args) {
  if (name === 'firebase-admin/auth') return { getAuth: () => ({ getUser: async uid => users.get(uid) }) }
  if (name === 'firebase-admin/firestore') return { getFirestore: () => db }
  if (name === 'firebase-admin/storage') return { getStorage: () => ({ bucket: () => ({ file: path => ({ async getMetadata() {
    metadataReads.push(path)
    if (!objects.has(path)) throw Object.assign(new Error('Not found'), { code: 404 })
    return [structuredClone(objects.get(path))]
  } }) }) }) }
  return originalLoad.call(this, name, ...args)
}
const { companyAccountingCommand } = require('../lib/company-accounting.js')
const { addInvoice, emptyBooks } = require('../lib/accounting-engine.js')
Module._load = originalLoad
const approval = { path: 'companies/companyA/settlement-evidence/approval_1', name: 'Payment approval.pdf', size: 4096, type: 'application/pdf', kind: 'payment_approval' }
const wire = { path: 'companies/companyA/settlement-evidence/wire_1', name: 'Bank transfer.png', size: 2048, type: 'image/png', kind: 'transfer_confirmation' }
const deposit = { path: 'companies/companyA/settlement-evidence/deposit_1', name: 'Deposit slip.jpeg', size: 8192, type: 'image/jpeg', kind: 'deposit_slip' }
const booksAt = (companyId = 'companyA') => documents.get(`companies/${companyId}/accounting/books`)
function member(uid, companyId = 'companyA', role = 'admin') {
  const user = { uid, email: `${uid}@example.test`, emailVerified: true, disabled: false }; users.set(uid, user)
  const membership = { ...user, companyId, role, active: true }
  documents.set(`companyMemberships/${uid}`, membership)
  documents.set(`companies/${companyId}`, { profile: { vatStatus: 'vat' }, companyCode: companyId })
  documents.set(`companies/${companyId}/members/${uid}`, membership)
}
function call({ uid = 'alice', invoiceKind = 'payable', patch = {}, supportingDocuments = [approval, wire], expectedRevision = booksAt().revision, tokenPatch = {} } = {}) {
  const invoice = booksAt().books.invoices.find(item => item.kind === invoiceKind)
  const input = { invoiceId: invoice.id, amount: 1000, date: '2026-09-02', cash: '1010', reference: 'PAY-1', supportingDocuments, ...patch }
  return companyAccountingCommand.run({ data: { command: { type: 'settle', input }, expectedRevision }, auth: users.has(uid) ? { uid, token: { email: users.get(uid).email, email_verified: true, ...tokenPatch } } : undefined })
}
function append({ uid = 'alice', supportingDocuments = [wire], settlementId = booksAt().books.settlements[0].id, expectedRevision = booksAt().revision, tokenPatch = {} } = {}) {
  return companyAccountingCommand.run({ data: { command: { type: 'attachSettlementDocuments', input: { settlementId, supportingDocuments } }, expectedRevision }, auth: users.has(uid) ? { uid, token: { email: users.get(uid).email, email_verified: true, ...tokenPatch } } : undefined })
}
beforeEach(() => {
  documents = new Map(); users = new Map(); objects = new Map(); metadataReads = []
  member('alice'); member('manager', 'companyA', 'manager'); member('accountant', 'companyA', 'accountant'); member('viewer', 'companyA', 'viewer'); member('bob', 'companyB')
  for (const companyId of ['companyA', 'companyB']) {
    let books = emptyBooks()
    for (const kind of ['payable', 'receivable']) books = addInvoice(books, { kind, party: kind === 'payable' ? 'Supplier' : 'Customer', reference: `${companyId}-${kind}`, date: '2026-09-01', due: '2026-09-30', amount: 11200, account: kind === 'payable' ? '5900' : '4100' })
    documents.set(`companies/${companyId}/accounting/books`, { books, revision: 0, pendingCount: 0 })
  }
  for (const file of [approval, wire, deposit]) objects.set(file.path, { name: file.path, size: String(file.size), contentType: file.type })
})

test('real handler verifies PDF and PNG objects and stores evidence on the individual partial payment', async () => {
  const source = structuredClone(booksAt().books.invoices)
  const result = await call()
  assert.equal(result.status, 'posted')
  assert.deepEqual(booksAt().books.settlements[0].supportingDocuments, [approval, wire])
  await call({ uid: 'manager', supportingDocuments: [wire], patch: { reference: 'PAY-2', amount: 2000 } })
  assert.deepEqual(booksAt().books.settlements[1].supportingDocuments, [wire])
  assert.deepEqual(booksAt().books.settlements[0].supportingDocuments, [approval, wire])
  assert.deepEqual(booksAt().books.invoices, source)
  assert.deepEqual(metadataReads.sort(), [approval.path, wire.path, wire.path].sort())
})

test('receipt evidence accepts JPEGs and derives allowed categories from the stored invoice kind', async () => {
  const before = structuredClone(documents)
  await assert.rejects(call({ invoiceKind: 'receivable', supportingDocuments: [approval], patch: { kind: 'payable' } }), { code: 'invalid-argument' })
  await assert.rejects(call({ supportingDocuments: [deposit], patch: { kind: 'receivable' } }), { code: 'invalid-argument' })
  assert.deepEqual(documents, before)
  assert.deepEqual(metadataReads, [])
  await call({ invoiceKind: 'receivable', supportingDocuments: [deposit, wire] })
  assert.deepEqual(booksAt().books.settlements[0].supportingDocuments, [deposit, wire])
  assert.equal(booksAt().books.entries.at(-1).source, 'receipt')
})

test('foreign company paths or invoice IDs cannot attach evidence or alter books', async () => {
  const before = structuredClone(documents)
  await assert.rejects(call({ supportingDocuments: [{ ...approval, path: 'companies/companyB/settlement-evidence/file' }] }), { code: 'invalid-argument' })
  await assert.rejects(call({ patch: { invoiceId: booksAt('companyB').books.invoices[0].id } }), { code: 'failed-precondition' })
  await assert.rejects(call({ uid: 'bob', patch: { invoiceId: booksAt('companyB').books.invoices[0].id } }), { code: 'invalid-argument' })
  assert.deepEqual(documents, before)
  assert.deepEqual(metadataReads, [])
})

test('invalid paths, oversized files, unsafe filenames, external URLs, duplicates and excess files are rejected atomically', async () => {
  const before = structuredClone(documents)
  for (const patch of [{ path: 'https://example.test/file.pdf' }, { path: 'companies/companyA/settlement-evidence/../file' }, { path: 'companies/companyA/supplier-bills/file' }, { size: 0 }, { size: 1.5 }, { size: 10 * 1024 * 1024 + 1 }, { type: 'text/html' }, { name: '../approval.pdf' }, { name: 'wrong.png' }, { url: 'https://example.test/file.pdf' }]) {
    await assert.rejects(call({ supportingDocuments: [{ ...approval, ...patch }] }), { code: 'invalid-argument' })
  }
  await assert.rejects(call({ supportingDocuments: [approval, approval] }), { code: 'invalid-argument' })
  await assert.rejects(call({ supportingDocuments: Array.from({ length: 11 }, (_, i) => ({ ...approval, path: `companies/companyA/settlement-evidence/file_${i}` })) }), { code: 'invalid-argument' })
  await assert.rejects(call({ supportingDocuments: null }), { code: 'invalid-argument' })
  assert.deepEqual(documents, before)
  assert.deepEqual(metadataReads, [])
})

test('a missing or mismatched object prevents the whole payment when the other attachments are valid', async () => {
  const before = structuredClone(documents)
  objects.delete(wire.path)
  await assert.rejects(call(), { code: 'failed-precondition' })
  for (const patch of [{ size: '2049' }, { contentType: 'image/jpeg' }, { name: 'companies/companyB/settlement-evidence/wire_1' }]) {
    objects.set(wire.path, { name: wire.path, size: String(wire.size), contentType: wire.type, ...patch })
    await assert.rejects(call(), { code: 'failed-precondition' })
  }
  assert.deepEqual(documents, before)
})

test('only active administrators and managers with current verified identity can record payments with evidence', async () => {
  const before = structuredClone(documents)
  for (const uid of ['viewer', 'accountant']) await assert.rejects(call({ uid }), { code: 'permission-denied' })
  await assert.rejects(call({ uid: 'missing' }), { code: 'unauthenticated' })
  await assert.rejects(call({ tokenPatch: { email: 'stale@example.test' } }), { code: 'permission-denied' })
  users.get('alice').disabled = true
  await assert.rejects(call(), { code: 'permission-denied' })
  assert.deepEqual(documents, before)
  assert.deepEqual(metadataReads, [])
  users.get('alice').disabled = false
  documents.get('companies/companyA/members/alice').active = false
  await assert.rejects(call(), { code: 'permission-denied' })
})

test('stale revisions, overpayments, and closed dates remain atomic with supporting documents', async () => {
  const before = structuredClone(documents)
  await assert.rejects(call({ expectedRevision: 3 }), { code: 'aborted' })
  await assert.rejects(call({ patch: { amount: 11201 } }), { code: 'failed-precondition' })
  assert.deepEqual(documents, before)
  booksAt().books.closedThrough = '2026-09-03'
  const closed = structuredClone(documents)
  await assert.rejects(call(), { code: 'failed-precondition' })
  assert.deepEqual(documents, closed)
})

test('legacy settlements without supporting documents need no storage access', async () => {
  await call({ patch: { supportingDocuments: undefined } })
  assert.equal(booksAt().books.settlements[0].supportingDocuments, undefined)
  await call({ supportingDocuments: [], patch: { reference: 'PAY-2' } })
  assert.deepEqual(booksAt().books.settlements[1].supportingDocuments, [])
  assert.deepEqual(metadataReads, [])
})

test('late documents append to a fully paid closed-period record without changing amounts, ledger, or source evidence', async () => {
  await call({ supportingDocuments: [approval], patch: { amount: 11200 } })
  booksAt().books.closedThrough = '2026-09-03'
  const before = structuredClone(booksAt().books)
  const result = await append({ uid: 'manager' })
  assert.equal(result.revision, 2)
  assert.equal(result.status, 'posted')
  assert.deepEqual(booksAt().books.settlements[0].supportingDocuments, [approval, wire])
  assert.deepEqual(booksAt().books.entries, before.entries)
  assert.deepEqual(booksAt().books.invoices, before.invoices)
  assert.equal(booksAt().books.closedThrough, before.closedThrough)
  assert.deepEqual({ ...booksAt().books.settlements[0], supportingDocuments: undefined }, { ...before.settlements[0], supportingDocuments: undefined })
  const audit = [...documents.entries()].filter(([path]) => path.startsWith('companies/companyA/audit/')).map(([, value]) => value).find(value => value.action === 'accounting.attachSettlementDocuments')
  assert.equal(audit.actorUid, 'manager')
  assert.equal(audit.settlementId, before.settlements[0].id)
  assert.deepEqual(audit.documentPaths, [wire.path])
  assert.deepEqual(audit.entryIds, [])
})

test('append enforces company, settlement ownership, original invoice kind, current identity and settlement permissions', async () => {
  await call({ supportingDocuments: [approval] })
  const before = structuredClone(documents)
  await assert.rejects(append({ supportingDocuments: [deposit] }), { code: 'invalid-argument' })
  await assert.rejects(append({ supportingDocuments: [{ ...wire, path: 'companies/companyB/settlement-evidence/wire' }] }), { code: 'invalid-argument' })
  await assert.rejects(append({ settlementId: 'missing' }), { code: 'failed-precondition' })
  await assert.rejects(append({ uid: 'bob', expectedRevision: 0 }), { code: 'failed-precondition' })
  for (const uid of ['accountant', 'viewer']) await assert.rejects(append({ uid }), { code: 'permission-denied' })
  await assert.rejects(append({ tokenPatch: { email: 'stale@example.test' } }), { code: 'permission-denied' })
  assert.deepEqual(documents, before)
})

test('append preserves all original evidence on duplicate paths, empty additions, stale revision, or combined count overflow', async () => {
  await call()
  const before = structuredClone(documents)
  await assert.rejects(append({ supportingDocuments: [] }), { code: 'invalid-argument' })
  await assert.rejects(append({ supportingDocuments: [approval] }), { code: 'failed-precondition' })
  await assert.rejects(append({ expectedRevision: 0 }), { code: 'aborted' })
  const nine = Array.from({ length: 9 }, (_, index) => ({ ...wire, path: `companies/companyA/settlement-evidence/new_${index}` }))
  for (const file of nine) objects.set(file.path, { name: file.path, size: String(file.size), contentType: file.type })
  await assert.rejects(append({ supportingDocuments: nine }), { code: 'failed-precondition' })
  assert.deepEqual(documents, before)
})

test('append verifies each new object and keeps existing documents when a late upload is missing', async () => {
  await call({ supportingDocuments: [approval] })
  const before = structuredClone(documents)
  objects.delete(wire.path)
  await assert.rejects(append(), { code: 'failed-precondition' })
  assert.deepEqual(documents, before)
  objects.set(wire.path, { name: wire.path, size: String(wire.size + 1), contentType: wire.type })
  await assert.rejects(append(), { code: 'failed-precondition' })
  assert.deepEqual(documents, before)
})
