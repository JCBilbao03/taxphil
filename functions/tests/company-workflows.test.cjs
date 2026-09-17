const { test, beforeEach } = require('node:test')
const assert = require('node:assert/strict')
const h = require('./helpers/company-harness.cjs')()
const { defaultReturnTemplates } = require('../lib/tax-returns.js')
const { suggestedMapping } = require('../lib/tax-mapping.js')
beforeEach(() => h.reset())
const regulation = { title: 'Test source entry', agency: 'BIR', number: '7-2024', year: '2024', kind: 'RR', url: 'https://www.bir.gov.ph/', issuedOn: '2024-04-01', effectiveOn: '', reviewedOn: '', amends: '', notes: '', attachments: [] }
const task = { title: 'Review annual obligation', agency: 'BIR', period: '2025', sourceUrl: 'https://www.bir.gov.ph/', assignedTo: 'accountant', dueDate: '2026-04-15', status: 'needs_review', notes: '', filingDate: '', filingReference: '', evidenceUrl: '', attachments: [] }
async function setupMapped() { const c = await h.setup(); const books = h.get(c.companyId, 'accounting/books').books; await h.call('companyTaxMappingSave', 'owner', { expectedVersion: 0, mappings: books.accounts.map(account => ({ account: account.code, category: suggestedMapping(account) || 'other_expenses', note: '' })) }); return c }
const createDraft = (extra = {}) => ({ form: '1701', from: '2026-01-01', to: '2026-12-31', expectedBooksRevision: 0, expectedMappingVersion: 1, expectedTemplateVersion: 0, expectedRegisterVersion: 0, applicabilityConfirmed: true, adjustments: [], ...extra })
const review = draft => ({ id: draft.id, note: 'Reviewed source records, applicability, and the remaining filing requirements.', confirmedRequirements: draft.template.requirements })
async function seedEntry(companyId) { const books = h.get(companyId, 'accounting/books'); h.set(companyId, 'accounting/books', { ...books, books: { ...books.books, entries: [{ id: 'source-entry', date: '2026-09-15', reference: 'SRC-1', description: 'Test source', source: 'journal', createdAt: '2026-09-15', lines: [{ account: '5100', debit: 100000, credit: 0 }, { account: '1010', debit: 0, credit: 100000 }] }] } }); h.set(companyId, 'parties/vendor1', { kind: 'vendor', registeredName: 'Verified Vendor', tin: '001-002-003-00000', address: 'Saved vendor address', defaultAtc: 'WI100', active: true }) }
const register = { entryId: 'source-entry', date: '2026-09-15', kind: 'expanded_withholding', partyId: 'vendor1', partyName: 'Spoofed', tin: '999999999', address: 'Spoofed address', atc: '', classification: 'Professional fees', taxBase: 100000, taxAmount: 5000, notes: '', active: true }

test('workflow handlers require current verified identity and reject viewer role spoofing', async () => {
  await h.setup()
  await assert.rejects(h.call('companyWorkflowSave', 'missing', { collection: 'regulations', value: regulation, expectedVersion: 0 }), { code: 'unauthenticated' })
  h.user('unverified', { emailVerified: false }); await assert.rejects(h.call('companyTaxMappingSave', 'unverified', { mappings: [], expectedVersion: 0 }), { code: 'permission-denied' })
  for (const name of ['companyWorkflowSave', 'companyTaxMappingSave', 'companyTaxTemplateSave', 'companyTaxRegisterSave', 'companyTaxDraftCreate']) await assert.rejects(h.call(name, 'viewer', { collection: 'regulations', value: regulation, role: 'admin', expectedVersion: 0, ...createDraft() }), { code: 'permission-denied' })
})
test('regulations enforce role, source, company evidence path, and version', async () => {
  const c = await h.setup()
  await assert.rejects(h.call('companyWorkflowSave', 'accountant', { collection: 'regulations', value: regulation, expectedVersion: 0 }), { code: 'permission-denied' })
  await assert.rejects(h.call('companyWorkflowSave', 'owner', { collection: 'regulations', value: { ...regulation, url: 'javascript:alert(1)' }, expectedVersion: 0 }), { code: 'invalid-argument' })
  await assert.rejects(h.call('companyWorkflowSave', 'owner', { collection: 'regulations', value: { ...regulation, attachments: [{ path: 'companies/foreign/evidence/file1', name: 'proof.pdf', size: 12, type: 'application/pdf' }] }, expectedVersion: 0 }), { code: 'invalid-argument' })
  const saved = await h.call('companyWorkflowSave', 'owner', { collection: 'regulations', value: regulation, expectedVersion: 0 })
  await assert.rejects(h.call('companyWorkflowSave', 'manager', { id: saved.id, collection: 'regulations', value: regulation, expectedVersion: 0 }), { code: 'aborted' })
  assert.equal(h.get(c.companyId, `regulations/${saved.id}`).version, 1)
})
test('compliance tasks enforce owner assignment, independent roles and recorded filing evidence', async () => {
  const c = await h.setup()
  await assert.rejects(h.call('companyWorkflowSave', 'accountant', { collection: 'complianceTasks', value: { ...task, assignedTo: 'manager' }, expectedVersion: 0 }), { code: 'permission-denied' })
  await assert.rejects(h.call('companyWorkflowSave', 'owner', { collection: 'complianceTasks', value: { ...task, assignedTo: 'viewer' }, expectedVersion: 0 }), { code: 'invalid-argument' })
  const saved = await h.call('companyWorkflowSave', 'accountant', { collection: 'complianceTasks', value: task, expectedVersion: 0 })
  const filed = { ...task, status: 'filed', filingDate: '2026-04-01', filingReference: 'ACK-1', evidenceUrl: 'https://example.test/evidence' }
  await assert.rejects(h.call('companyWorkflowSave', 'accountant', { id: saved.id, collection: 'complianceTasks', value: filed, expectedVersion: 1 }), { code: 'permission-denied' })
  await assert.rejects(h.call('companyWorkflowSave', 'manager', { id: saved.id, collection: 'complianceTasks', value: { ...filed, evidenceUrl: '' }, expectedVersion: 1 }), { code: 'invalid-argument' })
  await h.call('companyWorkflowSave', 'manager', { id: saved.id, collection: 'complianceTasks', value: filed, expectedVersion: 1 })
  await assert.rejects(h.call('companyWorkflowSave', 'accountant', { id: saved.id, collection: 'complianceTasks', value: task, expectedVersion: 2 }), { code: 'permission-denied' })
  assert.equal(h.get(c.companyId, `complianceTasks/${saved.id}`).filingReference, 'ACK-1')
})
test('caller-supplied company IDs never select another tenant', async () => {
  const first = await h.setup(); h.user('other'); const second = await h.call('companyCreate', 'other', { profile: h.profile })
  const saved = await h.call('companyWorkflowSave', 'other', { companyId: first.companyId, collection: 'regulations', value: regulation, expectedVersion: 0 })
  assert.equal(h.get(first.companyId, `regulations/${saved.id}`), undefined)
  assert.ok(h.get(second.companyId, `regulations/${saved.id}`))
})
test('account mappings validate account types, reject duplicates, and protect revisions', async () => {
  const c = await setupMapped()
  await assert.rejects(h.call('companyTaxMappingSave', 'accountant', { mappings: [], expectedVersion: 1 }), { code: 'permission-denied' })
  await assert.rejects(h.call('companyTaxMappingSave', 'owner', { mappings: [], expectedVersion: 0 }), { code: 'aborted' })
  await assert.rejects(h.call('companyTaxMappingSave', 'owner', { mappings: [{ account: '1010', category: 'sales', note: '' }], expectedVersion: 1 }), { code: 'invalid-argument' })
  await assert.rejects(h.call('companyTaxMappingSave', 'owner', { mappings: [{ account: '4000', category: 'sales', note: '' }, { account: '4000', category: 'sales', note: '' }], expectedVersion: 1 }), { code: 'invalid-argument' })
  assert.equal(h.get(c.companyId, 'taxMappings/default').version, 1)
})
test('tax registers overwrite spoofed payee data from same-company source records and require valid links', async () => {
  const c = await setupMapped(); await seedEntry(c.companyId)
  await assert.rejects(h.call('companyTaxRegisterSave', 'owner', { record: { ...register, partyId: 'foreign' }, expectedVersion: 0 }), { code: 'invalid-argument' })
  await assert.rejects(h.call('companyTaxRegisterSave', 'owner', { record: { ...register, entryId: 'outside-ledger' }, expectedVersion: 0 }), { code: 'invalid-argument' })
  const saved = await h.call('companyTaxRegisterSave', 'accountant', { record: register, expectedVersion: 0 })
  const row = h.get(c.companyId, 'taxRegisters/default').records[0]
  assert.equal(row.partyName, 'Verified Vendor'); assert.equal(row.tin, '001-002-003-00000'); assert.equal(row.address, 'Saved vendor address'); assert.equal(row.atc, 'WI100')
  await assert.rejects(h.call('companyTaxRegisterSave', 'owner', { record: register, expectedVersion: 0 }), { code: 'aborted' })
  await assert.rejects(h.call('companyTaxRegisterSave', 'owner', { record: register, expectedVersion: 1 }), { code: 'already-exists' })
  await assert.rejects(h.call('companyTaxRegisterSave', 'owner', { id: saved.id, record: { ...register, kind: 'payroll' }, expectedVersion: 1 }), { code: 'failed-precondition' })
})
test('draft creation enforces all four source revisions and freezes source snapshots', async () => {
  const c = await setupMapped()
  for (const key of ['expectedBooksRevision', 'expectedMappingVersion', 'expectedTemplateVersion', 'expectedRegisterVersion']) await assert.rejects(h.call('companyTaxDraftCreate', 'accountant', createDraft({ [key]: 99 })), { code: 'aborted' })
  const draft = await h.call('companyTaxDraftCreate', 'accountant', createDraft())
  assert.equal(draft.status, 'draft'); assert.equal(draft.blockers.length, 0); assert.equal(draft.profileSnapshot.tin, h.profile.tin)
  assert.deepEqual(h.get(c.companyId, `taxDrafts/${draft.id}`).mappingSnapshot, h.get(c.companyId, 'taxMappings/default').mappings)
})
test('draft review needs another authorized person, all review requirements, and is immutable after review', async () => {
  const c = await setupMapped(), draft = await h.call('companyTaxDraftCreate', 'manager', createDraft())
  await assert.rejects(h.call('companyTaxDraftReview', 'manager', review(draft)), { code: 'permission-denied' })
  await assert.rejects(h.call('companyTaxDraftReview', 'accountant', review(draft)), { code: 'permission-denied' })
  await assert.rejects(h.call('companyTaxDraftReview', 'owner', { ...review(draft), confirmedRequirements: [] }), { code: 'failed-precondition' })
  await h.call('companyTaxDraftReview', 'owner', review(draft))
  assert.equal(h.get(c.companyId, `taxDrafts/${draft.id}`).status, 'reviewed')
  await assert.rejects(h.call('companyTaxDraftReview', 'owner', review(draft)), { code: 'failed-precondition' })
})
test('intervening books, mapping, tax register, or template edits invalidate draft review', async () => {
  for (const [path, field] of [['accounting/books', 'revision'], ['taxMappings/default', 'version'], ['taxRegisters/default', 'version'], ['taxTemplates/1701', 'version']]) {
    h.reset(); const c = await setupMapped(), draft = await h.call('companyTaxDraftCreate', 'accountant', createDraft())
    h.set(c.companyId, path, { ...(h.get(c.companyId, path) || {}), [field]: 99 })
    await assert.rejects(h.call('companyTaxDraftReview', 'owner', review(draft)), { code: 'aborted' })
    assert.equal(h.get(c.companyId, `taxDrafts/${draft.id}`).status, 'draft')
  }
})
test('missing tax-register details block review unless an explicit nil explanation was captured', async () => {
  await setupMapped()
  const draft = await h.call('companyTaxDraftCreate', 'accountant', createDraft({ form: '1601-C', to: '2026-01-31' }))
  assert.ok(draft.blockers.length)
  await assert.rejects(h.call('companyTaxDraftReview', 'owner', review(draft)), { code: 'failed-precondition' })
  const nil = await h.call('companyTaxDraftCreate', 'accountant', createDraft({ form: '1601-C', to: '2026-01-31', nilReasons: { payroll: 'No compensation payments in this reporting period.' } }))
  assert.equal(nil.blockers.length, 0)
  await h.call('companyTaxDraftReview', 'owner', review(nil))
})
test('custom field templates validate source URL, fields, roles and versions', async () => {
  await setupMapped(); const template = defaultReturnTemplates.find(row => row.code === '1701')
  await assert.rejects(h.call('companyTaxTemplateSave', 'accountant', { template, expectedVersion: 0 }), { code: 'permission-denied' })
  await assert.rejects(h.call('companyTaxTemplateSave', 'owner', { template: { ...template, sourceUrl: 'javascript:alert(1)' }, expectedVersion: 0 }), { code: 'invalid-argument' })
  await h.call('companyTaxTemplateSave', 'owner', { template, expectedVersion: 0 })
  await assert.rejects(h.call('companyTaxTemplateSave', 'owner', { template, expectedVersion: 0 }), { code: 'aborted' })
})
test('company registration changes invalidate an existing return draft', async () => {
  const c = await setupMapped(), draft = await h.call('companyTaxDraftCreate', 'accountant', createDraft())
  const company = h.documents.get(`companies/${c.companyId}`)
  h.documents.set(`companies/${c.companyId}`, { ...company, profile: { ...company.profile, tin: '987-654-321' } })
  await assert.rejects(h.call('companyTaxDraftReview', 'owner', review(draft)), { code: 'aborted' })
})
test('known individual, corporate and VAT forms reject incompatible company registration', async () => {
  const c = await setupMapped()
  for (const form of ['1702-RT', '1702Q', '1702-EX', '1702-MX']) await assert.rejects(h.call('companyTaxDraftCreate', 'accountant', createDraft({ form })), { code: 'failed-precondition' })
  const company = h.documents.get(`companies/${c.companyId}`)
  h.documents.set(`companies/${c.companyId}`, { ...company, profile: { ...company.profile, entityType: 'corporation', incomeTaxRegime: 'corporate', vatStatus: 'non_vat' } })
  for (const form of ['1701', '1701A', '1701-MS', '1701Q', '2550Q']) await assert.rejects(h.call('companyTaxDraftCreate', 'accountant', createDraft({ form })), { code: 'failed-precondition' })
})
