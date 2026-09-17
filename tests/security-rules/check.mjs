import { readFileSync } from 'node:fs'
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing'

const projectId = 'demo-taxphil-rules'
const firestoreHost = '127.0.0.1:18080'
const storageHost = '127.0.0.1:19199'

// Fail closed when invoked outside this package's isolated emulator command.
for (const name of ['GCLOUD_PROJECT', 'GOOGLE_CLOUD_PROJECT']) {
  if (process.env[name] && process.env[name] !== projectId) {
    throw new Error(`This test suite only permits the demo project ${projectId}.`)
  }
}
if (process.env.FIRESTORE_EMULATOR_HOST !== firestoreHost
  || process.env.FIREBASE_STORAGE_EMULATOR_HOST !== storageHost) {
  throw new Error('Run npm test in tests/security-rules to start the isolated local emulators.')
}

const environment = await initializeTestEnvironment({
  projectId,
  firestore: {
    host: '127.0.0.1',
    port: 18080,
    rules: readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8'),
  },
  storage: {
    host: '127.0.0.1',
    port: 19199,
    rules: readFileSync(new URL('../../storage.rules', import.meta.url), 'utf8'),
  },
})

let count = 0
async function check(label, request, allowed) {
  try {
    await (allowed ? assertSucceeds(request) : assertFails(request))
  } catch (error) {
    throw new Error(`${label}: expected ${allowed ? 'allow' : 'deny'}`, { cause: error })
  }
  count += 1
  console.log(`PASS ${count} (${allowed ? 'allow' : 'deny'}): ${label}`)
}

const users = {
  admin: ['a', 'admin', true],
  manager: ['a', 'manager', true],
  accountant: ['a', 'accountant', true],
  viewer: ['a', 'viewer', true],
  foreign: ['b', 'admin', true],
  inactive: ['a', 'admin', false],
  unverified: ['a', 'admin', true],
}
const collections = ['accounting', 'parties', 'employees', 'payrollRuns', 'taxDrafts', 'assets', 'assetRuns', 'assetControl', 'bankAccounts', 'bankStatements', 'bankStatementVersions', 'bankAdjustments', 'paymentRequests', 'paymentRequestVersions']
const privateCollections = ['employees', 'payrollRuns', 'taxDrafts', 'bankAccounts', 'bankStatements', 'bankStatementVersions', 'bankAdjustments', 'paymentRequests', 'paymentRequestVersions']
const categories = ['supplier-bills', 'settlement-evidence', 'evidence', 'bank-statements']

try {
  await environment.clearStorage()
  await environment.clearFirestore()
  await environment.withSecurityRulesDisabled(async context => {
    const database = context.firestore()
    for (const [uid, [companyId, role, active]] of Object.entries(users)) {
      await database.doc(`companyMemberships/${uid}`).set({ companyId, role, active })
      await database.doc(`companies/${companyId}/members/${uid}`).set({ role, active })
    }
    for (const collection of collections) {
      await database.doc(`companies/a/${collection}/test`).set({ fixture: true })
    }
    await database.doc('companies/a').set({ fixture: true })
    await database.doc('companies/a/bankControl/locks').set({ version: 1, accounts: {} })
    for (const category of categories) {
      await context.storage().ref(`companies/a/${category}/fixture`)
        .put(new Uint8Array([1, 2, 3]), { contentType: 'application/pdf' })
    }
  })

  const contexts = {
    anonymous: environment.unauthenticatedContext(),
    ...Object.fromEntries(Object.keys(users).map(uid => [
      uid, environment.authenticatedContext(uid, { email_verified: uid !== 'unverified' }),
    ])),
  }

  for (const [uid, context] of Object.entries(contexts)) {
    const member = ['admin', 'manager', 'accountant', 'viewer'].includes(uid)
    const preparer = ['admin', 'manager', 'accountant'].includes(uid)
    for (const collection of collections) {
      const document = context.firestore().doc(`companies/a/${collection}/test`)
      await check(`${uid} read ${collection}`, document.get(), privateCollections.includes(collection) ? preparer : member)
      await check(`${uid} client write ${collection}`, document.set({ fixture: 'tampered' }), false)
    }
    await check(`${uid} mutate membership`, context.firestore().doc(`companyMemberships/${uid}`)
      .set({ companyId: 'a', role: 'admin', active: true }), false)
    await check(`${uid} read bank locking control`, context.firestore().doc('companies/a/bankControl/locks').get(), false)
    await check(`${uid} alter bank locking control`, context.firestore().doc('companies/a/bankControl/locks').set({ version: 0, accounts: {} }), false)
    for (const collection of ['paymentControl', 'bankStatementImports', 'bankRowIndex']) {
      await check(`${uid} read ${collection}`, context.firestore().doc(`companies/a/${collection}/test`).get(), false)
      await check(`${uid} alter ${collection}`, context.firestore().doc(`companies/a/${collection}/test`).set({ fixture: true }), false)
    }
    for (const category of categories) {
      const storage = context.storage()
      await check(`${uid} read ${category}`, storage.ref(`companies/a/${category}/fixture`).getMetadata(), category === 'bank-statements' ? preparer : member)
      await check(`${uid} upload ${category}`, storage.ref(`companies/a/${category}/${uid}`)
        .put(new Uint8Array([1, 2, 3]), { contentType: 'application/pdf' }),
      preparer)
    }
  }

  const storage = contexts.admin.storage()
  for (const [extension, contentType] of [['csv', 'text/csv'], ['xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']]) {
    await check(`allowed bank ${extension} import`, storage.ref(`companies/a/bank-statements/fixture-${extension}`).put(new Uint8Array([1, 2, 3]), { contentType }), true)
  }
  for (const category of categories) {
    const existing = storage.ref(`companies/a/${category}/fixture`)
    await check(`immutable ${category} overwrite`, existing.put(new Uint8Array([9]), { contentType: 'application/pdf' }), false)
    await check(`immutable ${category} delete`, existing.delete(), false)
    await check(`bad mime ${category}`, storage.ref(`companies/a/${category}/badmime`)
      .put(new Uint8Array([1]), { contentType: 'text/html' }), false)
    await check(`empty ${category}`, storage.ref(`companies/a/${category}/empty`)
      .put(new Uint8Array(), { contentType: 'application/pdf' }), false)
    await check(`oversized ${category}`, storage.ref(`companies/a/${category}/big`)
      .put(new Uint8Array(10 * 1024 * 1024 + 1), { contentType: 'application/pdf' }), false)
  }
} finally {
  try {
    await environment.clearStorage()
    await environment.clearFirestore()
  } finally {
    await environment.cleanup()
  }
}

console.log(`ALL ${count} SECURITY RULE ASSERTIONS PASSED; emulator fixtures removed`)
