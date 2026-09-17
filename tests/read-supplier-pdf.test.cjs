const { test } = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const ts = require('typescript')
const pdfSource = readFileSync(new URL('../src/lib/read-supplier-pdf.ts', `file://${__filename}`), 'utf8').replace('import.meta.env.BASE_URL', "'/'")
const ops = { save: 1, restore: 2, transform: 3, paintImageXObject: 4, paintInlineImageXObject: 5, paintImageXObjectRepeat: 6, paintInlineImageXObjectGroup: 7 }
const textItem = (str, x = 30, y = 800, width = 300) => ({ str, dir: 'ltr', transform: [12, 0, 0, 12, x, y], height: 12, width, fontName: 'font', hasEOL: true })
const nativeText = 'ACME SUPPLIER COMPANY VAT INVOICE INV-101 issued September 17 2026. Consulting service quantity 1 total PHP 1,120.00. Registered address Manila Philippines.'
function load(mockPdf, fastTimeout = false) {
  const source = fastTimeout ? pdfSource.replace('totalMilliseconds: 240_000', 'totalMilliseconds: 30').replace('stageMilliseconds: 45_000', 'stageMilliseconds: 20') : pdfSource
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const module = { exports: {} }
  new Function('require', 'module', 'exports', code)(name => name === 'pdfjs-dist' ? mockPdf : require(name), module, module.exports)
  return module.exports
}
const helper = load({})
test('PDF text lines retain row order and larger item/amount column gaps', () => {
  const result = helper.supplierPdfTextLines([textItem('1,120.00', 400, 760, 60), textItem('ACME SUPPLIER', 30, 800, 150), textItem('Consulting service', 30, 760, 150)], { convertToViewportPoint: (x, y) => [x, 842 - y] })
  assert.equal(result, 'ACME SUPPLIER\nConsulting service\t1,120.00')
})
test('mixed image/text pages trigger OCR while a small logo does not', () => {
  const raster = (width, height) => ({ fnArray: [ops.save, ops.transform, ops.paintImageXObject, ops.restore], argsArray: [[], [width, 0, 0, height, 0, 0], ['image'], []] })
  assert.equal(helper.supplierPageNeedsOcr(nativeText, raster(500, 500), ops, 595 * 842), true)
  assert.equal(helper.supplierPageNeedsOcr(nativeText, raster(350, 100), ops, 595 * 842), true)
  assert.equal(helper.supplierPageNeedsOcr(nativeText, raster(50, 50), ops, 595 * 842), false)
  assert.equal(helper.supplierPageNeedsOcr('page 1', raster(1, 1), ops, 595 * 842), true)
})
test('file type, size and prior cancellation are rejected before PDF initialization', async () => {
  let opened = false
  const reader = load({ getDocument: () => { opened = true } })
  await assert.rejects(reader.readSupplierPdf(new File(['not-a-pdf'], 'fake.pdf')), /not a valid PDF/)
  await assert.rejects(reader.readSupplierPdf({ size: 11 * 1024 * 1024, arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)) }), /10 MB/)
  const controller = new AbortController(); controller.abort()
  await assert.rejects(reader.readSupplierPdf(new File(['%PDF-1.7'], 'test.pdf'), { signal: controller.signal }), { name: 'AbortError' })
  assert.equal(opened, false)
})

test('reader uses native text and local worker URL, and always destroys the PDF task', async () => {
  const original = { window: global.window, document: global.document, Worker: global.Worker }
  const workers = []
  let destroyed = 0, cleaned = 0
  global.window = { location: { origin: 'https://accounting.example' } }
  global.Worker = class { constructor(url) { workers.push(url) } }
  const viewport = { width: 595, height: 842, convertToViewportPoint: (x, y) => [x, 842 - y] }
  const page = { getViewport: () => viewport, getTextContent: async () => ({ items: [textItem(nativeText)] }), getOperatorList: async () => ({ fnArray: [], argsArray: [] }), cleanup: () => { cleaned++ } }
  const pdf = { version: '6.3.289', OPS: ops, GlobalWorkerOptions: {}, getDocument: options => {
    assert.equal(options.enableXfa, false); assert.equal(options.stopAtErrors, true)
    for (const key of ['cMapUrl', 'standardFontDataUrl', 'wasmUrl']) assert.equal(new URL(options[key]).origin, 'https://accounting.example')
    return { promise: Promise.resolve({ numPages: 1, getPage: async () => page }), destroy: async () => { destroyed++ } }
  } }
  try {
    const result = await load(pdf).readSupplierPdf(new File(['%PDF-1.7'], 'invoice.pdf'), { onProgress: () => { throw Error('UI callback') } })
    assert.equal(result.ocr, false); assert.equal(result.pages, 1); assert.match(result.text, /ACME SUPPLIER/)
    assert.equal(workers.length, 0); assert.equal(destroyed, 1); assert.equal(cleaned, 1)
    assert.equal(new URL(pdf.GlobalWorkerOptions.workerSrc).origin, 'https://accounting.example')
  } finally { Object.assign(global, original) }
})

function fakeOcrEnvironment({ hangAction, rejectAction, pages = 1 } = {}) {
  const original = { window: global.window, document: global.document, Worker: global.Worker }
  const workers = []; let destroyed = 0, rendered = 0
  global.window = { location: { origin: 'https://accounting.example' } }
  global.document = { createElement: () => ({ width: 0, height: 0, toBlob: callback => callback(new Blob(['fake png'], { type: 'image/png' })) }) }
  global.Worker = class {
    constructor(url) { this.url = url; this.jobs = []; this.terminated = false; workers.push(this) }
    postMessage(message) {
      this.jobs.push(message)
      if (message.action === hangAction) return
      queueMicrotask(() => { if (!this.terminated) this.onmessage?.({ data: { jobId: message.jobId, status: message.action === rejectAction ? 'reject' : 'resolve', data: message.action === 'recognize' ? { text: 'SUPPLIER VAT INVOICE\nTotal 1120.00', confidence: 92 } : {} } }) })
    }
    terminate() { this.terminated = true }
  }
  const page = { getViewport: ({ scale }) => ({ width: 595 * scale, height: 842 * scale, convertToViewportPoint: (x, y) => [x, 842 - y] }), getTextContent: async () => ({ items: [] }), getOperatorList: async () => ({ fnArray: [], argsArray: [] }), render: () => { rendered++; return { promise: Promise.resolve(), cancel() {} } }, cleanup() {} }
  const pdf = { version: '6.3.289', OPS: ops, AnnotationMode: { ENABLE: 1 }, GlobalWorkerOptions: {}, getDocument: () => ({ promise: Promise.resolve({ numPages: pages, getPage: async () => page }), destroy: async () => { destroyed++ } }) }
  return { pdf, workers, destroyed: () => destroyed, rendered: () => rendered, restore: () => Object.assign(global, original) }
}
test('scanned OCR initializes only local engines, reuses one worker across pages and terminates', async () => {
  const env = fakeOcrEnvironment({ pages: 2 })
  try {
    const result = await load(env.pdf).readSupplierPdf(new File(['%PDF-1.7'], 'scan.pdf'))
    assert.equal(result.ocr, true); assert.equal(result.pages, 2); assert.equal(result.warnings.length, 1)
    assert.equal(env.workers.length, 1); assert.equal(env.workers[0].terminated, true); assert.equal(env.rendered(), 2)
    const jobs = env.workers[0].jobs
    assert.deepEqual(jobs.map(job => job.action), ['load', 'loadLanguage', 'initialize', 'setParameters', 'recognize', 'recognize'])
    assert.equal(new URL(env.workers[0].url).origin, 'https://accounting.example')
    assert.equal(new URL(jobs[0].payload.options.corePath).origin, 'https://accounting.example')
    assert.equal(new URL(jobs[1].payload.options.langPath).origin, 'https://accounting.example')
    assert.equal(jobs[1].payload.options.cacheMethod, 'none')
    assert.equal(env.destroyed(), 1)
  } finally { env.restore() }
})
test('aborting OCR initialization terminates the native worker before it becomes ready', async () => {
  const env = fakeOcrEnvironment({ hangAction: 'loadLanguage' })
  try {
    const controller = new AbortController()
    const work = load(env.pdf).readSupplierPdf(new File(['%PDF-1.7'], 'scan.pdf'), { signal: controller.signal })
    await new Promise(resolve => setTimeout(resolve, 5)); controller.abort()
    await assert.rejects(work, { name: 'AbortError' })
    assert.equal(env.workers[0].terminated, true); assert.ok(env.destroyed() >= 1)
  } finally { env.restore() }
})
test('a stalled OCR stage times out and releases the worker', async () => {
  const env = fakeOcrEnvironment({ hangAction: 'load' })
  try {
    await assert.rejects(load(env.pdf, true).readSupplierPdf(new File(['%PDF-1.7'], 'scan.pdf')), /in time|too long/)
    assert.equal(env.workers[0].terminated, true)
  } finally { env.restore() }
})
test('page limit is enforced before rendering or starting OCR', async () => {
  const env = fakeOcrEnvironment({ pages: 11 })
  try {
    await assert.rejects(load(env.pdf).readSupplierPdf(new File(['%PDF-1.7'], 'scan.pdf')), /up to 10/)
    assert.equal(env.workers.length, 0); assert.equal(env.rendered(), 0)
  } finally { env.restore() }
})
test('OCR initialization errors release resources and never return partial invoice text', async () => {
  const env = fakeOcrEnvironment({ rejectAction: 'loadLanguage' })
  try {
    await assert.rejects(load(env.pdf).readSupplierPdf(new File(['%PDF-1.7'], 'scan.pdf')), /could not read this page/)
    assert.equal(env.workers[0].terminated, true); assert.equal(env.destroyed(), 1)
  } finally { env.restore() }
})
test('excessive text and drawing operations are rejected by the bounded page readers', () => {
  assert.throws(() => helper.supplierPdfTextLines(Array(30001).fill(textItem('A')), { convertToViewportPoint: (x, y) => [x, y] }), /too much text/)
  assert.throws(() => helper.supplierPageNeedsOcr(nativeText, { fnArray: Array(150001).fill(1), argsArray: [] }, ops, 10000), /too complex/)
})
test('malformed and password-protected PDFs produce reviewable errors and release their workers', async () => {
  const previousWindow = global.window
  global.window = { location: { origin: 'https://accounting.example' } }
  try {
    for (const [name, expected] of [['InvalidPDFException', /intact, unlocked/], ['PasswordException', /password protected/]]) {
      let destroyed = false
      const failure = Error('Cannot open document'); failure.name = name
      const pdf = { version: '6.3.289', GlobalWorkerOptions: {}, getDocument: () => ({ promise: Promise.reject(failure), destroy: async () => { destroyed = true } }) }
      await assert.rejects(load(pdf).readSupplierPdf(new File(['%PDF-1.7'], 'invalid.pdf')), expected)
      assert.equal(destroyed, true)
    }
  } finally { global.window = previousWindow }
})
