const { test } = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { resolve } = require('node:path')
const ts = require('typescript')
const read = path => readFileSync(resolve(__dirname, '..', path), 'utf8')
const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
function evaluate(source, imports) { const module = { exports: {} }; new Function('require', 'module', 'exports', compile(source))(name => { if (!(name in imports)) throw Error(`Unexpected isolated import: ${name}`); return imports[name] }, module, module.exports); return module.exports }
const accounting = evaluate(read('src/lib/accounting.ts'), {}), bank = evaluate(read('src/lib/bank-reconciliation.ts'), {}), payment = evaluate(read('src/lib/payment-workflow.ts'), {})
const source = read('src/components/accounting/PaymentWorkspace.tsx') + '\nexport { PreparePayment, PaymentDetail, PaymentAction };'
const text = node => node == null || typeof node === 'boolean' ? '' : Array.isArray(node) ? node.map(text).join(' ') : typeof node === 'object' ? text(node.props?.children) : String(node)
const visit = (node, predicate) => node == null || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(value => visit(value, predicate)) : [...(predicate(node) ? [node] : []), ...visit(node.props?.children, predicate)]
const button = (tree, label) => visit(tree, node => node.type === 'Button' && text(node).trim() === label)[0]
async function clickSubmit(tree, label) { const target=button(tree,label); assert.ok(target,`Missing submit action: ${label}`); assert.equal(target.props.type,'submit','The actual Button must submit its form; Base UI defaults to button'); assert.equal(Boolean(target.props.disabled),false,'The submit action must be enabled'); await tree.props.onSubmit({preventDefault(){}}) }
const field = (tree, label) => visit(tree, node => typeof node.type === 'function' && node.type.name === 'Field' && node.props.label === label)[0]?.props.children
const savedFile = { path: 'companies/companyA/settlement-evidence/check', name: 'check.pdf', size: 100, type: 'application/pdf', kind: 'check_copy' }
function load({ upload } = {}) {
  let index = 0, refIndex = 0, effectIndex = 0
  const states = [], refs = [], effects = [], uploads = [], sent = [], completed = []
  let books = accounting.addInvoice(accounting.emptyBooks(), { kind: 'payable', party: 'Fictional supplier', reference: 'BILL1', date: '2026-01-01', due: '2026-09-30', amount: 100000, account: '5900' })
  const company = { membership: { uid: 'reviewer', role: 'admin', companyId: 'companyA', active: true }, books, revision: 9, busy: false, booksReady: true }
  const bankAccount = { id: 'bankA', name: 'Sample bank', bankName: 'Sample bank', accountSuffix: '1234', accountCode: '1010', active: true }
  const record = { id: 'payment1', version: 2, status: 'approved', invoiceId: books.invoices[0].id, bankId: 'bankA', amount: 100000, plannedDate: '2026-09-01', method: 'check', checkNumber: 'CHK1', reference: 'PAY1', notes: 'Reviewed fictional payment.', supportingDocuments: [savedFile], cashAccount: '1010', bankName: 'Sample bank', accountSuffix: '1234', payee: 'Fictional supplier', invoiceReference: 'BILL1', createdBy: 'preparer', createdAt: '2026-09-01T00:00:00Z', updatedBy: 'reviewer', updatedAt: '2026-09-01T01:00:00Z', approvedBy: 'reviewer', approvedAt: '2026-09-01T01:00:00Z' }
  const element = (type, props) => ({ type, props })
  const api = evaluate(source, { react: { useContext: () => null, useState(initial) { const i = index++; if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial; return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value }] }, useRef(initial) { const i = refIndex++; return refs[i] ??= { current: initial } }, useEffect(callback) { const i = effectIndex++; if (!(i in effects)) effects[i] = callback() } }, 'react/jsx-runtime': { jsx: element, jsxs: element, Fragment: 'Fragment' }, 'react-router-dom': { Link: 'Link' }, 'lucide-react': {}, '@/components/ui/button': { Button: 'Button' }, '@/hooks/useCompany': { useCompany: () => company }, '@/hooks/useCompanyRecords': { CompanyRecordsPreview: {}, useCompanyRecords: () => ({ rows: [], loading: false, error: '' }) }, '@/lib/accounting': accounting, '@/lib/bank-reconciliation': bank, '@/lib/payment-workflow': payment, './SettlementEvidence': { SettlementEvidence: 'SettlementEvidence', SettlementEvidenceList: 'SettlementEvidenceList', async saveSettlementEvidence(documents, companyId) { uploads.push({ documents, companyId }); if (upload) return upload(documents); return [] } }, './SupplierBillPdf': { SupplierBillPdfLink: 'SupplierBillPdfLink' } })
  const send = async (request, message) => { sent.push({ request, message }); return { id: record.id } }, done = value => completed.push(value)
  return { api, company, record, bankAccount, sent, uploads, completed, send, done, render(name, props) { index = 0; refIndex = 0; effectIndex = 0; return api[name](props) }, unmount() { effects.forEach(cleanup => cleanup?.()) } }
}
function actionProps(h, extra = {}) { return { action: 'release', payment: h.record, books: h.company.books, busy: false, setBusy() {}, send: h.send, done: h.done, ...extra } }
function completeRelease(h, props) {
  let tree = h.render('PaymentAction', props)
  field(tree, 'Actual release date').props.onChange({ target: { value: '2026-09-10' } })
  field(tree, 'Check release / acknowledgment reference').props.onChange({ target: { value: 'CHECK-HANDED-TO-PAYEE' } })
  field(tree, 'Release note: completion and delivery to the payee').props.onChange({ target: { value: 'Released to the named payee and verified acknowledgment.' } })
  visit(tree, node => node.type === 'input' && node.props.type === 'checkbox')[0].props.onChange({ target: { checked: true } })
  return h.render('PaymentAction', props)
}

test('a preparer cannot approve their own request and approval does not say it posts cash', () => {
  const h = load(); h.company.membership.uid = 'preparer'
  const tree = h.render('PaymentDetail', { payment: { ...h.record, status: 'pending' }, versions: [], books: h.company.books, statements: [], busy: false, setBusy() {}, send: h.send })
  assert.equal(button(tree, 'Approve for release').props.disabled, true)
  assert.match(text(tree), /Another Admin or Manager must approve/)
})
test('release remains disabled without the method-specific evidence even after completion is confirmed', () => {
  const h = load(), props = actionProps(h, { payment: { ...h.record, supportingDocuments: [{ ...savedFile, kind: 'payment_approval' }] } }), tree = completeRelease(h, props)
  assert.equal(button(tree, 'Record actual payment release').props.disabled, true)
  assert.match(text(tree), /Required: check copy/)
})
test('release sends actual completion, captured versions, and only new evidence; existing check proof is reused', async () => {
  const h = load(), props = actionProps(h), tree = completeRelease(h, props), before = JSON.stringify(h.company.books)
  assert.equal(button(tree, 'Record actual payment release').props.disabled, false)
  await clickSubmit(tree,'Record actual payment release')
  assert.equal(h.sent.length, 1)
  assert.deepEqual(h.sent[0].request, { action: 'release', id: h.record.id, expectedVersion: 2, expectedBooksRevision: 9, releaseDate: '2026-09-10', confirmation: 'check_released', confirmationReference: 'CHECK-HANDED-TO-PAYEE', supportingDocuments: [], note: 'Released to the named payee and verified acknowledgment.' })
  assert.equal(JSON.stringify(h.company.books), before, 'The interface itself never changes accounting books before the callable succeeds')
})
test('a changed ledger revision blocks release rather than silently using the new books', async () => {
  const h = load(), props = actionProps(h); completeRelease(h, props); h.company.revision = 10
  const tree = h.render('PaymentAction', props)
  assert.equal(button(tree, 'Record actual payment release').props.disabled, true)
  await tree.props.onSubmit({ preventDefault() {} })
  assert.equal(h.sent.length, 0)
  assert.equal(h.uploads.length, 0)
})
test('leaving the page during an evidence upload prevents a later payment release call', async () => {
  let resolveUpload
  const h = load({ upload: () => new Promise(resolve => { resolveUpload = resolve }) }), props = actionProps(h), tree = completeRelease(h, props)
  const pending = tree.props.onSubmit({ preventDefault() {} }); h.unmount(); resolveUpload([]); await pending
  assert.equal(h.sent.length, 0)
})
test('payment preparation retains its request ID across retries and makes no cash posting', async () => {
  const h = load(), props = { books: h.company.books, payments: [], accounts: [h.bankAccount], busy: false, setBusy() {}, send: async request => { h.sent.push({ request }); throw Error('Temporary connection failure') }, done: h.done }
  let tree = h.render('PreparePayment', props)
  for (const [label, value] of [['Unpaid supplier bill', h.record.invoiceId], ['Company bank account', 'bankA'], ['Payment amount (PHP)', '1000.00'], ['Planned payment date', '2026-09-10'], ['Payment method', 'transfer'], ['Request reference', 'PAY-RETRY'], ['Payment purpose and review notes', 'Reviewed supplier payment for the original bill.']]) field(tree, label).props.onChange({ target: { value } })
  visit(tree, node => node.type === 'input' && node.props.type === 'checkbox')[0].props.onChange({ target: { checked: true } })
  tree = h.render('PreparePayment', props); const before = JSON.stringify(h.company.books)
  await clickSubmit(tree,'Submit for payment approval'); tree = h.render('PreparePayment', props); await clickSubmit(tree,'Submit for payment approval')
  assert.equal(h.sent.length, 2); assert.equal(h.sent[0].request.requestId, h.sent[1].request.requestId)
  assert.equal(h.sent[0].request.action, 'prepare'); assert.equal(h.sent[0].request.input.amount, 100000)
  assert.equal(JSON.stringify(h.company.books), before)
})

test('every payment action exposes an explicit submit button and a non-submitting back action', () => {
 for(const action of ['approve','reject','cancel','release','attachDocuments']){const h=load(),tree=h.render('PaymentAction',actionProps(h,{action}));const submits=visit(tree,node=>node.type==='Button'&&node.props.type==='submit');assert.equal(submits.length,1,action);assert.equal(button(tree,'Back to payment details').props.type,'button')}
})
