const { test, beforeEach } = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const h = require('./helpers/assets-harness.cjs')()
const engine = require('../lib/assets.js')
beforeEach(() => h.reset())
const accounts = { cost: '1500', accumulatedDepreciation: '1510', depreciationExpense: '5500', accumulatedImpairment: '1520', impairmentExpense: '5510', disposalGain: '4200', disposalLoss: '5600' }
const policy = { method: 'straight_line', startMonth: '2026-09', usefulLifeMonths: 10, residualValue: 0, note: 'Reviewed remaining monthly life and zero residual for this sample; no statutory assumption.' }
function input(extra = {}) { return { code: 'EQ-001', name: 'Example equipment', category: 'Equipment', serialNumber: '', acquisitionDate: '2025-01-01', inServiceDate: '2025-01-01', basisDate: '2026-09-01', cost: 120000, openingDepreciation: 20000, openingImpairment: 0, location: 'Makati', custodian: 'Operations', notes: '', sourceMode: 'opening_journal', sourceEntryId: '', openingEquityAccount: '3000', accounts, bookPolicy: policy, taxPolicy: { ...policy, basis: 120000, openingDepreciation: 30000, usefulLifeMonths: 9 }, ...extra } }
async function setup() { const c = await h.setup(); const ledger = h.get(c.companyId, 'accounting/books'); for (const [code, type] of [['1510', 'Asset'], ['1520', 'Asset'], ['1600', 'Asset'], ['5500', 'Expense'], ['5510', 'Expense'], ['4200', 'Revenue'], ['5600', 'Expense']]) ledger.books.accounts.push({ code, name: code, type, cash: false }); return c.companyId }
const rev = companyId => h.get(companyId, 'assetControl/default')?.revision || 0
async function prepare(companyId, command, user = 'accountant', requestId = `request-${command.reference}`) { return h.call('companyAssets', user, { action: 'prepare', requestId, expectedRevision: rev(companyId), command }) }
async function approve(companyId, run, user = 'manager') { return h.call('companyAssets', user, { action: 'approve', id: run.id, expectedRevision: rev(companyId), reviewNote: 'Independently checked source, amounts, company policy and posting accounts.' }) }
async function register(companyId, extra = {}, reference = 'REG-1') { const draft = await prepare(companyId, { kind: 'register', reference, date: '2026-09-01', input: input(extra) }); return approve(companyId, draft) }
const assets = companyId => [...h.documents].filter(([path]) => path.startsWith(`companies/${companyId}/assets/`)).map(([, value]) => value)
const command = (kind, assetId, extra = {}) => ({ kind, assetId, reference: `${kind}-1`, date: '2026-09-30', note: 'Reviewed accounting assumptions and supporting records.', ...extra })

test('asset server/browser engines stay identical and configuration is explicit', () => {
  assert.equal(readFileSync('src/lib/assets.ts', 'utf8'), readFileSync('functions/src/assets.ts', 'utf8'))
  assert.throws(() => engine.validateAssetInput(input({ bookPolicy: { ...policy, note: '' } }), { accounts: [], entries: [], closedThrough: '' }), /policy|reviewed/)
})
test('asset identity, tenant and role checks run before writes', async () => {
  const companyId = await setup(), request = { action: 'prepare', requestId: 'one', expectedRevision: 0, command: { kind: 'register', reference: 'A', date: '2026-09-01', input: input() } }
  await assert.rejects(h.call('companyAssets', 'nobody', request), { code: 'unauthenticated' })
  await assert.rejects(h.call('companyAssets', 'viewer', request), { code: 'permission-denied' })
  h.user('outsider'); await assert.rejects(h.call('companyAssets', 'outsider', { ...request, companyId }), { code: 'permission-denied' })
  assert.equal(assets(companyId).length, 0)
})
test('opening registration posts atomically only after independent approval and retries are idempotent', async () => {
  const companyId = await setup(), c = { kind: 'register', reference: 'REG-1', date: '2026-09-01', input: input() }, draft = await prepare(companyId, c, 'owner')
  assert.equal(assets(companyId).length, 0); assert.equal(h.get(companyId, 'accounting/books').books.entries.length, 0)
  await assert.rejects(approve(companyId, draft, 'owner'), { code: 'permission-denied' })
  const result = await approve(companyId, draft); const again = await approve(companyId, draft)
  assert.equal(again.alreadyPosted, true); assert.equal(h.get(companyId, 'accounting/books').books.entries.length, 1)
  const asset = assets(companyId)[0]; assert.equal(engine.assetBalances(asset).carryingValue, 100000)
  assert.equal(engine.assetTaxSchedule(asset, '2026-01-01', '2026-09-01').bookDepreciation, 0)
  assert.ok(h.get(companyId, 'assetControl/default').protectedEntryIds.includes(result.entryId))
  assert.equal(engine.assetReconciliation(assets(companyId), h.get(companyId, 'accounting/books').books, '2026-09-01').every(row => row.difference === 0), true)
  assert.equal((await prepare(companyId, c, 'owner')).status, 'posted')
})
test('stale preparation must be rejected and cannot overwrite later books', async () => {
  const companyId = await setup(), draft = await prepare(companyId, { kind: 'register', reference: 'REG-1', date: '2026-09-01', input: input() })
  h.get(companyId, 'accounting/books').revision++
  await assert.rejects(approve(companyId, draft), { code: 'aborted' }); assert.equal(assets(companyId).length, 0)
  await h.call('companyAssets', 'manager', { action: 'reject', id: draft.id, expectedRevision: rev(companyId), reviewNote: 'Books changed; prepare using the latest reviewed source.' })
  assert.equal(h.get(companyId, `assetRuns/${draft.id}`).status, 'rejected')
})
test('existing acquisition linking allocates cost without reposting and rejects duplicate or foreign source', async () => {
  const companyId = await setup(), ledger = h.get(companyId, 'accounting/books')
  ledger.books.entries.push({ id: 'source', date: '2026-08-01', reference: 'ACQ', description: 'Acquisition', source: 'journal', createdAt: '', lines: [{ account: '1500', debit: 120000, credit: 0 }, { account: '3000', debit: 0, credit: 120000 }] }); ledger.books.closedThrough = '2026-09-10'
  await register(companyId, { sourceMode: 'existing_entry', sourceEntryId: 'source', openingDepreciation: 0 })
  assert.equal(ledger.books.entries.length, 1)
  await assert.rejects(register(companyId, { code: 'EQ-002', sourceMode: 'existing_entry', sourceEntryId: 'source', openingDepreciation: 0 }, 'REG-2'), /allocations exceed/)
  await assert.rejects(register(companyId, { code: 'EQ-002', sourceMode: 'existing_entry', sourceEntryId: 'other-company', openingDepreciation: 0 }, 'REG-3'), /unreversed posted/)
})
test('depreciation rejects overlapping months and balances the ledger, with distinct tax schedule', async () => {
  const companyId = await setup(), registered = await register(companyId), assetId = registered.assetIds[0]
  await approve(companyId, await prepare(companyId, command('depreciation', assetId, { assetIds: [assetId], throughMonth: '2026-09' })))
  assert.equal(engine.assetBalances(assets(companyId)[0]).depreciation, 30000)
  assert.deepEqual(engine.assetTaxSchedule(assets(companyId)[0], '2026-09-01', '2026-09-30').bookDepreciation, 10000)
  assert.equal(engine.assetTaxSchedule(assets(companyId)[0], '2026-09-01', '2026-09-30').taxDepreciation, 10000)
  await assert.rejects(prepare(companyId, command('depreciation', assetId, { reference: 'DUP', assetIds: [assetId], throughMonth: '2026-09' })), /already posted/)
  assert.ok(engine.assetReconciliation(assets(companyId), h.get(companyId, 'accounting/books').books, '2026-09-30').every(row => row.difference === 0))
})
test('transfers preserve balances; impairment and disposal book final depreciation and clear asset balances', async () => {
  const companyId = await setup(), registered = await register(companyId), assetId = registered.assetIds[0]
  await approve(companyId, await prepare(companyId, command('transfer', assetId, { location: 'Cebu', custodian: 'Warehouse' })))
  assert.equal(h.get(companyId, 'accounting/books').books.entries.length, 1)
  assert.equal(engine.assetBalances(assets(companyId)[0]).location, 'Cebu')
  await approve(companyId, await prepare(companyId, command('impairment', assetId, { amount: 10000 })))
  await approve(companyId, await prepare(companyId, command('disposal', assetId, { proceeds: 50000, proceedsAccount: '1600', finalDepreciation: 5000 })))
  const a = assets(companyId)[0], balances = engine.assetBalances(a), tax = engine.assetTaxSchedule(a, '2026-09-01', '2026-09-30')
  assert.equal(balances.status, 'disposed'); assert.equal(balances.carryingValue, 0); assert.equal(tax.bookDepreciation, 5000)
  assert.ok(engine.assetReconciliation([a], h.get(companyId, 'accounting/books').books, '2026-09-30').every(row => row.difference === 0))
  await assert.rejects(prepare(companyId, command('transfer', assetId, { reference: 'LATE', location: 'Manila', custodian: 'Office' })), /disposed/)
})
test('latest action reversal restores register, expense and allocations without erasing history', async () => {
  const companyId = await setup(), reg = await register(companyId), assetId = reg.assetIds[0]
  const dep = await approve(companyId, await prepare(companyId, command('depreciation', assetId, { assetIds: [assetId], throughMonth: '2026-09' })))
  await assert.rejects(prepare(companyId, command('reverse', assetId, { runId: reg.id, reference: 'BAD-REVERSE' })), /latest action/)
  await approve(companyId, await prepare(companyId, command('reverse', assetId, { runId: dep.id, reference: 'UNDO-DEP' })))
  assert.equal(engine.assetBalances(assets(companyId)[0]).carryingValue, 100000)
  assert.equal(engine.assetTaxSchedule(assets(companyId)[0], '2026-09-01', '2026-09-30').bookDepreciation, 0)
  await approve(companyId, await prepare(companyId, command('reverse', assetId, { runId: reg.id, reference: 'UNDO-REG' })))
  assert.equal(engine.assetBalances(assets(companyId)[0]).status, 'void'); assert.equal(assets(companyId)[0].events.length, 4)
  assert.equal(engine.assetTaxSchedule(assets(companyId)[0], '2026-09-01', '2026-09-30').bookDepreciation, 0)
})
test('closed dates, over-impairment, bad disposal clearing, and stale asset revisions fail without writes', async () => {
  const companyId = await setup(), reg = await register(companyId), assetId = reg.assetIds[0], before = h.auditCount(companyId)
  await assert.rejects(prepare(companyId, command('impairment', assetId, { amount: 100001 })), /exceed carrying/)
  await assert.rejects(prepare(companyId, command('disposal', assetId, { proceeds: 0, proceedsAccount: '1010', finalDepreciation: 0 })), /non-cash/)
  await assert.rejects(prepare(companyId, command('impairment', assetId, { reference: 'LATE-IMPAIR', date: '2026-10-15', amount: 100 })), /previous month/)
  h.get(companyId, 'accounting/books').books.closedThrough = '2026-09-30'
  await assert.rejects(prepare(companyId, command('transfer', assetId, { location: 'Cebu', custodian: 'Staff' })), /closed/)
  assert.equal(h.auditCount(companyId), before)
})
test('monthly rounding ends exactly at residual value and reversal-derived reports retain historical dates', async () => {
  const companyId = await setup(), reg = await register(companyId, { cost: 10001, openingDepreciation: 0, bookPolicy: { ...policy, usefulLifeMonths: 3, residualValue: 1 }, taxPolicy: { ...policy, basis: 10001, openingDepreciation: 0, usefulLifeMonths: 3, residualValue: 1 } }), assetId = reg.assetIds[0]
  for (const [month, date] of [['09', '30'], ['10', '31'], ['11', '30']]) await approve(companyId, await prepare(companyId, command('depreciation', assetId, { reference: `DEP-${month}`, date: `2026-${month}-${date}`, assetIds: [assetId], throughMonth: `2026-${month}` })))
  assert.equal(engine.assetBalances(assets(companyId)[0]).carryingValue, 1)
  assert.equal(engine.assetBalances(assets(companyId)[0], '2026-09-30').carryingValue, 6668)
})
test('asset journals and acquisition sources cannot be reversed through generic accounting commands', async () => {
  const companyId = await setup(), reg = await register(companyId)
  await assert.rejects(h.call('companyAccountingCommand', 'owner', { expectedRevision: h.get(companyId, 'accounting/books').revision, command: { type: 'reverse', input: { entryId: reg.entryId, date: '2026-09-30' } } }), /asset register/)
  assert.equal(engine.assetBalances(assets(companyId)[0]).status, 'active')
})
test('tax drafts freeze company-configured asset schedules without applying the difference, and require current asset revision', async () => {
  const companyId = await setup(), reg = await register(companyId, { taxPolicy: { ...policy, basis: 120000, openingDepreciation: 30000, usefulLifeMonths: 20 } }), assetId = reg.assetIds[0]
  await approve(companyId, await prepare(companyId, command('depreciation', assetId, { assetIds: [assetId], throughMonth: '2026-09' })))
  const ledger = h.get(companyId, 'accounting/books'), { suggestedMapping } = require('../lib/tax-mapping.js')
  await h.call('companyTaxMappingSave', 'owner', { expectedVersion: 0, mappings: ledger.books.accounts.map(account => ({ account: account.code, category: account.code === '5500' ? 'depreciation' : suggestedMapping(account) || 'other_expenses', note: '' })) })
  const payload = { form: '1701', from: '2026-09-01', to: '2026-09-30', expectedBooksRevision: ledger.revision, expectedMappingVersion: 1, expectedTemplateVersion: 0, expectedRegisterVersion: 0, expectedAssetRevision: rev(companyId), applicabilityConfirmed: true, adjustments: [] }
  await assert.rejects(h.call('companyTaxDraftCreate', 'accountant', { ...payload, expectedAssetRevision: 0 }), { code: 'aborted' })
  const draft = await h.call('companyTaxDraftCreate', 'accountant', payload)
  assert.equal(draft.assetScheduleSnapshot.length, 1)
  assert.equal(draft.assetScheduleSnapshot[0].adjustment, 5500)
  assert.equal(draft.assetScheduleSnapshot[0].assetVersion, 2)
  assert.equal(draft.worksheet.adjustmentTotal, 0)
  assert.equal(draft.fields.find(field => field.id === 'depreciation').amount, 10000)
  await prepare(companyId, command('transfer', assetId, { reference: 'TRANSFER-TAX', location: 'Cebu', custodian: 'Operations' }))
  await assert.rejects(h.call('companyTaxDraftReview', 'owner', { id: draft.id, note: 'Reviewed the current books and required filing support.', confirmedRequirements: draft.template.requirements }), { code: 'aborted' })
  assert.equal(h.get(companyId, `taxDrafts/${draft.id}`).assetScheduleSnapshot[0].adjustment, 5500)
})
