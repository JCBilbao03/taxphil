const { test } = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { pathToFileURL } = require('node:url')
const ts = require('typescript')

const fileUrl = pathToFileURL(__filename)
const source = readFileSync(new URL('../src/components/accounting/SettlementEvidence.tsx', fileUrl), 'utf8')
const accountingSource = readFileSync(new URL('../src/lib/accounting.ts', fileUrl), 'utf8')
const compile = value => ts.transpileModule(value, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
function evaluate(code, imports, globals = {}) {
  const module = { exports: {} }
  new Function('require', 'module', 'exports', ...Object.keys(globals), code)(name => {
    if (!(name in imports)) throw Error(`Unexpected module in isolated component test: ${name}`)
    return imports[name]
  }, module, module.exports, ...Object.values(globals))
  return module.exports
}
const accounting = evaluate(compile(accountingSource), {})
const pdf = (name = 'receipt.pdf', content = '%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF') => new File([content], name, { type: 'application/pdf', lastModified: 100 })
const png = () => new File([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lGkAAAAASUVORK5CYII=', 'base64')], 'deposit.png', { type: 'image/png' })
const jpeg = () => new File([Uint8Array.from([255, 216, 255, 224, 0, 16, 74, 70, 73, 70, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 255, 217])], 'check.jpeg', { type: 'image/jpeg' })
const pending = (file, id = 'selection1', kind = 'collection_receipt') => ({ id, kind, file })
function visit(node, predicate) {
  if (node == null || typeof node === 'boolean') return []
  if (Array.isArray(node)) return node.flatMap(item => visit(item, predicate))
  if (typeof node !== 'object') return []
  return [...(predicate(node) ? [node] : []), ...visit(node.props?.children, predicate)]
}
function renderedText(node) {
  if (node == null || typeof node === 'boolean') return ''
  if (Array.isArray(node)) return node.map(renderedText).join(' ')
  return typeof node === 'object' ? renderedText(node.props?.children) : String(node)
}
const settle = () => new Promise(resolve => setImmediate(resolve))

function load({ dev = false, preview = null, companyId = 'companyA', active = true, upload, blob, hot } = {}) {
  const uploads = [], reads = [], downloads = [], revoked = [], state = [], effects = [], refs = []
  let index = 0, effectIndex = 0, refIndex = 0, cleanups = []
  const effectDeps = []
  const react = {
    useId: () => 'evidence-test', useContext: () => preview,
    useState(initial) { const slot = index++; if (!(slot in state)) state[slot] = typeof initial === 'function' ? initial() : initial; return [state[slot], value => { state[slot] = typeof value === 'function' ? value(state[slot]) : value }] },
    useRef(initial) { const slot = refIndex++; return refs[slot] ??= { current: initial } },
    useEffect(callback, deps) {
      const slot = effectIndex++, previous = effectDeps[slot]
      if (!deps || !previous || deps.some((dep, i) => dep !== previous[i])) { effectDeps[slot] = deps; effects.push(() => { cleanups[slot]?.(); cleanups[slot] = callback() }) }
    },
  }
  const element = (type, props) => ({ type, props })
  const imports = {
    react, 'react/jsx-runtime': { jsx: element, jsxs: element, Fragment: 'Fragment' },
    'lucide-react': { Download: 'Download', FileText: 'FileText', Paperclip: 'Paperclip', X: 'X' },
    'firebase/storage': {
      ref: (_storage, path) => ({ path }),
      uploadBytes: async (reference, file, metadata) => { const record = { path: reference.path, file, metadata }; uploads.push(record); if (upload) await upload(record); return {} },
      getBlob: async (reference, maxBytes) => { reads.push({ path: reference.path, maxBytes }); return typeof blob === 'function' ? blob(reference.path) : blob || pdf() },
    },
    '@/components/ui/button': { Button: 'Button' }, '@/lib/firebase': { storage: {} },
    '@/hooks/useCompany': { useCompany: () => ({ membership: companyId ? { companyId, active } : null }) },
    '@/hooks/useCompanyRecords': { CompanyRecordsPreview: {} }, '@/lib/accounting': accounting,
  }
  const globals = {
    __hot: hot,
    document: { body: { appendChild() {} }, createElement: () => ({ style: {}, click() { downloads.push({ href: this.href, name: this.download }) }, remove() {} }) },
    URL: { createObjectURL: () => 'blob:private-document', revokeObjectURL: url => revoked.push(url) },
    setTimeout: callback => { callback(); return 0 },
  }
  const api = evaluate(compile(source.replaceAll('import.meta.env.DEV', String(dev)).replaceAll('import.meta.hot', '__hot')), imports, globals)
  return {
    api, uploads, reads, downloads, revoked,
    render(name, props) { index = 0; effectIndex = 0; refIndex = 0; const tree = api[name](props); while (effects.length) effects.shift()(); return tree },
    unmount() { cleanups.forEach(cleanup => cleanup?.()); cleanups = [] },
  }
}

test('checks genuine PDF/PNG/JPEG signatures and accepts an absent browser MIME only when bytes and extension match', async () => {
  const { api } = load()
  for (const file of [pdf(), png(), jpeg()]) assert.deepEqual(await api.validatePendingSettlementEvidenceFile(file), { name: file.name, size: file.size, type: file.type })
  const noMime = new File([await png().arrayBuffer()], 'deposit.PNG')
  assert.equal((await api.validatePendingSettlementEvidenceFile(noMime)).type, 'image/png')
  const opaqueMime = new File([await pdf().arrayBuffer()], 'receipt.pdf', { type: 'application/octet-stream' })
  assert.equal((await api.validatePendingSettlementEvidenceFile(opaqueMime)).type, 'application/pdf')
  for (const file of [
    new File(['<html>receipt</html>'], 'receipt.pdf', { type: 'application/pdf' }),
    new File([await png().arrayBuffer()], 'receipt.pdf', { type: 'application/pdf' }),
    new File([await pdf().arrayBuffer()], 'receipt.png', { type: 'image/png' }),
    new File(['%PDF-1.7'], 'receipt.pdf', { type: 'image/png' }),
    new File([Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10])], 'truncated.png', { type: 'image/png' }),
  ]) await assert.rejects(api.validatePendingSettlementEvidenceFile(file), /contents|type.*match/i)
})

test('rejects empty, oversized, unsafe names and mismatched extensions before any upload', async () => {
  const { api, uploads } = load()
  for (const file of [pdf('../receipt.pdf'), pdf('folder\\receipt.pdf'), pdf('receipt\u0000.pdf'), pdf('a'.repeat(201) + '.pdf'), pdf('.pdf'), pdf(' receipt.pdf'), pdf('receipt.exe'), new File([], 'empty.pdf'), new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'large.pdf', { type: 'application/pdf' })]) await assert.rejects(api.saveSettlementEvidence([pending(file)], 'companyA'))
  assert.equal(uploads.length, 0)
})

test('validates the entire batch and its metadata before starting any remote upload', async () => {
  const { api, uploads } = load()
  await assert.rejects(api.saveSettlementEvidence([pending(pdf(), 'first'), pending(new File(['text'], 'broken.png'), 'second')], 'companyA'), /matching/)
  await assert.rejects(api.saveSettlementEvidence([pending(pdf(), 'first', 'unknown')], 'companyA'), /kind|type/i)
  await assert.rejects(api.saveSettlementEvidence([pending(pdf())], '../otherCompany'), /active company/)
  await assert.rejects(api.saveSettlementEvidence([pending(pdf())], undefined), /active company/)
  await assert.rejects(api.saveSettlementEvidence([{ file: pdf(), kind: 'collection_receipt' }], 'companyA'), /selection ID/)
  await assert.rejects(api.saveSettlementEvidence(Array.from({ length: 11 }, (_, index) => pending(pdf(), `id${index}`)), 'companyA'), /10/)
  const sameFile = pdf()
  await assert.rejects(api.saveSettlementEvidence([pending(sameFile, 'one'), pending(sameFile, 'two')], 'companyA'), /unique/)
  await assert.rejects(api.saveSettlementEvidence([pending(pdf('one.pdf'), 'same'), pending(pdf('two.pdf'), 'same')], 'companyA'), /unique/)
  assert.equal(uploads.length, 0)
})

test('partial upload failures retain successful files and retry only the failed file', async () => {
  let failSecond = true
  const harness = load({ upload: async ({ file }) => { if (file.name === 'second.pdf' && failSecond) { failSecond = false; throw Error('connection failed') } } })
  const items = [pending(pdf('first.pdf'), 'first'), pending(pdf('second.pdf'), 'second')]
  await assert.rejects(harness.api.saveSettlementEvidence(items, 'companyA'), /Files already uploaded will be reused/)
  const firstPath = harness.uploads[0].path
  const result = await harness.api.saveSettlementEvidence(items, 'companyA')
  assert.deepEqual(harness.uploads.map(item => item.file.name), ['first.pdf', 'second.pdf', 'second.pdf'])
  assert.equal(result[0].path, firstPath)
  assert.equal(result[1].kind, 'collection_receipt')
  assert.deepEqual(Object.keys(result[0]).sort(), ['kind', 'name', 'path', 'size', 'type'])
  assert.equal(harness.uploads[0].metadata.contentType, 'application/pdf')
  assert.match(firstPath, /^companies\/companyA\/settlement-evidence\/[a-z\d-]+$/i)
})

test('concurrent saves share uploads, changing document kind reuses bytes, and different files/companies do not reuse paths', async () => {
  const harness = load(), file = pdf()
  const item = pending(file)
  const [first, concurrent] = await Promise.all([harness.api.saveSettlementEvidence([item], 'companyA'), harness.api.saveSettlementEvidence([item], 'companyA')])
  assert.equal(harness.uploads.length, 1)
  assert.deepEqual(first, concurrent)
  const changedKind = await harness.api.saveSettlementEvidence([{ ...item, kind: 'transfer_confirmation' }], 'companyA')
  assert.equal(changedKind[0].kind, 'transfer_confirmation')
  assert.equal(changedKind[0].path, first[0].path)
  const companyB = await harness.api.saveSettlementEvidence([item], 'companyB')
  assert.notEqual(companyB[0].path, first[0].path)
  const replaced = await harness.api.saveSettlementEvidence([{ ...item, file: pdf() }], 'companyA')
  assert.notEqual(replaced[0].path, first[0].path)
  assert.equal(harness.uploads.length, 3)
})

test('selector allows only relevant receipt/payment types and performs no upload before submit', async () => {
  const harness = load(), changes = [], validating = []
  const props = { invoiceKind: 'receivable', value: [], onChange: value => changes.push(value), onValidating: value => validating.push(value) }
  let tree = harness.render('SettlementEvidence', props)
  const choices = visit(tree, node => node.type === 'option').map(node => node.props.value)
  assert.deepEqual(choices, ['', 'collection_receipt', 'deposit_slip', 'transfer_confirmation'])
  assert.equal(visit(tree, node => node.type === 'input')[0].props.disabled, true)
  visit(tree, node => node.type === 'select')[0].props.onChange({ target: { value: 'collection_receipt' } })
  tree = harness.render('SettlementEvidence', props)
  const input = visit(tree, node => node.type === 'input')[0]
  assert.equal(input.props.disabled, false)
  input.props.onChange({ target: { files: [pdf('first.pdf'), png()], value: 'selected' } })
  await settle()
  assert.equal(changes.length, 1)
  assert.equal(changes[0].length, 2)
  assert.equal(changes[0][0].kind, 'collection_receipt')
  assert.deepEqual(validating, [true, false])
  assert.equal(harness.uploads.length, 0)
  const payment = load().render('SettlementEvidence', { ...props, invoiceKind: 'payable' })
  assert.deepEqual(visit(payment, node => node.type === 'option').map(node => node.props.value), ['', 'payment_approval', 'check_copy', 'transfer_confirmation', 'vendor_collection_receipt'])
})

test('existing attachments count toward the maximum and an over-capacity selection never reaches onChange', async () => {
  const harness = load(), changes = []
  const props = { invoiceKind: 'receivable', existingCount: 9, value: [], onChange: value => changes.push(value) }
  let tree = harness.render('SettlementEvidence', props)
  visit(tree, node => node.type === 'select')[0].props.onChange({ target: { value: 'collection_receipt' } })
  tree = harness.render('SettlementEvidence', props)
  visit(tree, node => node.type === 'input')[0].props.onChange({ target: { files: [pdf('one.pdf'), pdf('two.pdf')], value: '' } })
  await settle()
  tree = harness.render('SettlementEvidence', props)
  assert.equal(changes.length, 0)
  assert.match(renderedText(tree), /including files already saved/)
  assert.match(renderedText(tree), /9 saved, 0 selected/)
  tree = harness.render('SettlementEvidence', { ...props, value: [pending(pdf())] })
  assert.equal(visit(tree, node => node.type === 'input')[0].props.disabled, true)
  assert.match(renderedText(tree), /10\s+of 10/)
})

test('authenticated downloads validate company scope before storage access and use private blobs rather than public URLs', async () => {
  const file = pdf(), metadata = { path: 'companies/companyA/settlement-evidence/file1', name: file.name, size: file.size, type: file.type, kind: 'collection_receipt' }
  const allowed = load({ blob: file })
  const tree = allowed.render('SettlementEvidenceList', { files: [metadata] })
  visit(tree, node => node.type === 'button')[0].props.onClick()
  await settle()
  assert.deepEqual(allowed.reads, [{ path: metadata.path, maxBytes: 10 * 1024 * 1024 }])
  assert.deepEqual(allowed.downloads, [{ href: 'blob:private-document', name: 'receipt.pdf' }])
  assert.deepEqual(allowed.revoked, ['blob:private-document'])
  for (const options of [{ companyId: 'otherCompany' }, { active: false }]) {
    const denied = load(options)
    visit(denied.render('SettlementEvidenceList', { files: [metadata] }), node => node.type === 'button')[0].props.onClick()
    await settle()
    assert.equal(denied.reads.length, 0)
    assert.equal(denied.downloads.length, 0)
    assert.match(renderedText(denied.render('SettlementEvidenceList', { files: [metadata] })), /company/i)
  }
})

test('development preview files survive hot reload without storage reads; missing preview bytes never fall back to production', async () => {
  const hot = { data: {} }, before = load({ dev: true, preview: {}, hot })
  const files = await before.api.saveSettlementEvidence([pending(pdf())], 'companyA', true)
  assert.equal(before.uploads.length, 0)
  const after = load({ dev: true, preview: {}, hot })
  visit(after.render('SettlementEvidenceList', { files }), node => node.type === 'button')[0].props.onClick()
  await settle()
  assert.equal(after.downloads.length, 1)
  assert.equal(after.reads.length, 0)
  const missing = load({ dev: true, preview: {}, hot: { data: {} } })
  visit(missing.render('SettlementEvidenceList', { files }), node => node.type === 'button')[0].props.onClick()
  await settle()
  assert.equal(missing.reads.length, 0)
  assert.match(renderedText(missing.render('SettlementEvidenceList', { files })), /no longer in memory/)
  const production = load({ preview: {} })
  await assert.rejects(production.api.saveSettlementEvidence([pending(pdf())], 'companyA', true), /local preview/)
  assert.equal(production.uploads.length, 0)
  visit(production.render('SettlementEvidenceList', { files }), node => node.type === 'button')[0].props.onClick()
  await settle()
  assert.equal(production.reads.length, 0)
})

test('a stored-size mismatch cannot trigger a download', async () => {
  const file = pdf(), metadata = { path: 'companies/companyA/settlement-evidence/file1', name: file.name, size: file.size + 10, type: file.type, kind: 'collection_receipt' }
  const harness = load({ blob: file })
  visit(harness.render('SettlementEvidenceList', { files: [metadata] }), node => node.type === 'button')[0].props.onClick()
  await settle()
  assert.equal(harness.downloads.length, 0)
  assert.match(renderedText(harness.render('SettlementEvidenceList', { files: [metadata] })), /stored file differs/)
})
