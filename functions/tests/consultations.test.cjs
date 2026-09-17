const { test, beforeEach } = require('node:test')
const assert = require('node:assert/strict')
const { randomUUID } = require('node:crypto')
const Module = require('node:module')

// Real callables, in-memory transaction/Auth doubles; no live customer writes.
let documents = new Map()
let users = new Map()
const reference = path => ({ path, id: path.split('/').at(-1), collection: name => ({ doc: (id = randomUUID()) => reference(`${path}/${name}/${id}`) }) })
const db = { doc: reference, async runTransaction(fn) {
  const writes = []
  const result = await fn({
    async get(ref) { assert.equal(writes.length, 0, 'read before writing'); return { id: ref.id, exists: documents.has(ref.path), data: () => structuredClone(documents.get(ref.path)) } },
    create(ref, value) { assert.ok(!documents.has(ref.path)); writes.push([ref.path, structuredClone(value)]) },
    set(ref, value) { writes.push([ref.path, structuredClone(value)]) },
  })
  for (const [path, value] of writes) documents.set(path, value)
  return result
} }
const originalLoad = Module._load
Module._load = function (name, ...args) {
  if (name === 'firebase-admin/auth') return { getAuth: () => ({ getUser: async uid => users.get(uid) }) }
  if (name === 'firebase-admin/firestore') return { getFirestore: () => db }
  return originalLoad.call(this, name, ...args)
}
const api = require('../lib/consultations.js')
Module._load = originalLoad
const details = () => ({ kind: 'individual', topic: 'VAT review', notes: '', preferredAt: new Date(Date.now() + 86_400_000).toISOString(), durationMinutes: 30, participants: 1 })
function user(uid, extra = {}) { users.set(uid, { uid, email: `${uid}@example.test`, displayName: uid, emailVerified: true, disabled: false, ...extra }) }
function call(name, uid, data, extraClaims = {}) { return api[name].run({ data, auth: users.has(uid) ? { uid, token: { email_verified: true, ...extraClaims } } : undefined }) }
async function create(uid = 'alice', requestId = randomUUID(), input = details()) { const result = await call('consultationCreate', uid, { requestId, details: input }); return documents.get(`consultations/${result.id}`) }
const confirmation = () => ({ type: 'confirm', scheduledAt: new Date(Date.now() + 2 * 86_400_000).toISOString(), advisorName: 'Advisor A', meetingUrl: 'https://meet.google.com/abc-defg-hij', responseNote: '' })
beforeEach(() => { documents = new Map(); users = new Map(); user('alice'); user('bob'); user('staff', { customClaims: { admin: true } }) })

test('requires a verified active account and ignores caller-supplied owner/status', async () => {
  const payload = { requestId: randomUUID(), details: details() }
  await assert.rejects(call('consultationCreate', 'missing', payload), { code: 'unauthenticated' })
  user('alice', { emailVerified: false }); await assert.rejects(call('consultationCreate', 'alice', payload), { code: 'permission-denied' })
  user('alice', { disabled: true }); await assert.rejects(call('consultationCreate', 'alice', payload), { code: 'permission-denied' })
  user('alice'); await assert.rejects(call('consultationCreate', 'alice', payload, { email_verified: false }), { code: 'permission-denied' })
  const record = await create('alice', randomUUID(), { ...details(), ownerUid: 'bob', status: 'confirmed', meetingUrl: 'https://evil.test/meeting' })
  assert.equal(record.ownerUid, 'alice'); assert.equal(record.status, 'requested'); assert.equal(record.meetingUrl, null)
})

test('creation is idempotent for the same payload and scoped to the owner', async () => {
  const id = randomUUID(); const input = details()
  await create('alice', id, input); await create('alice', id, input)
  assert.equal(documents.get('consultationLimits/alice').timestamps.length, 1)
  assert.equal([...documents.keys()].filter(path => path.startsWith(`consultations/${id}/history/`)).length, 1)
  await assert.rejects(create('bob', id, input), { code: 'permission-denied' })
  await assert.rejects(create('alice', id, { ...input, topic: 'Changed' }), { code: 'already-exists' })
})

test('per-user daily request limit is enforced without affecting other customers', async () => {
  for (let index = 0; index < 5; index++) await create()
  await assert.rejects(create(), { code: 'resource-exhausted' })
  assert.equal((await create('bob')).ownerUid, 'bob')
})

test('ownership and fresh server admin claims protect changes despite spoofed token/data roles', async () => {
  const record = await create()
  const data = { id: record.id, revision: 0, action: confirmation(), admin: true }
  await assert.rejects(call('consultationUpdate', 'bob', data, { admin: true }), { code: 'permission-denied' })
  await assert.rejects(call('consultationUpdate', 'alice', data, { admin: true }), { code: 'failed-precondition' })
  user('staff', { customClaims: { admin: false } })
  await assert.rejects(call('consultationUpdate', 'staff', data, { admin: true }), { code: 'permission-denied' })
  assert.equal(documents.get(`consultations/${record.id}`).status, 'requested')
})

test('admin confirms, stale edits fail, cancellation closes access and each transition is audited', async () => {
  const record = await create()
  await call('consultationUpdate', 'staff', { id: record.id, revision: 0, action: confirmation() })
  assert.equal(documents.get(`consultations/${record.id}`).status, 'confirmed')
  await assert.rejects(call('consultationUpdate', 'staff', { id: record.id, revision: 0, action: confirmation() }), { code: 'aborted' })
  await call('consultationUpdate', 'alice', { id: record.id, revision: 1, action: { type: 'cancel', responseNote: '' } })
  assert.equal(documents.get(`consultations/${record.id}`).meetingUrl, null)
  await assert.rejects(call('consultationUpdate', 'staff', { id: record.id, revision: 2, action: confirmation() }), { code: 'failed-precondition' })
  assert.equal([...documents.keys()].filter(path => path.startsWith(`consultations/${record.id}/history/`)).length, 3)
})

test('invalid requests and meeting links cannot persist partial state', async () => {
  await assert.rejects(create('alice', randomUUID(), { ...details(), participants: 500 }), { code: 'invalid-argument' })
  assert.equal(documents.size, 0)
  const record = await create()
  const before = structuredClone(documents)
  await assert.rejects(call('consultationUpdate', 'staff', { id: record.id, revision: 0, action: { ...confirmation(), meetingUrl: 'javascript:alert(1)' } }), { code: 'failed-precondition' })
  assert.deepEqual(documents, before)
})
