const assert = require('node:assert/strict')
const { randomUUID } = require('node:crypto')
const Module = require('node:module')
module.exports = function makeHarness() {
  const documents = new Map(), users = new Map()
  const reference = path => ({ path, id: path.split('/').at(-1), collection: name => collection(`${path}/${name}`) })
  const collection = (path, filters = []) => ({ path, filters, isQuery: true, doc: (key = randomUUID()) => reference(`${path}/${key}`), where: (field, op, value) => collection(path, [...filters, [field, op, value]]) })
  const snapshot = ref => ({ id: ref.id, ref, exists: documents.has(ref.path), data: () => structuredClone(documents.get(ref.path)), get: field => structuredClone(documents.get(ref.path)?.[field]) })
  const read = ref => ref.isQuery ? { docs: [...documents.entries()].filter(([path, value]) => path.startsWith(`${ref.path}/`) && path.split('/').length === ref.path.split('/').length + 1 && ref.filters.every(([field, op, expected]) => op === '==' ? value[field] === expected : op === '>=' ? value[field] >= expected : op === '<=' ? value[field] <= expected : false)).map(([path]) => snapshot(reference(path))) } : snapshot(ref)
  const db = { doc: reference, collection, async runTransaction(fn) { const writes = []
    const tx = { async get(ref) { assert.equal(writes.length, 0, 'Firestore transactions must finish reads before writes'); return read(ref) }, async getAll(...refs) { assert.equal(writes.length, 0, 'Firestore transactions must finish reads before writes'); return refs.map(read) }, create(ref, value) { assert.ok(!documents.has(ref.path), 'create cannot overwrite'); writes.push([ref.path, structuredClone(value)]) }, update(ref, value) { assert.ok(documents.has(ref.path), 'update requires existing document'); writes.push([ref.path, { ...structuredClone(documents.get(ref.path)), ...structuredClone(value) }]) }, set(ref, value) { writes.push([ref.path, structuredClone(value)]) } }
    const result = await fn(tx); for (const [path, value] of writes) documents.set(path, value); return result
  } }
  const original = Module._load
  Module._load = function (name, ...args) { if (name === 'firebase-admin/auth') return { getAuth: () => ({ getUser: async uid => users.get(uid) }) }; if (name === 'firebase-admin/firestore') return { getFirestore: () => db }; return original.call(this, name, ...args) }
  const api = { ...require('../../lib/company-accounting.js'), ...require('../../lib/company-workflows.js'), ...require('../../lib/company-payroll.js') }
  Module._load = original
  const profile = { registeredName: 'Example Trading', tin: '123-456-789', branchCode: '00000', rdo: '044', registeredAddress: 'Makati City', entityType: 'sole_proprietor', vatStatus: 'vat', incomeTaxRegime: 'graduated', fiscalYearEnd: '12-31', reportingFramework: 'pfrs_small', withholdingAgent: true, hasEmployees: true, casRegistrationReference: '', invoiceSeries: 'INV', secRegistrationNumber: '', businessNature: 'Trading', accountantReviewRequired: true }
  const user = (uid, extra = {}) => { users.set(uid, { uid, email: `${uid}@example.test`, emailVerified: true, disabled: false, ...extra }); return users.get(uid) }
  const call = (name, uid, data) => { const u = users.get(uid); return api[name].run({ data, auth: u ? { uid, token: { email: u.email, email_verified: u.emailVerified } } : undefined }) }
  const setup = async (owner = 'owner') => { user(owner); const company = await call('companyCreate', owner, { profile }); for (const [uid, role] of [['manager', 'manager'], ['accountant', 'accountant'], ['viewer', 'viewer']]) { user(uid); const member = { uid, email: `${uid}@example.test`, displayName: uid, companyId: company.companyId, companyCode: company.companyCode, role, active: true }; documents.set(`companyMemberships/${uid}`, member); documents.set(`companies/${company.companyId}/members/${uid}`, member) } return company }
  return { documents, users, user, call, setup, profile, reset() { documents.clear(); users.clear() }, get(companyId, path) { return documents.get(`companies/${companyId}/${path}`) }, set(companyId, path, value) { documents.set(`companies/${companyId}/${path}`, value) }, auditCount(companyId) { return [...documents.keys()].filter(path => path.startsWith(`companies/${companyId}/audit/`)).length } }
}
