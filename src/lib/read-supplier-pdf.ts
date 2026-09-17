import type { PDFDocumentLoadingTask, RenderTask, TextContent, TextItem } from 'pdfjs-dist/types/src/display/api'

export type SupplierPdfOptions = { signal?: AbortSignal; onProgress?: (message: string) => void; forceOcr?: boolean }
export type SupplierPdfReading = { text: string; pages: number; ocr: boolean; warnings: string[] }
export const SUPPLIER_PDF_LIMITS = Object.freeze({ bytes: 10 * 1024 * 1024, pages: 10, renderPixels: 6_000_000, imagePixels: 24_000_000, textCharacters: 200_000, itemsPerPage: 30_000, operationsPerPage: 150_000, totalMilliseconds: 240_000, stageMilliseconds: 45_000 })
const OCR_VERSION = '7.0.0'
const cancelled = () => new DOMException('PDF reading cancelled.', 'AbortError')
const assetUrl = (relative: string) => {
  const url = new URL(`${import.meta.env.BASE_URL}supplier-ocr/${relative}`, window.location.origin)
  if (url.origin !== window.location.origin) throw Error('The local PDF reader assets must be hosted by this application.')
  return url.href
}

/** Group positioned PDF text into rows and preserve larger column gaps as tabs. */
export function supplierPdfTextLines(items: TextContent['items'], viewport: { convertToViewportPoint: (x: number, y: number) => number[] }): string {
  if (items.length > SUPPLIER_PDF_LIMITS.itemsPerPage) throw Error('This PDF page has too much text to read safely. Split it into a smaller document.')
  const pieces = items.filter((item): item is TextItem => 'str' in item && Boolean(item.str.trim())).map(item => {
    const [x, y] = viewport.convertToViewportPoint(Number(item.transform[4]), Number(item.transform[5]))
    return { text: item.str.replace(/\p{Cc}/gu, character => ['\t', '\n', '\r'].includes(character) ? character : ''), x, y, width: Math.abs(item.width), height: Math.max(2, Math.abs(item.height) || Math.hypot(Number(item.transform[2]), Number(item.transform[3])) || 10) }
  }).filter(item => [item.x, item.y, item.width, item.height].every(Number.isFinite)).sort((a, b) => a.y - b.y || a.x - b.x)
  const lines: { y: number; height: number; items: typeof pieces }[] = []
  for (const piece of pieces) {
    const last = lines[lines.length - 1]
    if (last && Math.abs(piece.y - last.y) <= Math.max(2, Math.min(last.height, piece.height) * 0.4)) last.items.push(piece)
    else lines.push({ y: piece.y, height: piece.height, items: [piece] })
  }
  return lines.map(line => {
    const row = line.items.sort((a, b) => a.x - b.x)
    return row.reduce((text, piece, index) => {
      const previous = row[index - 1], gap = previous ? piece.x - previous.x - previous.width : 0
      const separator = !previous ? '' : gap > Math.max(piece.height, previous.height) * 1.5 ? '\t' : gap > 1 ? ' ' : ''
      return text + separator + piece.text
    }, '').trim()
  }).filter(Boolean).join('\n')
}

type Matrix = [number, number, number, number, number, number]
const identity = (): Matrix => [1, 0, 0, 1, 0, 0]
function multiply(a: Matrix, b: number[]): Matrix {
  return [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]]
}
/** Find substantial raster content even when the same page also contains native text. */
export function supplierPageNeedsOcr(text: string, operators: { fnArray: number[]; argsArray: unknown[][] }, ops: Record<string, number>, pageArea: number): boolean {
  if (operators.fnArray.length > SUPPLIER_PDF_LIMITS.operationsPerPage) throw Error('This PDF page is too complex to read safely. Split or simplify the document.')
  if (text.replace(/[^\p{L}\p{N}]/gu, '').length < 80) return true
  let current = identity(), largest = 0, total = 0
  const stack: Matrix[] = []
  const imageOps = new Set([ops.paintImageXObject, ops.paintInlineImageXObject, ops.paintImageXObjectRepeat, ops.paintInlineImageXObjectGroup])
  for (let index = 0; index < operators.fnArray.length; index++) {
    const fn = operators.fnArray[index], args = operators.argsArray[index]
    if (fn === ops.save) { if (stack.length > 500) throw Error('The PDF drawing structure exceeds the reading limit.'); stack.push([...current]) }
    else if (fn === ops.restore) current = stack.pop() || identity()
    else if (fn === ops.transform && Array.isArray(args) && args.length === 6 && args.every(Number.isFinite)) current = multiply(current, args as number[])
    else if (imageOps.has(fn)) { const area = Math.abs(current[0] * current[3] - current[1] * current[2]); largest = Math.max(largest, area); total += area }
  }
  // A scanned table can occupy only a small part of an otherwise searchable invoice.
  return largest / pageArea > 0.03 || total / pageArea > 0.05
}

/** Own the native Tesseract 7 worker from creation so abort can terminate initialization too. */
class LocalOcrWorker {
  private readonly worker: Worker
  private readonly jobs = new Map<string, { resolve: (value: unknown) => void; reject: (cause: Error) => void }>()
  private sequence = 0
  private stopped = false
  private readonly progress: (message: string) => void
  constructor(progress: (message: string) => void) {
    this.progress = progress
    this.worker = new Worker(assetUrl(`tesseract-${OCR_VERSION}/worker.min.js`))
    this.worker.onmessage = (event: MessageEvent) => {
      const { jobId, status, data } = event.data || {}, job = this.jobs.get(String(jobId))
      if (!job) return
      if (status === 'progress') {
        const percent = Math.max(0, Math.min(100, Math.round(Number(data?.progress || 0) * 100)))
        this.progress(data?.status === 'recognizing text' ? `Reading scanned text… ${percent}%` : 'Preparing local OCR…')
      } else if (status === 'resolve') { this.jobs.delete(jobId); job.resolve(data) }
      else if (status === 'reject') { this.jobs.delete(jobId); job.reject(Error('Local OCR could not read this page. Try a clearer PDF or enter its details manually.')) }
    }
    this.worker.onerror = event => { event.preventDefault(); this.terminate(Error('Local OCR could not start. Reload the app and try again.')) }
    this.worker.onmessageerror = () => this.terminate(Error('Local OCR returned an unreadable result.'))
  }
  run(action: string, payload: Record<string, unknown>): Promise<unknown> {
    if (this.stopped) return Promise.reject(cancelled())
    const jobId = `supplier-${++this.sequence}`
    return new Promise((resolve, reject) => {
      this.jobs.set(jobId, { resolve, reject })
      try { this.worker.postMessage({ workerId: 'supplier-local-ocr', jobId, action, payload }) }
      catch (cause) { this.jobs.delete(jobId); reject(cause) }
    })
  }
  async initialize() {
    const base = assetUrl(`tesseract-${OCR_VERSION}/`)
    await this.run('load', { options: { lstmOnly: true, corePath: `${base}core`, logging: false } })
    await this.run('loadLanguage', { langs: 'eng', options: { langPath: `${base}lang`, gzip: true, lstmOnly: true, cacheMethod: 'none' } })
    await this.run('initialize', { langs: 'eng', oem: 1, config: {} })
    await this.run('setParameters', { params: { preserve_interword_spaces: '1', user_defined_dpi: '144' } })
  }
  async recognize(image: Uint8Array): Promise<{ text: string; confidence: number }> {
    const result = await this.run('recognize', { image, options: { rotateAuto: true }, output: { text: true } }) as { text?: unknown; confidence?: unknown }
    return { text: typeof result?.text === 'string' ? result.text : '', confidence: Number(result?.confidence || 0) }
  }
  terminate(reason: Error = cancelled()) {
    if (this.stopped) return
    this.stopped = true; this.worker.terminate()
    this.jobs.forEach(job => job.reject(reason)); this.jobs.clear()
  }
}

export async function readSupplierPdf(file: File, options: SupplierPdfOptions = {}): Promise<SupplierPdfReading> {
  if (options.signal?.aborted) throw cancelled()
  if (!file || typeof file.arrayBuffer !== 'function' || file.size < 5 || file.size > SUPPLIER_PDF_LIMITS.bytes) throw Error('Choose a PDF no larger than 10 MB.')
  let stopped: Error | null = null, finished = false
  let loadingTask: PDFDocumentLoadingTask | undefined, rendering: RenderTask | undefined, ocrWorker: LocalOcrWorker | undefined, canvas: HTMLCanvasElement | undefined
  let rejectStop!: (cause: Error) => void
  const stopPromise = new Promise<never>((_, reject) => { rejectStop = reject })
  // The race owns cancellation; this guard also prevents an unhandled rejection before the first stage.
  void stopPromise.catch(() => {})
  function stop(reason: Error) {
    if (stopped || finished) return
    stopped = reason; rendering?.cancel(); ocrWorker?.terminate(reason)
    if (loadingTask) void loadingTask.destroy().catch(() => {})
    if (canvas) { canvas.width = 0; canvas.height = 0 }
    rejectStop(reason)
  }
  const onAbort = () => stop(cancelled())
  options.signal?.addEventListener('abort', onAbort, { once: true })
  const timeout = setTimeout(() => stop(Error('PDF reading took too long. Split the document or try a clearer scan.')), SUPPLIER_PDF_LIMITS.totalMilliseconds)
  const progress = (message: string) => { if (!stopped && !finished) { try { options.onProgress?.(message) } catch { /* A UI callback must not interrupt cleanup. */ } } }
  async function stage<T>(work: Promise<T>, message: string, milliseconds: number = SUPPLIER_PDF_LIMITS.stageMilliseconds): Promise<T> {
    if (stopped) throw stopped
    const timer = setTimeout(() => stop(Error(message)), milliseconds)
    try { return await Promise.race([work, stopPromise]) } finally { clearTimeout(timer) }
  }
  const warnings: string[] = [], pagesText: string[] = []
  let usedOcr = false
  try {
    progress('Checking supplier PDF…')
    const header = new Uint8Array(await stage(file.slice(0, 5).arrayBuffer(), 'The PDF file could not be read.'))
    if (String.fromCharCode(...header) !== '%PDF-') throw Error('The selected file is not a valid PDF. Choose the original supplier PDF.')
    const bytes = new Uint8Array(await stage(file.arrayBuffer(), 'The PDF file could not be read.'))
    const pdfjs = await stage(import('pdfjs-dist'), 'The PDF reader could not load. Reload the app and try again.')
    if (stopped) throw stopped
    const pdfBase = assetUrl(`pdfjs-${pdfjs.version}/`)
    pdfjs.GlobalWorkerOptions.workerSrc = `${pdfBase}pdf.worker.min.mjs`
    loadingTask = pdfjs.getDocument({ data: bytes, cMapUrl: `${pdfBase}cmaps/`, cMapPacked: true, standardFontDataUrl: `${pdfBase}standard_fonts/`, wasmUrl: `${pdfBase}wasm/`, useWorkerFetch: true, useSystemFonts: false, stopAtErrors: true, maxImageSize: SUPPLIER_PDF_LIMITS.imagePixels, canvasMaxAreaInBytes: SUPPLIER_PDF_LIMITS.renderPixels * 4, enableXfa: false })
    const pdf = await stage(loadingTask.promise, 'This PDF could not be opened in time. Try a smaller document.')
    if (pdf.numPages < 1 || pdf.numPages > SUPPLIER_PDF_LIMITS.pages) throw Error('Read up to 10 PDF pages at a time. Split this document into smaller PDFs.')
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      progress(`Reading page ${pageNumber} of ${pdf.numPages}…`)
      const page = await stage(pdf.getPage(pageNumber), `Page ${pageNumber} could not be opened in time.`)
      try {
        const viewport = page.getViewport({ scale: 1 }), pageArea = viewport.width * viewport.height
        if (!Number.isFinite(pageArea) || pageArea <= 0 || viewport.width > 20000 || viewport.height > 20000) throw Error('This PDF has unsupported page dimensions. Save it using a standard paper size.')
        let nativeText = '', textUnavailable = false
        try { nativeText = supplierPdfTextLines((await stage(page.getTextContent(), `Text on page ${pageNumber} took too long to read.`)).items, viewport) }
        catch (cause) { if (stopped) throw cause; textUnavailable = true }
        const operators = await stage(page.getOperatorList(), `Page ${pageNumber} is too complex to read in time.`)
        const automaticOcr = supplierPageNeedsOcr(nativeText, operators, pdfjs.OPS, pageArea)
        const requiresOcr = options.forceOcr || textUnavailable || automaticOcr
        if (requiresOcr) {
          usedOcr = true; progress(`Reading scanned content on page ${pageNumber} of ${pdf.numPages}…`)
          if (!ocrWorker) { ocrWorker = new LocalOcrWorker(progress); await stage(ocrWorker.initialize(), 'Local OCR could not initialize in time. Reload the app and try again.') }
          canvas = document.createElement('canvas')
          const scale = Math.min(2, Math.sqrt(SUPPLIER_PDF_LIMITS.renderPixels / pageArea), 3200 / Math.max(viewport.width, viewport.height))
          const renderViewport = page.getViewport({ scale })
          canvas.width = Math.max(1, Math.floor(renderViewport.width)); canvas.height = Math.max(1, Math.floor(renderViewport.height))
          rendering = page.render({ canvas, viewport: renderViewport, background: 'rgb(255,255,255)', annotationMode: pdfjs.AnnotationMode.ENABLE })
          await stage(rendering.promise, `Page ${pageNumber} could not be rendered in time.`); rendering = undefined
          const blob = await stage(new Promise<Blob>((resolve, reject) => canvas!.toBlob(value => value ? resolve(value) : reject(Error('This page could not be prepared for OCR.')), 'image/png')), 'The scanned page could not be prepared in time.')
          const image = new Uint8Array(await stage(blob.arrayBuffer(), 'The scanned page could not be read in time.'))
          const result = await stage(ocrWorker.recognize(image), `OCR on page ${pageNumber} took too long. Use a clearer scan or fewer pages.`, 60000)
          if (!result.text.trim()) throw Error(`No readable text was found on page ${pageNumber}. Use a clearer scan or enter the supplier details manually.`)
          if (result.confidence < 75) warnings.push(`Page ${pageNumber}: OCR confidence is low. Compare all amounts and reference numbers with the original.`)
          pagesText.push(result.text.trim())
          canvas.width = 0; canvas.height = 0; canvas = undefined
        } else pagesText.push(nativeText)
        if (pagesText.reduce((length, text) => length + text.length, 0) > SUPPLIER_PDF_LIMITS.textCharacters) throw Error('This PDF contains too much text. Split it into smaller supplier documents.')
      } finally { page.cleanup() }
    }
    if (usedOcr) warnings.unshift('Scanned content was read using local English OCR. Check the supplier, dates, line items, taxes and totals against the original PDF.')
    finished = true
    return { text: pagesText.map((text, index) => `--- Page ${index + 1} ---\n${text}`).join('\n\n'), pages: pdf.numPages, ocr: usedOcr, warnings }
  } catch (cause) {
    if (stopped) throw stopped
    if (cause instanceof Error && /password/i.test(cause.name + ' ' + cause.message)) throw Error('This PDF is password protected. Save an unlocked copy before reading it.')
    if (cause instanceof Error && /InvalidPDF|MissingPDF|UnexpectedResponse/i.test(cause.name)) throw Error('This PDF could not be opened. Choose an intact, unlocked supplier PDF.')
    throw cause
  } finally {
    finished = true; clearTimeout(timeout); options.signal?.removeEventListener('abort', onAbort)
    rendering?.cancel(); ocrWorker?.terminate()
    if (canvas) { canvas.width = 0; canvas.height = 0 }
    if (loadingTask) void loadingTask.destroy().catch(() => {})
  }
}
