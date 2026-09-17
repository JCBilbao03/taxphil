const { test, beforeEach } = require('node:test')
const assert = require('node:assert/strict')
const { randomUUID } = require('node:crypto')
const Module = require('node:module')

// Execute the real callable handlers against a transaction double. This checks
// authorization and command behavior without contacting a Firebase project.
// Deployment still requires Firestore/Auth emulator and live integration checks.
let documents = new Map()
let users = new Map()
const reference = path => ({ path, id: path.split('/').at(-1), collection: name => collection(`${path}/${name}`) })
const collection = path => ({ doc: (documentId = randomUUID()) => reference(`${path}/${documentId}`) })
const snapshot = ref => ({ exists: documents.has(ref.path), data: () => structuredClone(documents.get(ref.path)), get: field => documents.get(ref.path)?.[field] })
const db = {
  doc: reference, collection,
  async runTransaction(fn) {
    const writes = []
    const tx = {
      async get(ref) { assert.equal(writes.length, 0, 'transactions must read before writing'); return snapshot(ref) },
      async getAll(...refs) { assert.equal(writes.length, 0, 'transactions must read before writing'); return refs.map(snapshot) },
      create(ref, value) { assert.ok(!documents.has(ref.path)); writes.push([ref.path, structuredClone(value)]) },
      update(ref, value) { assert.ok(documents.has(ref.path)); writes.push([ref.path, { ...structuredClone(documents.get(ref.path)), ...structuredClone(value) }]) },
    }
    const result = await fn(tx)
    for (const [path, value] of writes) documents.set(path, value)
    return result
  },
}
const originalLoad = Module._load
Module._load = function (name, ...args) {
  if (name === 'firebase-admin/auth') return { getAuth: () => ({ getUser: async uid => users.get(uid) }) }
  if (name === 'firebase-admin/firestore') return { getFirestore: () => db }
  return originalLoad.call(this, name, ...args)
}
const api = require('../lib/company-accounting.js')
Module._load = originalLoad

const profile = {
  registeredName: 'Test Trading', tin: '123-456-789', branchCode: '00000', rdo: '044', registeredAddress: 'Makati City',
  entityType: 'sole_proprietor', vatStatus: 'vat', incomeTaxRegime: 'graduated', fiscalYearEnd: '12-31', reportingFramework: 'pfrs_small',
  withholdingAgent: false, hasEmployees: false, casRegistrationReference: '', invoiceSeries: 'INV', secRegistrationNumber: '', businessNature: 'Trading', accountantReviewRequired: true,
}
function user(uid, changes = {}) { const value = { uid, email: `${uid}@example.com`, emailVerified: true, disabled: false, ...changes }; users.set(uid, value); return value }
function call(name, uid, data) { const u = users.get(uid); return api[name].run({ data, auth: u ? { uid, token: { email: u.email, email_verified: u.emailVerified } } : undefined }) }
const state = companyId => documents.get(`companies/${companyId}/accounting/books`)
const journal = (reference = 'J1') => ({ type: 'post', input: { date: '2026-01-02', reference, description: 'Capital contribution', source: 'journal', lines: [{ account: '1010', debit: 11200, credit: 0 }, { account: '3000', debit: 0, credit: 11200 }] } })
const invoice = (extra = {}) => ({ type: 'addInvoice', input: { kind: 'receivable', partyId:extra.kind==='payable'?'vendor1':'customer1', party: 'Example Customer', reference: 'I1', date: '2026-01-02', due: '2026-01-31', amount: 11200, account: '4000', taxTreatment: 'VAT12', ...extra } })
async function setup() { user('owner'); const company=await call('companyCreate', 'owner', { profile }); for(const kind of ['vendor','customer'])documents.set(`companies/${company.companyId}/parties/${kind}1`,{kind,registeredName:`Saved ${kind}`,tin:'123-456-789-00000',address:'Makati City',active:true});return company }
async function invite(uid, role, companyCode) {
  const u = user(uid)
  const result = await call('companyInvite', 'owner', { email: u.email, role })
  await call('companyJoin', uid, { companyCode, inviteCode: result.inviteCode })
  return result
}
beforeEach(() => { documents = new Map(); users = new Map() })

test('requires verified current identity, and creates one company per user', async () => {
  await assert.rejects(call('companyCreate', 'missing', { profile }), { code: 'unauthenticated' })
  user('unverified', { emailVerified: false })
  await assert.rejects(call('companyCreate', 'unverified', { profile }), { code: 'permission-denied' })
  user('disabled', { disabled: true })
  await assert.rejects(call('companyCreate', 'disabled', { profile }), { code: 'permission-denied' })
  const company = await setup()
  assert.match(company.companyCode, /^PH-[A-F0-9]{10}$/)
  assert.equal(state(company.companyId).revision, 0)
  await assert.rejects(call('companyCreate', 'owner', { profile }), { code: 'already-exists' })
  const member = documents.get('companyMemberships/owner')
  documents.set('companyMemberships/owner', { ...member, active: false })
  await assert.rejects(call('companyCreate', 'owner', { profile }), { code: 'already-exists' })
  await assert.rejects(call('companyAccountingCommand', 'owner', { command: journal(), expectedRevision: 0 }), { code: 'permission-denied' })
})

test('invitation tokens are hashed, email-scoped, expiring and single-use', async () => {
  const company = await setup()
  user('target'); user('intruder')
  const result = await call('companyInvite', 'owner', { email: 'target@example.com', role: 'accountant' })
  assert.ok(!JSON.stringify([...documents.entries()]).includes(result.inviteCode))
  await assert.rejects(call('companyJoin', 'intruder', { companyCode: company.companyCode, inviteCode: result.inviteCode }), { code: 'permission-denied' })
  await assert.rejects(call('companyJoin', 'target', { companyCode: company.companyCode, inviteCode: company.companyCode }), { code: 'permission-denied' })
  await call('companyJoin', 'target', { companyCode: company.companyCode, inviteCode: result.inviteCode })
  await assert.rejects(call('companyJoin', 'target', { companyCode: company.companyCode, inviteCode: result.inviteCode }), { code: 'already-exists' })
  user('late')
  const late = await call('companyInvite', 'owner', { email: 'late@example.com', role: 'viewer' })
  const [path, value] = [...documents.entries()].find(([p, d]) => p.includes('/invitations/') && d.email === 'late@example.com')
  documents.set(path, { ...value, expiresAt: '2020-01-01T00:00:00.000Z' })
  await assert.rejects(call('companyJoin', 'late', { companyCode: company.companyCode, inviteCode: late.inviteCode }), { code: 'permission-denied' })
})

test('accountants prepare, managers approve, and an author cannot approve their own draft after promotion', async () => {
  const company = await setup()
  await invite('accountant', 'accountant', company.companyCode)
  const draft = await call('companyAccountingCommand', 'accountant', { command: journal(), expectedRevision: 0 })
  assert.equal(draft.status, 'pending')
  assert.equal(state(company.companyId).books.entries.length, 0)
  await assert.rejects(call('companyAccountingCommand', 'accountant', { command: { type: 'approve', pendingId: draft.pendingId }, expectedRevision: 1 }), { code: 'permission-denied' })
  await call('companySetMemberRole', 'owner', { uid: 'accountant', role: 'manager', active: true })
  await assert.rejects(call('companyAccountingCommand', 'accountant', { command: { type: 'approve', pendingId: draft.pendingId }, expectedRevision: 1 }), { code: 'permission-denied' })
  const posted = await call('companyAccountingCommand', 'owner', { command: { type: 'approve', pendingId: draft.pendingId }, expectedRevision: 1 })
  assert.equal(posted.status, 'approved')
  assert.equal(posted.revision, 2)
  assert.equal(state(company.companyId).books.entries.length, 1)
  await assert.rejects(call('companyAccountingCommand', 'owner', { command: { type: 'approve', pendingId: draft.pendingId }, expectedRevision: 2 }), { code: 'failed-precondition' })
  assert.ok([...documents.values()].some(value => value.action === 'accounting.approve' && value.preparedBy === 'accountant'))
})

test('tenant IDs, user roles and source fields from callers cannot bypass company authorization', async () => {
  const company = await setup()
  await invite('viewer', 'viewer', company.companyCode)
  await assert.rejects(call('companyAccountingCommand', 'viewer', { companyId: company.companyId, role: 'admin', command: journal(), expectedRevision: 0 }), { code: 'permission-denied' })
  await assert.rejects(call('companyInvite', 'viewer', { email: 'someone@example.com', role: 'admin' }), { code: 'permission-denied' })
  await assert.rejects(call('companyUpdateProfile', 'viewer', { profile }), { code: 'permission-denied' })
  const unsafe = journal()
  unsafe.input.source = 'receivable'
  await assert.rejects(call('companyAccountingCommand', 'owner', { command: unsafe, expectedRevision: 0 }), { code: 'invalid-argument' })
  await assert.rejects(call('companyAccountingCommand', 'owner', { command: { type: 'restore', input: {} }, expectedRevision: 0 }), { code: 'permission-denied' })
  user('otherowner')
  const other = await call('companyCreate', 'otherowner', { profile: { ...profile, registeredName: 'Other Company' } })
  await call('companyAccountingCommand', 'otherowner', { companyId: company.companyId, command: journal(), expectedRevision: 0 })
  assert.equal(state(company.companyId).books.entries.length, 0)
  assert.equal(state(other.companyId).books.entries.length, 1)
  await assert.rejects(call('companySetMemberRole', 'otherowner', { uid: 'viewer', role: 'admin', active: true }), { code: 'not-found' })
})

test('stale revisions, closed periods, invalid amounts and non-VAT tax bypasses are rejected atomically', async () => {
  const company = await setup()
  await call('companyAccountingCommand', 'owner', { command: invoice({ netAmount: 1, vatAmount: 11199 }), expectedRevision: 0 })
  const stored = state(company.companyId).books.invoices[0]
  assert.equal(stored.netAmount, 10000)
  assert.equal(stored.vatAmount, 1200)
  await assert.rejects(call('companyAccountingCommand', 'owner', { command: journal(), expectedRevision: 0 }), { code: 'aborted' })
  await assert.rejects(call('companyAccountingCommand', 'owner', { command: invoice({ reference: 'NEG', amount: -1 }), expectedRevision: 1 }), { code: 'invalid-argument' })
  await call('companyAccountingCommand', 'owner', { command: { type: 'closePeriod', date: '2026-01-31' }, expectedRevision: 1 })
  await assert.rejects(call('companyAccountingCommand', 'owner', { command: journal(), expectedRevision: 2 }), { code: 'failed-precondition' })
  assert.equal(state(company.companyId).revision, 2)
  await call('companyUpdateProfile', 'owner', { profile: { ...profile, vatStatus: 'non_vat' } })
  for (const taxTreatment of ['VAT12', 'VAT_ZERO', 'VAT_EXEMPT']) {
    await assert.rejects(call('companyAccountingCommand', 'owner', { command: invoice({ date: '2026-02-01', due: '2026-02-28', reference: 'VAT-BYPASS', taxTreatment }), expectedRevision: 2 }), { code: 'failed-precondition' })
  }
  await assert.rejects(call('companyAccountingCommand', 'owner', { command: invoice({ kind: 'payable', account: '5100', date: '2026-02-01', due: '2026-02-28', reference: 'INPUT-BYPASS' }), expectedRevision: 2 }), { code: 'failed-precondition' })
})

test('VAT uses exact half-up tax rounding, with sales treatment matching company registration', async () => {
  const company = await setup()
  await assert.rejects(call('companyAccountingCommand', 'owner', { command: invoice({ taxTreatment: 'NON_VAT' }), expectedRevision: 0 }), { code: 'failed-precondition' })
  await call('companyAccountingCommand', 'owner', { command: invoice({ amount: 14 }), expectedRevision: 0 })
  assert.equal(state(company.companyId).books.invoices[0].vatAmount, 2)
  assert.equal(state(company.companyId).books.invoices[0].netAmount, 12)
  await call('companyAccountingCommand', 'owner', { command: invoice({ amount: 10010, reference: 'TIE2' }), expectedRevision: 1 })
  assert.equal(state(company.companyId).books.invoices[1].vatAmount, 1073)
  assert.equal(state(company.companyId).books.invoices[1].netAmount, 8937)
  const books = state(company.companyId).books
  const total = books.entries.flatMap(entry => entry.lines).reduce((sum, line) => sum + line.debit - line.credit, 0)
  assert.equal(total, 0)
})

test('last-admin and self-access protections survive administrator membership changes', async () => {
  const company = await setup()
  await assert.rejects(call('companySetMemberRole', 'owner', { uid: 'owner', role: 'viewer', active: true }), { code: 'failed-precondition' })
  await assert.rejects(call('companySetMemberRole', 'owner', { uid: 'owner', role: 'admin', active: false }), { code: 'failed-precondition' })
  await invite('secondadmin', 'admin', company.companyCode)
  assert.equal(documents.get(`companies/${company.companyId}`).adminCount, 2)
  await call('companySetMemberRole', 'secondadmin', { uid: 'owner', role: 'admin', active: false })
  assert.equal(documents.get(`companies/${company.companyId}`).adminCount, 1)
  await assert.rejects(call('companyInvite', 'owner', { email: 'someone@example.com', role: 'admin' }), { code: 'permission-denied' })
  assert.equal(documents.get(`companies/${company.companyId}/members/owner`).active, false)
})

test('approval revalidates against intervening postings; rejection keeps the ledger unchanged', async () => {
  const company = await setup()
  await invite('accountant', 'accountant', company.companyCode)
  const draft = await call('companyAccountingCommand', 'accountant', { command: journal(), expectedRevision: 0 })
  await call('companyAccountingCommand', 'owner', { command: journal(), expectedRevision: 1 })
  await assert.rejects(call('companyAccountingCommand', 'owner', { command: { type: 'approve', pendingId: draft.pendingId }, expectedRevision: 2 }), { code: 'failed-precondition' })
  const rejected = await call('companyAccountingCommand', 'owner', { command: { type: 'reject', pendingId: draft.pendingId, reason: 'Duplicate reference' }, expectedRevision: 2 })
  assert.equal(rejected.status, 'rejected')
  assert.equal(state(company.companyId).books.entries.length, 1)
  assert.equal(state(company.companyId).pendingCount, 0)
  assert.equal(documents.get(`companies/${company.companyId}/approvals/${draft.pendingId}`).reason, 'Duplicate reference')
})

test('server and browser accounting/profile modules remain synchronized', () => {
  const fs = require('node:fs')
  const path = require('node:path')
  for (const [client, server] of [['accounting.ts', 'accounting-engine.ts'], ['ph-compliance.ts', 'ph-compliance.ts']]) {
    assert.equal(fs.readFileSync(path.resolve(__dirname, '../../src/lib', client), 'utf8'), fs.readFileSync(path.resolve(__dirname, '../src', server), 'utf8'))
  }
})

test('new invoices require a same-company party and preserve verified tax snapshots through approval',async()=>{
 const c=await setup()
 await assert.rejects(call('companyAccountingCommand','owner',{command:invoice({partyId:'foreign'}),expectedRevision:0}),{code:'failed-precondition'})
 await call('companyAccountingCommand','owner',{command:invoice({partyTin:'999',party:'Spoofed'}),expectedRevision:0})
 const stored=state(c.companyId).books.invoices[0];assert.equal(stored.party,'Saved customer');assert.equal(stored.partyTin,'123-456-789-00000')
 await invite('accountant','accountant',c.companyCode)
 const draft=await call('companyAccountingCommand','accountant',{command:invoice({reference:'SECOND'}),expectedRevision:1})
 const party=documents.get(`companies/${c.companyId}/parties/customer1`);documents.set(`companies/${c.companyId}/parties/customer1`,{...party,tin:'987-654-321-00000'})
 await assert.rejects(call('companyAccountingCommand','owner',{command:{type:'approve',pendingId:draft.pendingId},expectedRevision:2}),{code:'failed-precondition'})
 assert.equal(state(c.companyId).books.invoices[0].partyTin,'123-456-789-00000')
})
