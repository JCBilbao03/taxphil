const { test } = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { resolve } = require('node:path')
const ts = require('typescript')
const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
const evaluate = (source, imports, globals = {}) => { const module = { exports: {} }; new Function('require', 'module', 'exports', ...Object.keys(globals), compile(source))(name => { if (!(name in imports)) throw Error(`Unexpected isolated import: ${name}`); return imports[name] }, module, module.exports, ...Object.values(globals)); return module.exports }
const read = path => readFileSync(resolve(__dirname, '..', path), 'utf8')
const accounting = evaluate(read('src/lib/accounting.ts'), {})
const mapping = evaluate(read('src/lib/tax-mapping.ts'), {})
const returns = evaluate(read('src/lib/tax-returns.ts'), { './tax-mapping.ts': mapping, './tax-mapping.js': mapping })
const assets = evaluate(read('src/lib/assets.ts'), {})
const source = read('src/components/accounting/TaxWorkspace.tsx') + '\nexport { ReturnPreparer, PaperView, AssetScheduleView };'
const text = node => node == null || typeof node === 'boolean' ? '' : Array.isArray(node) ? node.map(text).join(' ') : typeof node === 'object' ? text(node.props?.children) : String(node)
const visit = (node, predicate) => node == null || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(value => visit(value, predicate)) : [...(predicate(node) ? [node] : []), ...visit(node.props?.children, predicate)]
function load() {
  let index = 0
  const states = [], calls = [], blobs = []
  const company = { membership: { uid: 'reviewer', role: 'admin', active: true }, books: accounting.emptyBooks(), revision: 12, busy: false, invoke: async (name, input) => { calls.push({ name, input }); return { id: 'saved-preview' } } }
  const element = (type, props) => ({ type, props })
  const api = evaluate(source, {
    react: { useState(initial) { const i = index++; if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial; return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value }] }, useEffect() {}, useRef: initial => ({ current: initial }) },
    'react/jsx-runtime': { jsx: element, jsxs: element, Fragment: 'Fragment' },
    'react-router-dom': { Link: 'Link', useSearchParams: () => [new URLSearchParams('form=1702-RT')] },
    'lucide-react': {}, '@/components/ui/button': { Button: 'Button' }, '@/hooks/useCompany': { useCompany: () => company }, '@/hooks/useCompanyRecords': { useCompanyRecords: () => ({ rows: [], loading: false, error: '' }) }, '@/lib/accounting': accounting, '@/lib/assets': assets, '@/lib/tax-mapping': mapping, '@/lib/tax-returns': returns,
  }, { document: { createElement: () => ({ click() {} }) }, URL: { createObjectURL(blob) { blobs.push(blob); return 'blob:test' }, revokeObjectURL() {} }, setTimeout(callback) { callback() } })
  return { api, company, calls, blobs, render(name, props) { index = 0; return api[name](props) } }
}
const policy = { method: 'straight_line', startMonth: '2026-01', usefulLifeMonths: 18, residualValue: 0, note: 'Historical reviewed book policy.' }
const row = { assetId: 'asset-1', assetVersion: 3, code: '=SUM(1,2)', name: 'Fictional equipment', from: '2026-01-01', to: '2026-08-31', bookDepreciation: 800, taxDepreciation: 600, adjustment: 200, taxBasis: 2400000, bookPolicySnapshot: policy, taxPolicySnapshot: { ...policy, usefulLifeMonths: 24, basis: 2400000, openingDepreciation: 0, note: 'Historical reviewed tax policy.' }, note: 'Historical reviewed tax policy.', reviewRequired: true, warning: 'Company configured schedule; review treatment.' }
function paper(harness) { return returns.buildReturnWorkingPaper(harness.company.books, [], returns.defaultReturnTemplates.find(t => t.code === '1702-RT'), [], row.from, row.to) }
function draft(harness) { return { ...paper(harness), id: 'historical', form: '1702-RT', from: row.from, to: row.to, status: 'draft', createdBy: 'preparer', createdAt: '2026-09-01T00:00:00Z', booksRevision: 12, mappingVersion: 2, templateVersion: 0, registerVersion: 4, assetRevision: 8, assetScheduleSnapshot: [row] } }

test('saving a return includes the reviewed asset register revision', async () => {
  const h = load(), props = { mapping: [], mappingVersion: 2, records: [], registerVersion: 4, templates: [], drafts: [], assets: [], assetRevision: 8 }
  let tree = h.render('ReturnPreparer', props)
  const confirm = visit(tree, node => node.type === 'input' && node.props.type === 'checkbox')[0]
  confirm.props.onChange({ target: { checked: true } })
  tree = h.render('ReturnPreparer', props)
  const save = visit(tree, node => node.type === 'Button' && text(node).includes('Save accounting draft'))[0]
  assert.equal(save.props.disabled, false)
  await save.props.onClick()
  assert.equal(h.calls.length, 1)
  assert.equal(h.calls[0].name, 'companyTaxDraftCreate')
  assert.equal(h.calls[0].input.expectedAssetRevision, 8)
  assert.equal(h.calls[0].input.expectedBooksRevision, 12)
})

test('full working paper export preserves the historical asset snapshot instead of current schedule values', async () => {
  const h = load(), saved = draft(h)
  const tree = h.render('PaperView', { paper: saved, draft: saved, assetSchedule: [{ ...row, taxDepreciation: 999999 }], assetRevision: 9, currentAssetRevision: 9, onCurrent() {}, onReviewed() {} })
  visit(tree, node => node.type === 'Button' && text(node).includes('Full working paper'))[0].props.onClick()
  const exported = JSON.parse(await h.blobs[0].text())
  assert.equal(exported.assetRevision, 8)
  assert.equal(exported.assetScheduleSnapshot[0].taxDepreciation, 600)
  assert.equal(exported.assetScheduleSnapshot[0].taxPolicySnapshot.usefulLifeMonths, 24)
})

test('an asset revision change disables review and explains the required refreshed draft', () => {
  const h = load(), saved = draft(h)
  const tree = h.render('PaperView', { paper: saved, draft: saved, assetSchedule: saved.assetScheduleSnapshot, assetRevision: 8, currentAssetRevision: 9, onCurrent() {}, onReviewed() {} })
  assert.match(text(tree), /asset register or its review workflow changed/)
  assert.equal(visit(tree, node => node.type === 'Button' && text(node).includes('Mark working paper reviewed'))[0].props.disabled, true)
})

test('asset schedule export retains policy evidence, precise amounts and neutralizes spreadsheet formulas', async () => {
  const h = load(), tree = h.render('AssetScheduleView', { rows: [row], revision: 8, form: '1702-RT', to: row.to, saved: true })
  visit(tree, node => node.type === 'Button' && text(node).includes('Export asset schedule'))[0].props.onClick()
  const exported = await h.blobs[0].text()
  assert.match(exported, /"'=SUM\(1,2\)"/)
  assert.match(exported, /"8\.00","6\.00","2\.00"/)
  assert.match(exported, /Historical reviewed tax policy/)
  assert.match(text(tree), /not automatically added/)
})

test('older papers without snapshots are shown as missing instead of silently using current assets', () => {
  const h = load(), tree = h.render('AssetScheduleView', { rows: undefined, revision: undefined, form: '1702-RT', to: row.to, saved: true })
  assert.match(text(tree), /older working paper does not include an asset snapshot/)
  assert.equal(visit(tree, node => node.type === 'Button').length, 0)
})
