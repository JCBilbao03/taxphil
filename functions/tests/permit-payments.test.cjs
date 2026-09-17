const { test, beforeEach, after } = require('node:test')
const assert = require('node:assert/strict')
const { randomUUID, createHmac } = require('node:crypto')
const Module = require('node:module')
let documents; let users; let providerCalls; let checkoutResponses; let failProvider
const reference = path => ({ path, id: path.split('/').at(-1), get: async () => snapshot(reference(path)) })
const snapshot = ref => ({ id: ref.id, exists: documents.has(ref.path), data: () => structuredClone(documents.get(ref.path)), get: field => documents.get(ref.path)?.[field] })
const db = { doc: reference, async runTransaction(fn) {
  const writes = []
  const result = await fn({
    get: async ref => { assert.equal(writes.length, 0); return snapshot(ref) },
    getAll: async (...refs) => { assert.equal(writes.length, 0); return refs.map(snapshot) },
    create: (ref, value) => { assert.ok(!documents.has(ref.path)); writes.push([ref.path, structuredClone(value)]) },
    update: (ref, value) => { writes.push([ref.path, { ...documents.get(ref.path), ...structuredClone(value) }]) },
  })
  for (const [path, value] of writes) documents.set(path, value)
  return result
} }
const originalLoad = Module._load
Module._load = function (name, ...args) {
  if (name === 'firebase-admin/auth') return { getAuth: () => ({ getUser: async uid => users.get(uid) }) }
  if (name === 'firebase-admin/firestore') return { getFirestore: () => db, FieldValue: { serverTimestamp: () => 'SERVER_TIME' }, Timestamp: { now: () => 'NOW', fromMillis: ms => ms } }
  return originalLoad.call(this, name, ...args)
}
const api = require('../lib/paymongo.js')
Module._load = originalLoad
const originalFetch = global.fetch
const previousEnv = { key: process.env.PAYMONGO_SECRET_KEY, webhook: process.env.PAYMONGO_WEBHOOK_SECRET, origin: process.env.APP_ORIGIN }
global.fetch = async (url, options) => {
  providerCalls.push({ url, options })
  if (failProvider) return { ok: false, status: 503 }
  if (options.method === 'POST') {
    const input = JSON.parse(options.body).data.attributes
    const id = 'cs_' + options.headers['Idempotency-Key'].slice(0, 10)
    const data = { id, attributes: { ...input, checkout_url: `https://checkout.paymongo.com/${id}#test`, status: 'active', livemode: false, payments: [] } }
    checkoutResponses.set(id, data)
    return { ok: true, json: async () => ({ data }) }
  }
  return { ok: true, json: async () => ({ data: checkoutResponses.get(url.split('/').at(-1)) }) }
}
const input = () => ({ businessName: 'Example Trading', lgu: 'Makati', permitType: 'renewal', year: new Date().getUTCFullYear(), amount: 1500.25, assistanceReference: 'QUOTE-1', acknowledgedMerchant: true, requestId: randomUUID() })
const call = (name, data, uid = 'alice', claims = {}) => api[name].run({ data, auth: users.has(uid) ? { uid, token: { email: users.get(uid).email, email_verified: true, ...claims } } : undefined })
beforeEach(() => { documents = new Map(); users = new Map([['alice', { uid: 'alice', email: 'alice@example.test', emailVerified: true, disabled: false }], ['bob', { uid: 'bob', email: 'bob@example.test', emailVerified: true }]]); providerCalls = []; checkoutResponses = new Map(); failProvider = false; process.env.PAYMONGO_SECRET_KEY = 'sk_test_FAKE_FOR_UNIT_TESTS'; process.env.PAYMONGO_WEBHOOK_SECRET = 'fake-test-webhook'; process.env.APP_ORIGIN = 'https://taxphil.example.test' })
after(() => { global.fetch = originalFetch; for (const [name, value] of Object.entries({ PAYMONGO_SECRET_KEY: previousEnv.key, PAYMONGO_WEBHOOK_SECRET: previousEnv.webhook, APP_ORIGIN: previousEnv.origin })) { if (value === undefined) delete process.env[name]; else process.env[name] = value } })

test('checkout requires a current verified user and merchant acknowledgement before touching provider', async () => {
  await assert.rejects(call('createPermitCheckout', input(), 'missing'), { code: 'unauthenticated' })
  users.get('alice').disabled = true; await assert.rejects(call('createPermitCheckout', input()), { code: 'permission-denied' }); users.get('alice').disabled = false
  await assert.rejects(call('createPermitCheckout', { ...input(), acknowledgedMerchant: false }), { code: 'invalid-argument' })
  assert.equal(providerCalls.length, 0)
})

test('safe retry reuses one checkout, records merchant purpose and uses provider idempotency', async () => {
  const details = input(), first = await call('createPermitCheckout', details), again = await call('createPermitCheckout', details)
  assert.equal(first.permitId, again.permitId); assert.equal(providerCalls.length, 1)
  assert.ok(providerCalls[0].options.headers['Idempotency-Key'])
  assert.match(JSON.parse(providerCalls[0].options.body).data.attributes.line_items[0].name, /TaxPhil permit assistance/)
  assert.equal(documents.get(`users/alice/payments/${first.paymentId}`).livemode, false)
  assert.equal(documents.get(`users/alice/permits/${first.permitId}`).purpose, 'taxphil_assistance')
  await assert.rejects(call('createPermitCheckout', { ...details, amount: 2000 }), { code: 'already-exists' })
})

test('failed provider creation does not expire or alter an existing pending payment', async () => {
  await call('createPermitCheckout', input()); const before = structuredClone(documents); failProvider = true
  const originalError = console.error; console.error = () => {}
  try { await assert.rejects(call('createPermitCheckout', input()), { code: 'unavailable' }) } finally { console.error = originalError }
  assert.deepEqual(documents, before)
})

test('refresh is owner-scoped and only matching paid provider amounts confirm both records', async () => {
  const created = await call('createPermitCheckout', input())
  await assert.rejects(call('refreshPermitPayment', { permitId: created.permitId }, 'bob'), { code: 'not-found' })
  assert.equal((await call('refreshPermitPayment', { permitId: created.permitId })).status, 'pending')
  const payment = documents.get(`users/alice/payments/${created.paymentId}`), checkout = checkoutResponses.get(payment.paymongoCheckoutId)
  checkout.attributes.payments = [{ id: 'pay_test', attributes: { status: 'paid', amount: 1, currency: 'PHP', livemode: false } }]
  await assert.rejects(call('refreshPermitPayment', { permitId: created.permitId }), { code: 'failed-precondition' })
  assert.equal(documents.get(`users/alice/permits/${created.permitId}`).status, 'pending')
  checkout.attributes.payments[0].attributes.amount = payment.amountCentavos
  assert.equal((await call('refreshPermitPayment', { permitId: created.permitId })).status, 'paid')
  assert.equal(documents.get(`users/alice/permits/${created.permitId}`).status, 'paid')
  assert.equal(documents.get(`users/alice/payments/${created.paymentId}`).status, 'paid')
})

test('signature verification uses exact raw bytes and the matching live/test signature', () => {
  const body = Buffer.from('{"test":true}'), secret = 'unit-secret', time = '1789632000'
  const signature = createHmac('sha256', secret).update(`${time}.${body.toString()}`).digest('hex')
  assert.equal(api.verifyPaymongoSignature(`t=${time},te=${signature},li=`, body, secret, false), true)
  assert.equal(api.verifyPaymongoSignature(`t=${time},te=${signature},li=`, body, secret, true), false)
  assert.equal(api.verifyPaymongoSignature(`t=${time},te=${signature}`, Buffer.from('{"test":false}'), secret, false), false)
})

test('webhook rejects tampering and mismatched orders, then confirms one payment idempotently', async () => {
  const created = await call('createPermitCheckout', input())
  const payment = documents.get(`users/alice/payments/${created.paymentId}`), checkout = checkoutResponses.get(payment.paymongoCheckoutId)
  checkout.attributes.payments = [{ id: 'pay_webhook', attributes: { status: 'paid', amount: payment.amountCentavos, currency: 'PHP', livemode: false } }]
  const deliver = async (resource, tampered = false) => {
    const body = Buffer.from(JSON.stringify({ data: { attributes: { type: 'checkout_session.payment.paid', livemode: false, data: resource } } }))
    const time = '1789632000', signature = createHmac('sha256', process.env.PAYMONGO_WEBHOOK_SECRET).update(`${time}.${body.toString()}`).digest('hex')
    const response = { code: 0, body: '', status(code) { this.code = code; return this }, send(value) { this.body = value; return this } }
    await api.paymongoWebhook({ method: 'POST', get: () => `t=${time},te=${signature}`, rawBody: tampered ? Buffer.concat([body, Buffer.from(' ')]) : body }, response)
    return response.code
  }
  assert.equal(await deliver(checkout, true), 401)
  const bad = structuredClone(checkout); bad.attributes.metadata.userId = 'bob'
  const originalError = console.error; console.error = () => {}
  try { assert.equal(await deliver(bad), 404) } finally { console.error = originalError }
  assert.equal(documents.get(`users/alice/payments/${created.paymentId}`).status, 'pending')
  assert.equal(await deliver(checkout), 200)
  const confirmed = structuredClone(documents)
  assert.equal(await deliver(checkout), 200); assert.deepEqual(documents, confirmed)
})
