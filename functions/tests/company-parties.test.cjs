const { test, beforeEach } = require('node:test')
const assert = require('node:assert/strict')
const { randomUUID } = require('node:crypto')
const Module = require('node:module')
let documents; let users
const reference = path => ({ path, id: path.split('/').at(-1), collection: name => ({ doc: (id = randomUUID()) => reference(`${path}/${name}/${id}`) }) })
const snap = ref => ({ id: ref.id, exists: documents.has(ref.path), data: () => structuredClone(documents.get(ref.path)), get: field => documents.get(ref.path)?.[field] })
const db = { doc: reference, async runTransaction(fn) {
  const writes = []
  const result = await fn({
    async get(ref) { assert.equal(writes.length, 0); return snap(ref) },
    async getAll(...refs) { assert.equal(writes.length, 0); return refs.map(snap) },
    create(ref, value) { assert.ok(!documents.has(ref.path)); writes.push([ref.path, structuredClone(value)]) },
    set(ref, value) { writes.push([ref.path, structuredClone(value)]) },
    update(ref, value) { writes.push([ref.path, { ...documents.get(ref.path), ...structuredClone(value) }]) },
    delete(ref) { writes.push([ref.path, null]) },
  })
  for (const [path, value] of writes) { if (value === null) documents.delete(path); else documents.set(path, value) }
  return result
} }
const originalLoad = Module._load
Module._load = function (name, ...args) {
  if (name === 'firebase-admin/auth') return { getAuth: () => ({ getUser: async uid => users.get(uid) }) }
  if (name === 'firebase-admin/firestore') return { getFirestore: () => db }
  return originalLoad.call(this, name, ...args)
}
const api = require('../lib/company-parties.js')
Module._load = originalLoad
const value = { kind: 'vendor', registeredName: 'Example Trading', tin: '123-456-789', address: 'Makati', email: '', defaultAtc: '', notes: '', active: true }
function member(uid, companyId = 'companyA', role = 'admin') {
  const user = { uid, email: `${uid}@example.test`, emailVerified: true, disabled: false }; users.set(uid, user)
  const membership = { ...user, companyId, role, active: true }
  documents.set(`companyMemberships/${uid}`, membership); documents.set(`companies/${companyId}`, { companyCode: companyId }); documents.set(`companies/${companyId}/members/${uid}`, membership)
}
const call = (uid = 'alice', patch = {}) => api.companyPartySave.run({ data: { expectedVersion: 0, value, ...patch }, auth: users.has(uid) ? { uid, token: { email: users.get(uid).email, email_verified: true } } : undefined })
beforeEach(() => { documents = new Map(); users = new Map(); member('alice'); member('accountant', 'companyA', 'accountant'); member('viewer', 'companyA', 'viewer'); member('bob', 'companyB') })

test('requires current verified membership and a writer role', async () => {
  await assert.rejects(call('missing'), { code: 'unauthenticated' })
  await assert.rejects(call('viewer', { role: 'admin' }), { code: 'permission-denied' })
  users.get('alice').emailVerified = false; await assert.rejects(call('alice'), { code: 'permission-denied' })
  const saved = await call('accountant')
  assert.equal(documents.get(`companies/companyA/parties/${saved.id}`).createdBy, 'accountant')
})

test('duplicate normalized TIN is blocked within one kind and company, including archived records', async () => {
  const first = await call()
  await assert.rejects(call('accountant', { value: { ...value, tin: '123456789000' } }), { code: 'already-exists' })
  await call('alice', { id: first.id, expectedVersion: 1, value: { ...value, active: false } })
  await assert.rejects(call(), { code: 'already-exists' })
  const customer = await call('alice', { value: { ...value, kind: 'customer' } }); assert.notEqual(customer.id, first.id)
  const other = await call('bob', { companyId: 'companyA' }); assert.ok(documents.has(`companies/companyB/parties/${other.id}`))
})

test('stale versions and cross-company record edits cannot overwrite the directory', async () => {
  const first = await call()
  const before = structuredClone(documents)
  await assert.rejects(call('alice', { id: first.id, expectedVersion: 0 }), { code: 'aborted' })
  await assert.rejects(call('bob', { id: first.id, expectedVersion: 1 }), { code: 'not-found' })
  await assert.rejects(call('alice', { id: first.id, expectedVersion: 1, value: { ...value, kind: 'customer' } }), { code: 'invalid-argument' })
  assert.deepEqual(documents, before)
})

test('TIN corrections move the unique index atomically and append a company audit event', async () => {
  const first = await call()
  await call('alice', { id: first.id, expectedVersion: 1, value: { ...value, tin: '987654321' } })
  assert.equal(documents.has('companies/companyA/partyTinIndex/vendor_12345678900000'), false)
  assert.equal(documents.get('companies/companyA/partyTinIndex/vendor_98765432100000').partyId, first.id)
  assert.equal(documents.get(`companies/companyA/parties/${first.id}`).version, 2)
  assert.equal([...documents.keys()].filter(path => path.startsWith('companies/companyA/audit/')).length, 2)
  await call('accountant')
})

test('missing TIN and invalid directory fields fail without partial writes', async () => {
  const before = structuredClone(documents)
  await assert.rejects(call('alice', { value: { ...value, tin: '' } }), { code: 'invalid-argument' })
  await assert.rejects(call('alice', { value: { ...value, kind: 'customer', address: '' } }), { code: 'invalid-argument' })
  assert.deepEqual(documents, before)
})
