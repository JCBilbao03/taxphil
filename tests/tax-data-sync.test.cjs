const { test, beforeEach } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('../node_modules/typescript')
const source = ts.transpileModule(fs.readFileSync('src/hooks/useTaxDataSync.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
let state; let streams; let cleanup; let currentUser
const stateMethods = Object.fromEntries(['Income', 'Expenses', 'Deadlines', 'Loading', 'Error'].map(name => ['set' + name, value => { state[name.toLowerCase()] = value }]))
const moduleRef = { exports: {} }
const load = name => {
  if (name === 'react') return { useEffect: effect => { cleanup = effect() } }
  if (name === 'firebase/app') return { FirebaseError: class extends Error {} }
  if (name === '@/store/useAuthStore') return { useAuthUser: () => currentUser }
  if (name === '@/store/useTaxStore') return { useTaxStore: selector => selector(stateMethods) }
  if (name === '@/lib/firestore/transactions') return { subscribeToTransactions: (uid, success, error) => { streams.transactions = { uid, success, error }; return () => {} } }
  if (name === '@/lib/firestore/deadlines') return { subscribeToDeadlines: (uid, success, error) => { streams.deadlines = { uid, success, error }; return () => {} } }
  throw Error('Unexpected dependency ' + name)
}
new Function('require', 'module', 'exports', source)(load, moduleRef, moduleRef.exports)
beforeEach(() => { state = { income: [{ id: 'old' }], expenses: [{ id: 'old' }], deadlines: [{ id: 'old' }], loading: false, error: 'old error' }; streams = {}; currentUser = { uid: 'alice', emailVerified: true }; cleanup = undefined })

test('tax sync clears old data immediately and waits for both initial streams', () => {
  moduleRef.exports.useTaxDataSync()
  assert.deepEqual(state.income, []); assert.deepEqual(state.expenses, []); assert.deepEqual(state.deadlines, []); assert.equal(state.loading, true)
  streams.transactions.success([{ type: 'income', amount: 10 }]); assert.equal(state.loading, true)
  streams.deadlines.success([{ id: 'deadline' }]); assert.equal(state.loading, false)
})

test('a failed stream settles loading without exposing partial records as a complete dashboard', () => {
  moduleRef.exports.useTaxDataSync()
  streams.transactions.error(Error('Transaction access failed')); assert.equal(state.loading, true)
  streams.deadlines.success([]); assert.equal(state.loading, false); assert.match(state.error, /Transaction access failed/)
  streams.transactions.success([]); assert.equal(state.error, null)
})

test('callbacks from the previous account cannot overwrite the new account data', () => {
  moduleRef.exports.useTaxDataSync(); const old = { ...streams }; cleanup()
  currentUser = { uid: 'bob', emailVerified: true }; moduleRef.exports.useTaxDataSync()
  old.transactions.success([{ type: 'income', amount: 999 }]); old.deadlines.success([{ id: 'private-alice' }])
  assert.deepEqual(state.income, []); assert.deepEqual(state.deadlines, []); assert.equal(state.loading, true)
  streams.transactions.success([{ type: 'income', amount: 5 }]); streams.deadlines.success([])
  assert.equal(state.income[0].amount, 5)
})

test('unverified or signed-out users have no retained tax data', () => {
  currentUser = null; moduleRef.exports.useTaxDataSync()
  assert.deepEqual(state.income, []); assert.deepEqual(state.deadlines, []); assert.equal(state.loading, false); assert.equal(state.error, null)
})
