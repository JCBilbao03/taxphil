const { test, beforeEach } = require('node:test')
const assert = require('node:assert/strict')
const Module = require('node:module')
let users; let writes; let messagingFailure
const auth = { getUser: async uid => users.get(uid), setCustomUserClaims: async (uid, claims) => { users.get(uid).customClaims = claims } }
const db = { ref: (path = '') => ({
  push: () => ({ key: 'message-1' }),
  update: async value => { writes.push({ path, value }) },
  set: async value => { writes.push({ path, value }) },
  get: async () => ({ val: () => path.endsWith('/fcmTokens') ? { token1: { token: 'test-token' } } : null }),
}) }
const originalLoad = Module._load
Module._load = function (name, ...args) {
  if (name === 'firebase-admin/auth') return { getAuth: () => auth }
  if (name === 'firebase-admin/database') return { getDatabase: () => db, ServerValue: { TIMESTAMP: { '.sv': 'timestamp' }, increment: by => ({ '.sv': { increment: by } }) } }
  if (name === 'firebase-admin/messaging') return { getMessaging: () => ({ sendEachForMulticast: async () => { if (messagingFailure) throw Error('Notification provider unavailable'); return { responses: [{ success: true }] } } }) }
  return originalLoad.call(this, name, ...args)
}
const api = require('../lib/chat.js')
Module._load = originalLoad
const call = (name, data = {}, uid = 'staff', claims = {}) => api[name].run({ data, auth: { uid, token: { email_verified: true, ...claims } } })
beforeEach(() => { users = new Map([['staff', { uid: 'staff', email: 'staff@example.test', emailVerified: true, disabled: false, customClaims: { admin: true, accountant: true } }], ['customer', { uid: 'customer', email: 'customer@example.test', emailVerified: true }]]); writes = []; messagingFailure = false })

test('support authorization rechecks verified current admin identity, not caller claims', async () => {
  await assert.rejects(call('sendSupportReply', { userId: 'customer', content: 'hello' }, 'customer', { admin: true }), { code: 'permission-denied' })
  users.get('staff').disabled = true
  await assert.rejects(call('sendSupportReply', { userId: 'customer', content: 'hello' }), { code: 'permission-denied' })
  users.get('staff').disabled = false
  await assert.rejects(call('sendSupportReply', { userId: 'customer', content: 'hello' }, 'staff', { email_verified: false }), { code: 'permission-denied' })
  assert.equal(writes.length, 0)
})

test('admin synchronization preserves unrelated custom claims', async () => {
  await call('syncSupportAdmin')
  assert.deepEqual(users.get('staff').customClaims, { admin: true, accountant: true })
})

test('support path injection and oversized replies are rejected without writes', async () => {
  for (const data of [{ userId: '../other', content: 'hello' }, { userId: 'customer', conversationId: '../other', content: 'hello' }, { userId: 'customer', content: 'a'.repeat(4001) }]) await assert.rejects(call('sendSupportReply', data), { code: 'invalid-argument' })
  assert.equal(writes.length, 0)
})

test('reply and inbox metadata commit atomically and notification failure does not report the saved reply as unsent', async () => {
  messagingFailure = true
  const originalError = console.error; console.error = () => {}
  try { assert.deepEqual(await call('sendSupportReply', { userId: 'customer', content: 'hello' }), { success: true }) } finally { console.error = originalError }
  assert.equal(writes.length, 1); assert.equal(writes[0].path, '')
  assert.equal(writes[0].value['chats/customer/messages/support/message-1'].content, 'hello')
  assert.equal(writes[0].value['supportInbox/customer/lastMessage'], 'hello')
  assert.deepEqual(writes[0].value['chats/customer/conversations/support/unread'], { '.sv': { increment: 1 } })
})
