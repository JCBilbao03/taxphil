const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const root = path.resolve(__dirname, '..')
const records = new Map()
let sequence = 0
const firebase = {
  collection: (_db, value) => value,
  doc: (_db, collection, id) => `${collection}/${id}`,
  serverTimestamp: () => 'new-server-timestamp',
  addDoc: async (collection, value) => { assert.ok(Object.values(value).every(item => item !== undefined)); const id = String(++sequence); records.set(`${collection}/${id}`, structuredClone(value)); return { id } },
  runTransaction: async (_db, work) => work({
    get: async ref => ({ exists: () => records.has(ref), id: ref.split('/').at(-1), data: () => structuredClone(records.get(ref)) }),
    update: (ref, changes) => records.set(ref, { ...records.get(ref), ...structuredClone(changes) }),
    delete: ref => records.delete(ref),
  }),
  onSnapshot: () => () => {},
}
const cache = new Map()
function load(relative) {
  if (cache.has(relative)) return cache.get(relative)
  const filename = path.join(root, relative)
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } })
  const module = { exports: {} }
  const localRequire = name => {
    if (name === 'firebase/firestore') return firebase
    if (name === '@/lib/firebase') return { db: {} }
    if (name === '@/lib/firestore/paths') return { transactionsCollectionPath: uid => `users/${uid}/transactions`, deadlinesCollectionPath: uid => `users/${uid}/deadlines` }
    if (name === '@/lib/tax-workflows') return load('src/lib/tax-workflows.ts')
    throw Error(`Unexpected import ${name}`)
  }
  new Function('require', 'module', 'exports', outputText)(localRequire, module, module.exports)
  cache.set(relative, module.exports)
  return module.exports
}
const transactions = load('src/lib/firestore/transactions.ts')
const deadlines = load('src/lib/firestore/deadlines.ts')
const transaction = { type: 'income', description: 'Original', amount: 100, date: '2026-09-17', category: 'Services', reference: '' }
const obligation = { formType: '1701', title: 'Annual return', dueDate: '2026-04-15', amountDue: 0, status: 'upcoming', createdAt: 'original-creation', updatedAt: 'original-update' }

test('transaction creation accepts omitted optional reference without writing undefined', async () => {
  const id = await transactions.addTransactionDocument('A', { ...transaction, reference: undefined })
  assert.equal(records.get(`users/A/transactions/${id}`).reference, '')
  assert.equal(records.get(`users/A/transactions/${id}`).createdAt, 'new-server-timestamp')
})
test('transaction edit keeps identity and creation metadata and rejects stale edits/removal', async () => {
  records.set('users/A/transactions/edit', { ...transaction, createdAt: 'original-creation', customLegacyValue: true })
  const expected = { ...transaction, id: 'edit' }
  await transactions.updateTransactionDocument('A', 'edit', { ...transaction, amount: 101 }, expected)
  const stored = records.get('users/A/transactions/edit')
  assert.equal(stored.createdAt, 'original-creation')
  assert.equal(stored.customLegacyValue, true)
  assert.equal(stored.amount, 101)
  await assert.rejects(transactions.updateTransactionDocument('A', 'edit', { ...transaction, amount: 102 }, expected), /changed/)
  await assert.rejects(transactions.removeTransactionDocument('A', 'edit', expected), /changed/)
  assert.equal(records.get('users/A/transactions/edit').amount, 101)
})
test('legacy filed obligation can be edited without inventing acknowledgement or changing status', async () => {
  const legacy = { ...obligation, status: 'filed', id: 'legacy' }
  records.set('users/A/deadlines/legacy', { ...legacy })
  await deadlines.updateDeadlineDocument('A', legacy, { ...legacy, title: 'Corrected description' })
  const stored = records.get('users/A/deadlines/legacy')
  assert.equal(stored.status, 'filed')
  assert.equal(stored.createdAt, 'original-creation')
  assert.equal(stored.filingReference, undefined)
})
test('recording evidence requires details and reopening preserves the original acknowledgement', async () => {
  records.set('users/A/deadlines/record', { ...obligation })
  const expected = { ...obligation, id: 'record' }
  await assert.rejects(deadlines.recordDeadlineFiling('A', expected, { filingDate: '2026-01-01', filingReference: '' }), /reference|required/)
  assert.equal(records.get('users/A/deadlines/record').status, 'upcoming')
  await deadlines.recordDeadlineFiling('A', expected, { filingDate: '2026-01-01', filingReference: 'BIR-ACK-1', filingNotes: 'Payment separate' })
  const filed = { ...records.get('users/A/deadlines/record'), id: 'record' }
  assert.equal(filed.status, 'filed')
  await deadlines.reopenDeadline('A', filed)
  const reopened = records.get('users/A/deadlines/record')
  assert.equal(reopened.status, 'upcoming')
  assert.equal(reopened.filingReference, 'BIR-ACK-1')
  assert.equal(reopened.filingNotes, 'Payment separate')
  assert.equal(reopened.createdAt, 'original-creation')
})
test('a stale obligation cannot overwrite another editing session or record filing', async () => {
  records.set('users/A/deadlines/stale', { ...obligation, amountDue: 500 })
  const stale = { ...obligation, id: 'stale' }
  await assert.rejects(deadlines.updateDeadlineDocument('A', stale, { ...obligation, title: 'Outdated edit' }), /changed/)
  await assert.rejects(deadlines.recordDeadlineFiling('A', stale, { filingDate: '2026-01-01', filingReference: 'ACK' }), /changed/)
  assert.equal(records.get('users/A/deadlines/stale').amountDue, 500)
  assert.equal(records.get('users/A/deadlines/stale').status, 'upcoming')
})
