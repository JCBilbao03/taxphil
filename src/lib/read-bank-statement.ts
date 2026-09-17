import { BANK_IMPORT_LIMITS, parseBankCsv, parseBankStatementText, type BankStatementTable } from './bank-statement-import'

export type BankStatementReadOptions = { signal?: AbortSignal; onProgress?: (message: string) => void; forceOcr?: boolean; delimiter?: string; headerRow?: number }
export type BankStatementReading = {
  tables: BankStatementTable[]; warnings: string[]; pages?: number; ocr: boolean; sha256: string
  file: { name: string; size: number; type: 'text/csv' | 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' | 'application/pdf'; sha256: string }
}
const aborted = () => new DOMException('Statement reading cancelled.', 'AbortError')

async function bounded<T>(work: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (signal?.aborted) throw aborted()
  let stop!: (reason: Error) => void
  const interrupted = new Promise<never>((_, reject) => { stop = reject })
  const cancel = () => stop(aborted())
  const timer = setTimeout(() => stop(Error('Statement reading took too long. Export a smaller file and try again.')), BANK_IMPORT_LIMITS.milliseconds)
  signal?.addEventListener('abort', cancel, { once: true })
  try { return await Promise.race([work, interrupted]) }
  finally { clearTimeout(timer); signal?.removeEventListener('abort', cancel) }
}

function readWorkbook(bytes: ArrayBuffer, fileName: string, signal?: AbortSignal): Promise<BankStatementTable[]> {
  if (signal?.aborted) return Promise.reject(aborted())
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./read-bank-workbook.worker.ts', import.meta.url), { type: 'module' })
    let settled = false
    const cleanup = () => { clearTimeout(timer); signal?.removeEventListener('abort', cancel); worker.terminate() }
    const fail = (error: Error) => { if (!settled) { settled = true; cleanup(); reject(error) } }
    const cancel = () => fail(aborted())
    const timer = setTimeout(() => fail(Error('Excel statement reading took too long. Export a smaller workbook or CSV.')), BANK_IMPORT_LIMITS.milliseconds)
    signal?.addEventListener('abort', cancel, { once: true })
    worker.onerror = event => { event.preventDefault(); fail(Error('The Excel reader could not start. Reload the page or use CSV.')) }
    worker.onmessageerror = () => fail(Error('The Excel reader returned an unreadable result.'))
    worker.onmessage = (event: MessageEvent<{ tables?: BankStatementTable[]; error?: string }>) => {
      if (settled) return
      if (event.data.error || !Array.isArray(event.data.tables)) { fail(Error(event.data.error || 'No statement tables were returned.')); return }
      settled = true; cleanup(); resolve(event.data.tables)
    }
    try { worker.postMessage({ bytes, fileName }, [bytes]) }
    catch { fail(Error('The workbook could not be sent to the local reader.')) }
  })
}

/** Local parsing only: reading a statement never posts or uploads accounting data. */
export async function readBankStatement(file: File, options: BankStatementReadOptions = {}): Promise<BankStatementReading> {
  if (options.signal?.aborted) throw aborted()
  if (!file || typeof file.arrayBuffer !== 'function' || !Number.isSafeInteger(file.size) || file.size < 1 || file.size > BANK_IMPORT_LIMITS.bytes) throw Error('Choose a bank statement larger than 0 bytes and no larger than 10 MB.')
  if (!file.name.trim() || file.name.length > 200 || /[/\\\u0000-\u001f\u007f]/.test(file.name)) throw Error('Use a statement filename of 200 characters or fewer without folder paths or control characters.')
  const extension = file.name.match(/\.([^.]+)$/)?.[1].toLowerCase()
  if (!['csv', 'xlsx', 'pdf'].includes(extension || '')) throw Error('Choose a CSV, XLSX or PDF bank statement. Save legacy XLS files as XLSX first.')
  const type = extension === 'csv' ? 'text/csv' : extension === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/pdf'
  const accepted = extension === 'csv' ? ['text/csv', 'text/plain', 'application/csv', 'application/vnd.ms-excel'] : [type]
  if (file.type && file.type !== 'application/octet-stream' && !accepted.includes(file.type)) throw Error('The statement filename and file type do not match. Choose the original bank export.')
  const progress = (message: string) => { if (!options.signal?.aborted) options.onProgress?.(message) }
  progress('Checking bank statement…')
  const bytes = await bounded(file.arrayBuffer(), options.signal)
  const digest = await bounded(crypto.subtle.digest('SHA-256', bytes), options.signal)
  const sha256 = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
  const metadata = { name: file.name, size: file.size, type, sha256 } as BankStatementReading['file']
  if (extension === 'pdf') {
    progress('Reading statement pages…')
    try {
      const { readSupplierPdf } = await import('./read-supplier-pdf')
      if (options.signal?.aborted) throw aborted()
      const result = await readSupplierPdf(file, { signal: options.signal, forceOcr: options.forceOcr, onProgress: message => progress(message.replace(/supplier/gi, 'statement')) })
      const table = parseBankStatementText(result.text, file.name)
      return { tables: [table], warnings: [...result.warnings.map(message => message.replace(/supplier/gi, 'statement')), ...table.warnings], pages: result.pages, ocr: result.ocr, sha256, file: metadata }
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') throw Error(error.message.replace(/supplier/gi, 'statement'))
      throw error
    }
  }
  if (extension === 'xlsx') {
    progress('Reading Excel worksheets…')
    const tables = await readWorkbook(bytes, file.name, options.signal)
    return { tables, warnings: tables.flatMap(table => table.warnings), ocr: false, sha256, file: metadata }
  }
  progress('Reading CSV transactions…')
  let text: string
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes) }
  catch { throw Error('This CSV uses an unsupported encoding. Export a UTF-8 CSV from the bank or spreadsheet application.') }
  const table = parseBankCsv(text, file.name, { delimiter: options.delimiter, headerRow: options.headerRow })
  return { tables: [table], warnings: table.warnings, ocr: false, sha256, file: metadata }
}
