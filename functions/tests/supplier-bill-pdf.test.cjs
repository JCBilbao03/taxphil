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
const { emptyBooks } = require('../lib/accounting-engine.js')
Module._load = originalLoad

const file = { path: 'companies/companyA/supplier-bills/upload_123', name: 'Supplier invoice.pdf', size: 4096, type: 'application/pdf' }
const bill = { kind: 'payable', partyId: 'vendor1', party: 'Untrusted typed supplier', reference: 'B-1', date: '2026-09-01', due: '2026-09-30', amount: 11200, account: '5900', taxTreatment: 'VAT12', supplierBillPdf: file }
function member(uid, companyId = 'companyA', role = 'admin') {
  const user = { uid, email: `${uid}@example.test`, emailVerified: true, disabled: false }; users.set(uid, user)
  const membership = { ...user, companyId, role, active: true }
  documents.set(`companyMemberships/${uid}`, membership)
  documents.set(`companies/${companyId}`, { profile: { vatStatus: 'vat' }, companyCode: companyId })
  documents.set(`companies/${companyId}/members/${uid}`, membership)
  documents.set(`companies/${companyId}/parties/vendor1`, { kind: 'vendor', active: true, registeredName: 'Saved supplier', tin: '123-456-789-00000', address: 'Makati' })
  documents.set(`companies/${companyId}/parties/customer1`, { kind: 'customer', active: true, registeredName: 'Saved customer', tin: '987-654-321-00000', address: 'Manila' })
}
function call(uid = 'alice', command = { type: 'addInvoice', input: bill }, expectedRevision = 0, tokenPatch = {}) {
  return companyAccountingCommand.run({ data: { command, expectedRevision }, auth: users.has(uid) ? { uid, token: { email: users.get(uid).email, email_verified: true, ...tokenPatch } } : undefined })
}
const saveBill = (patch = {}, uid = 'alice') => call(uid, { type: 'addInvoice', input: { ...bill, ...patch } })
beforeEach(() => {
  documents = new Map(); users = new Map(); objects = new Map(); metadataReads = []
  member('alice'); member('accountant', 'companyA', 'accountant'); member('viewer', 'companyA', 'viewer'); member('bob', 'companyB')
  for (const companyId of ['companyA', 'companyB']) documents.set(`companies/${companyId}/accounting/books`, { books: emptyBooks(), revision: 0, pendingCount: 0 })
  objects.set(file.path, { name: file.path, size: String(file.size), contentType: file.type })
})

test('real posting handler checks stored PDF metadata and preserves a saved supplier snapshot', async () => {
  const result = await saveBill()
  assert.equal(result.status, 'posted')
  const posted = documents.get('companies/companyA/accounting/books').books.invoices[0]
  assert.deepEqual(posted.supplierBillPdf, file)
  assert.equal(posted.party, 'Saved supplier')
  assert.equal(posted.partyTin, '123-456-789-00000')
  assert.deepEqual(metadataReads, [file.path])
})

test('foreign company documents and unsupported paths are rejected before storage access or ledger writes', async () => {
  const before = structuredClone(documents)
  await assert.rejects(saveBill({}, 'bob'), { code: 'invalid-argument' })
  for (const path of ['https://example.test/invoice.pdf', 'companies/companyA/evidence/file', 'companies/companyA/supplier-bills/../file', 'companies/companyB/supplier-bills/file']) {
    await assert.rejects(saveBill({ supplierBillPdf: { ...file, path } }), { code: 'invalid-argument' })
  }
  assert.deepEqual(documents, before)
  assert.deepEqual(metadataReads, [])
})

test('receivables, oversized or malformed attachments, and injected URL fields cannot be posted', async () => {
  const before = structuredClone(documents)
  await assert.rejects(saveBill({ kind: 'receivable', partyId: 'customer1', account: '4100' }), { code: 'invalid-argument' })
  for (const patch of [{ size: 10 * 1024 * 1024 + 1 }, { size: 0 }, { size: 1.5 }, { type: 'image/png' }, { name: '../supplier.pdf' }, { name: 'x'.repeat(201) }, { url: 'https://example.test/bill.pdf' }]) {
    await assert.rejects(saveBill({ supplierBillPdf: { ...file, ...patch } }), { code: 'invalid-argument' })
  }
  assert.deepEqual(documents, before)
  assert.deepEqual(metadataReads, [])
})

test('missing PDF objects and stored size, name, or MIME mismatches prevent both immediate posting and preparation', async () => {
  const before = structuredClone(documents)
  for (const uid of ['alice', 'accountant']) {
    objects.delete(file.path)
    await assert.rejects(saveBill({}, uid), { code: 'failed-precondition' })
    for (const patch of [{ size: '4097' }, { contentType: 'text/html' }, { name: 'companies/companyB/supplier-bills/file' }]) {
      objects.set(file.path, { name: file.path, size: String(file.size), contentType: file.type, ...patch })
      await assert.rejects(saveBill({}, uid), { code: 'failed-precondition' })
    }
  }
  assert.deepEqual(documents, before)
})

test('preparation stores source PDF metadata and approval rechecks and preserves it', async () => {
  const pending = await saveBill({}, 'accountant')
  const draft = documents.get(`companies/companyA/approvals/${pending.pendingId}`)
  assert.deepEqual(draft.command.input.supplierBillPdf, file)
  assert.equal(documents.get('companies/companyA/accounting/books').books.invoices.length, 0)
  const approved = await call('alice', { type: 'approve', input: { pendingId: pending.pendingId } }, 1)
  assert.equal(approved.status, 'approved')
  assert.deepEqual(metadataReads, [file.path, file.path])
  assert.deepEqual(documents.get('companies/companyA/accounting/books').books.invoices[0].supplierBillPdf, file)
})

test('approval cannot post a source removed after preparation; reviewer can still reject it', async () => {
  const pending = await saveBill({}, 'accountant')
  const before = structuredClone(documents)
  objects.delete(file.path)
  await assert.rejects(call('alice', { type: 'approve', input: { pendingId: pending.pendingId } }, 1), { code: 'failed-precondition' })
  assert.deepEqual(documents, before)
  const rejected = await call('alice', { type: 'reject', input: { pendingId: pending.pendingId, reason: 'Source document no longer available.' } }, 1)
  assert.equal(rejected.status, 'rejected')
  assert.equal(documents.get('companies/companyA/accounting/books').books.invoices.length, 0)
})

test('attachment checks retain current verified identity and active writer membership restrictions', async () => {
  const before = structuredClone(documents)
  await assert.rejects(saveBill({}, 'viewer'), { code: 'permission-denied' })
  await assert.rejects(call('missing'), { code: 'unauthenticated' })
  await assert.rejects(call('alice', undefined, 0, { email: 'stale@example.test' }), { code: 'permission-denied' })
  users.get('alice').disabled = true
  await assert.rejects(saveBill(), { code: 'permission-denied' })
  assert.deepEqual(documents, before)
  assert.deepEqual(metadataReads, [])
})

test('legacy bills remain optional and need no document storage call', async () => {
  const { supplierBillPdf: _, ...legacyBill } = bill
  await call('alice', { type: 'addInvoice', input: legacyBill })
  assert.equal(documents.get('companies/companyA/accounting/books').books.invoices[0].supplierBillPdf, undefined)
  assert.deepEqual(metadataReads, [])
})
