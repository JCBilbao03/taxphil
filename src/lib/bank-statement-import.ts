import { BANK_LIMITS, validBankDate, validBankMoney, type BankIssue, type BankSourceRef, type BankStatementRow } from './bank-reconciliation.ts'
import { normalizeSupplierBillDate } from './supplier-bill-extraction.ts'

export type BankStatementCell = { text: string; number?: number; formula?: boolean }
export type BankRawStatementRow = { cells: BankStatementCell[]; source: BankSourceRef }
export type BankStatementTable = {
  format: BankSourceRef['format']; fileName: string; headers: string[]; rows: BankRawStatementRow[]
  headerSource: BankSourceRef; metadata: Record<string, string>; warnings: string[]; date1904?: boolean
}
export type BankColumnMapping = {
  date: number; description?: number; reference?: number; amount?: number; debit?: number; credit?: number; balance?: number; direction?: number
  amountMode: 'signed' | 'debit_credit' | 'direction'; dateOrder?: 'auto' | 'DMY' | 'MDY' | 'YMD'
}
export const BANK_IMPORT_LIMITS = Object.freeze({ bytes: 10 * 1024 * 1024, characters: 2_000_000, rows: BANK_LIMITS.rows, columns: 64, cellCharacters: 4000, sheets: 10, cells: 200_000, headerRows: 100, milliseconds: 60_000 })
const fields = ['date', 'description', 'reference', 'amount', 'debit', 'credit', 'balance', 'direction'] as const
type Field = typeof fields[number]
const aliases: Record<Field, string[]> = {
  date: ['date', 'transaction date', 'txn date', 'trans date', 'posting date', 'post date', 'value date'],
  description: ['description', 'transaction description', 'details', 'particulars', 'narration', 'transaction details', 'remarks'],
  reference: ['reference', 'reference no', 'reference number', 'ref', 'ref no', 'check no', 'check number', 'cheque no', 'transaction reference'],
  amount: ['amount', 'transaction amount', 'net amount', 'signed amount'],
  debit: ['debit', 'debits', 'debit amount', 'withdrawal', 'withdrawals', 'money out', 'withdrawals debits', 'debits withdrawals'],
  credit: ['credit', 'credits', 'credit amount', 'deposit', 'deposits', 'money in', 'deposits credits', 'credits deposits'],
  balance: ['balance', 'running balance', 'closing balance', 'available balance', 'ledger balance'],
  direction: ['type', 'transaction type', 'debit credit', 'dr cr', 'cr dr', 'direction'],
}
const cleanHeader = (value: string) => value.toLowerCase().replace(/[()/#._-]/g, ' ').replace(/\b(?:php|peso|pesos|₱)\b/g, '').replace(/\s+/g, ' ').trim()
const cell = (text: string): BankStatementCell => ({ text, ...(/^\s*=/.test(text) ? { formula: true } : {}) })
const fail = (message: string): never => { throw Error(message) }
function checkText(text: string) {
  if (typeof text !== 'string' || !text.trim()) fail('The statement has no readable text.')
  if (text.length > BANK_IMPORT_LIMITS.characters || text.includes('\u0000')) fail('This statement is too large or uses an unsupported text encoding. Export a smaller UTF-8 file.')
}

/** Signed PHP amounts only. Do not repair OCR digits or guess decimal separators. */
export function normalizeBankAmount(raw: string): { value?: number; issue?: string } {
  let text = raw.trim().replace(/^(?:PHP|₱|P)(?=\s*[-+(\d])/i, '').replace(/\s*(?:PHP|PESOS?)$/i, '').trim()
  if (!text) return { issue: 'Enter the amount from the original statement.' }
  let suffix = ''
  const suffixMatch = text.match(/\s*(CR|DR)\s*$/i)
  if (suffixMatch) { suffix = suffixMatch[1].toUpperCase(); text = text.slice(0, suffixMatch.index).trim() }
  const parentheses = /^\(.*\)$/.test(text)
  if (parentheses) text = text.slice(1, -1).trim()
  const explicit = /^[+-]/.test(text) ? text[0] : ''
  if (explicit) text = text.slice(1).trim()
  if (parentheses && explicit) return { issue: 'The amount contains conflicting sign markers.' }
  if (suffix === 'CR' && (explicit === '-' || parentheses)) return { issue: 'Credit and negative amount markers conflict.' }
  if (suffix === 'DR' && explicit === '+') return { issue: 'Debit and positive amount markers conflict.' }
  if (/^\d{1,3}(?: \d{3})+(?:\.\d{1,2})?$/.test(text)) text = text.replace(/ /g, '')
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(text)) return { issue: 'Check the amount separators, currency and OCR digits.' }
  const [whole, fraction = ''] = text.replace(/,/g, '').split('.')
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  if (!validBankMoney(amount)) return { issue: 'The amount exceeds the supported centavo range.' }
  return { value: amount === 0 ? 0 : (suffix === 'DR' || explicit === '-' || parentheses ? -amount : amount) }
}

export function normalizeBankDate(raw: string, order: BankColumnMapping['dateOrder'] = 'auto'): { value?: string; issue?: string } {
  const text = raw.trim()
  if (order !== 'auto') {
    const match = text.match(/^(\d{1,4})[-/.](\d{1,2})[-/.](\d{1,4})$/)
    if (match && match[1].length !== 4) {
      if (order === 'YMD') return { issue: 'Use a four-digit year in year/month/day order.' }
      const [day, month] = order === 'DMY' ? [match[1], match[2]] : [match[2], match[1]]
      const date = `${match[3]}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
      return validBankDate(date) ? { value: date } : { issue: 'The date is not a valid calendar date with the selected order.' }
    }
  }
  return normalizeSupplierBillDate(text)
}

export function excelBankDate(serial: number, date1904 = false): { value?: string; issue?: string } {
  if (!Number.isFinite(serial) || serial < 0 || serial > 110000 || (!date1904 && Math.floor(serial) === 60)) return { issue: 'Review the Excel date serial.' }
  const day = Math.floor(serial)
  const epoch = date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 31)
  const corrected = date1904 ? day : day > 60 ? day - 1 : day
  const date = new Date(epoch + corrected * 86400000).toISOString().slice(0, 10)
  return validBankDate(date) ? { value: date } : { issue: 'The Excel date is outside the supported range.' }
}

function headerScore(values: string[]) {
  const names = values.map(cleanHeader)
  const hasDate = names.some(name => aliases.date.includes(name))
  const hasMoney = names.some(name => [...aliases.amount, ...aliases.debit, ...aliases.credit].includes(name))
  return Number(hasDate) * 4 + Number(hasMoney) * 4 + Number(names.some(name => aliases.description.includes(name)))
}
function metadataFromText(text: string): Record<string, string> {
  const metadata: Record<string, string> = {}
  const currency = text.match(/\b(?:currency|account currency)\s*[:=]?\s*(PHP|USD|EUR|GBP|JPY|CNY|SGD|AUD|HKD)\b/i)
    || text.match(/\b(PHP|USD|EUR|GBP|JPY|CNY|SGD|AUD|HKD)\s+(?:savings|current|checking|account)\b/i)
  if (currency) metadata.currency = currency[1].toUpperCase()
  else if (/\b(?:Philippine pesos|Philippine peso|PHP)\b|₱/i.test(text)) metadata.currency = 'PHP'
  for (const [field, pattern] of Object.entries({ openingBalance: /(?:opening|beginning|previous)\s+balance\s*[:=]?\s+([^\n\r]+)/i, closingBalance: /(?:closing|ending)\s+balance\s*[:=]?\s+([^\n\r]+)/i, account: /(?:account\s*(?:number|no\.?|#))\s*[:=]?\s+([^\n\r]+)/i, period: /(?:statement\s+period|period\s+covered)\s*[:=]?\s+([^\n\r]+)/i })) {
    const found = text.match(pattern)
    if (found) metadata[field] = found[1].trim().slice(0, 200)
  }
  return metadata
}
function makeTable(records: BankRawStatementRow[], fileName: string, format: BankSourceRef['format'], headerRow?: number, metadataText = ''): BankStatementTable {
  if (!records.length) fail('No statement rows could be read.')
  const index = headerRow === undefined ? records.slice(0, BANK_IMPORT_LIMITS.headerRows).findIndex(row => headerScore(row.cells.map(cell => cell.text)) >= 8) : records.findIndex(row => row.source.row === headerRow)
  const headerIndex = index >= 0 ? index : 0
  if (headerRow !== undefined && index < 0) fail('Choose a header row that exists in this statement.')
  const header = records[headerIndex]
  const headers = header.cells.map((entry, index) => entry.text.trim() || `Column ${index + 1}`)
  if (headers.length > BANK_IMPORT_LIMITS.columns) fail('This statement has too many columns. Export only the transaction table.')
  const rows = records.slice(headerIndex + 1).filter(row => row.cells.some(entry => entry.text.trim()))
  if (!rows.length || rows.length > BANK_IMPORT_LIMITS.rows) fail(`Read 1–${BANK_IMPORT_LIMITS.rows} transactions at a time.`)
  return { format, fileName, headers, rows, headerSource: header.source, metadata: metadataFromText(metadataText || records.slice(0, headerIndex).map(row => row.cells.map(cell => cell.text).join(' ')).join('\n')), warnings: index < 0 ? ['No recognized transaction header was found. Select and review each source column before importing.'] : [] }
}

/** Bounded RFC4180 parser, including quoted newlines. No numeric coercion or formula evaluation. */
export function parseBankCsv(text: string, fileName: string, options: { delimiter?: string; headerRow?: number } = {}): BankStatementTable {
  checkText(text)
  text = text.replace(/^\uFEFF/, '')
  const delimiter = options.delimiter || detectDelimiter(text)
  if (![';', ',', '\t', '|'].includes(delimiter)) fail('Choose comma, semicolon, tab or pipe as the CSV delimiter.')
  const records: BankRawStatementRow[] = []
  let values: string[] = [], value = '', quoted = false, afterQuote = false, line = 1, startLine = 1
  const pushValue = () => { if (value.length > BANK_IMPORT_LIMITS.cellCharacters) fail('A statement field exceeds the reading limit.'); values.push(value); value = ''; if (values.length > BANK_IMPORT_LIMITS.columns) fail('This statement has too many columns.') }
  const pushRow = () => {
    pushValue()
    if (values.some(value => value.trim())) records.push({ cells: values.map(cell), source: { format: 'csv', fileName, row: startLine, text: values.join('\t').slice(0, 4000) } })
    values = []; startLine = line + 1
    if (records.length > BANK_IMPORT_LIMITS.rows + BANK_IMPORT_LIMITS.headerRows) fail('Split this statement into smaller imports.')
  }
  for (let index = 0; index < text.length; index++) {
    const character = text[index]
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') { value += '"'; index++ }
      else if (character === '"') { quoted = false; afterQuote = true }
      else { value += character; if (character === '\n') line++ }
    } else if (character === delimiter) { pushValue(); afterQuote = false }
    else if (character === '\n' || character === '\r') {
      if (character === '\r' && text[index + 1] === '\n') index++
      pushRow(); afterQuote = false; line++
    } else if (character === '"' && !value && !afterQuote) quoted = true
    else if (character === '"' || (afterQuote && character.trim())) fail(`CSV quotation is invalid near line ${line}. Export the original CSV again.`)
    else if (!afterQuote) value += character
    if (value.length > BANK_IMPORT_LIMITS.cellCharacters) fail('A statement field exceeds the reading limit.')
  }
  if (quoted) fail('A CSV quoted field was not closed. Export the original CSV again.')
  if (value || values.length || afterQuote) pushRow()
  return makeTable(records, fileName, 'csv', options.headerRow)
}
function detectDelimiter(text: string) {
  const scores = [',', ';', '\t', '|'].map(delimiter => {
    let quoted = false, count = 0, best = 0, rows = 0
    for (let index = 0; index < Math.min(text.length, 30000); index++) {
      const character = text[index]
      if (character === '"') { if (quoted && text[index + 1] === '"') index++; else quoted = !quoted }
      else if (!quoted && character === delimiter) count++
      else if (!quoted && character === '\n') { best = Math.max(best, count); count = 0; if (++rows >= 100) break }
    }
    return { delimiter, score: Math.max(best, count) }
  }).sort((a, b) => b.score - a.score)
  if (!scores[0].score) fail('No CSV columns were found. Choose an original delimited bank statement.')
  return scores[0].delimiter
}

export function suggestBankColumnMapping(table: BankStatementTable) {
  const candidates = Object.fromEntries(fields.map(field => [field, table.headers.map((header, index) => aliases[field].includes(cleanHeader(header)) ? index : -1).filter(index => index >= 0)])) as Record<Field, number[]>
  const mapping: Partial<BankColumnMapping> = { dateOrder: 'auto' }
  const issues: BankIssue[] = []
  for (const field of fields) {
    if (candidates[field].length === 1) mapping[field] = candidates[field][0]
    else if (candidates[field].length > 1) issues.push({ code: 'ambiguous_column', field, message: `Select the ${field} column; more than one header matches.` })
  }
  if (mapping.debit !== undefined || mapping.credit !== undefined) mapping.amountMode = 'debit_credit'
  else if (mapping.amount !== undefined) mapping.amountMode = mapping.direction !== undefined ? 'direction' : 'signed'
  return { mapping, candidates, issues }
}

/** Map explicit columns into reviewed draft rows. IDs must be namespaced per persisted import. */
export function importBankStatementRows(table: BankStatementTable, mapping: BankColumnMapping, options: { idPrefix?: string } = {}): BankStatementRow[] {
  if (!table.rows.length || table.rows.length > BANK_IMPORT_LIMITS.rows) fail('Choose a statement table within the supported row limit.')
  const prefix = options.idPrefix || 'statement'
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(prefix)) fail('Use a valid stable import ID prefix.')
  if (!['signed', 'debit_credit', 'direction'].includes(mapping.amountMode) || (mapping.dateOrder !== undefined && !['auto', 'DMY', 'MDY', 'YMD'].includes(mapping.dateOrder))) fail('Choose the statement amount convention and date order.')
  const selected = fields.filter(field => mapping[field] !== undefined)
  if (selected.some(field => !Number.isSafeInteger(mapping[field]) || mapping[field]! < 0 || mapping[field]! >= table.headers.length)) fail('Every mapped column must exist in the statement.')
  if (new Set(selected.map(field => mapping[field])).size !== selected.length) fail('Map each statement column only once.')
  if (mapping.date === undefined || (mapping.amountMode === 'debit_credit' ? mapping.debit === undefined && mapping.credit === undefined : mapping.amount === undefined) || (mapping.amountMode === 'direction' && mapping.direction === undefined)) fail('Map the transaction date and amount columns before importing.')
  return table.rows.map(row => {
    const issues: BankIssue[] = []
    const raw: Record<string, string> = {}
    const get = (field: Field) => mapping[field] === undefined ? undefined : row.cells[mapping[field]!]
    const warn = (code: string, field: string, message: string) => issues.push({ code, field, message })
    for (const field of selected) {
      const original = get(field)
      raw[field] = original?.number !== undefined && ['amount', 'debit', 'credit', 'balance'].includes(field) ? String(original.number) : original?.text || ''
      if (original?.formula) warn('formula_cell', field, `The ${field} cell contains a formula. Confirm a value from the original bank statement.`)
    }
    const dateCell = get('date')
    const parsedDate = table.format === 'xlsx' && dateCell?.number !== undefined ? excelBankDate(dateCell.number, table.date1904) : normalizeBankDate(raw.date || '', mapping.dateOrder)
    if (!parsedDate.value) warn('invalid_date', 'date', parsedDate.issue || 'Review the transaction date.')
    let amount: number | null = null
    if (mapping.amountMode === 'debit_credit') {
      const parse = (field: 'debit' | 'credit') => raw[field]?.trim() ? normalizeBankAmount(raw[field]) : { value: 0 }
      const debit = parse('debit'), credit = parse('credit')
      if (debit.value === undefined || credit.value === undefined || debit.value < 0 || credit.value < 0) warn('invalid_amount', 'amount', 'Debit and credit columns must contain non-negative amounts. Review the original columns.')
      else if (debit.value > 0 && credit.value > 0) warn('both_debit_credit', 'amount', 'A transaction has both a debit and credit. Split or correct the row after reviewing the statement.')
      else amount = credit.value - debit.value
    } else {
      const parsed = normalizeBankAmount(raw.amount || '')
      if (parsed.value === undefined) warn('invalid_amount', 'amount', parsed.issue || 'Review the transaction amount.')
      else if (mapping.amountMode === 'direction') {
        const direction = (raw.direction || '').trim().toLowerCase()
        const sign = ['cr', 'c', 'credit', 'deposit', 'money in', 'in', '+'].includes(direction) ? 1 : ['dr', 'd', 'debit', 'withdrawal', 'money out', 'out', '-'].includes(direction) ? -1 : 0
        if (!sign || parsed.value < 0) warn('invalid_direction', 'direction', 'Choose a known debit/credit direction and a non-negative amount.')
        else amount = parsed.value * sign
      } else amount = parsed.value
    }
    if (amount === 0) { amount = null; warn('zero_amount', 'amount', 'A transaction amount must be nonzero. Exclude balance-only or header rows after review.') }
    const balanceValue = raw.balance?.trim() ? normalizeBankAmount(raw.balance) : {}
    if (raw.balance?.trim() && balanceValue.value === undefined) warn('invalid_balance', 'balance', balanceValue.issue || 'Review the running balance.')
    if (table.metadata.currency && table.metadata.currency !== 'PHP') warn('unsupported_currency', 'amount', 'This statement is not in PHP. Foreign-currency conversion requires a separate reviewed workflow.')
    if (row.cells.length !== table.headers.length) warn('column_count', 'source', 'The source row has a different number of columns. Confirm its alignment before accepting it.')
    const description = (raw.description || '').trim(), reference = (raw.reference || '').trim()
    if (description.length > 1000) warn('long_description', 'description', 'Shorten the reviewed description to 1,000 characters; the original is retained.')
    if (reference.length > 200) warn('long_reference', 'reference', 'Shorten the reviewed reference to 200 characters; the original is retained.')
    return { id: `${prefix}:${row.source.page || 0}:${row.source.row}`, date: parsedDate.value || null, description: description.slice(0, 1000), reference: reference.slice(0, 200), amount, balance: balanceValue.value ?? null, source: { ...row.source }, issues, raw }
  })
}

/** PDF reader page markers and visual column gaps are retained as source references. */
export function parseBankStatementText(text: string, fileName: string): BankStatementTable {
  checkText(text)
  const lines = text.split(/\r?\n/)
  let page = 1
  const records: BankRawStatementRow[] = []
  let header: string[] | null = null
  const warnings: string[] = []
  for (let index = 0; index < lines.length; index++) {
    const original = lines[index].trim()
    const marker = original.match(/^---\s*Page\s+(\d+)\s*---$/i)
    if (marker) { page = Number(marker[1]); continue }
    if (!original) continue
    const values = original.includes('\t') ? original.split('\t').map(value => value.trim()) : original.split(/\s{2,}/).map(value => value.trim())
    if (values.some(value => value.length > BANK_IMPORT_LIMITS.cellCharacters) || values.length > BANK_IMPORT_LIMITS.columns) fail('A statement row is too large to read safely.')
    const source: BankSourceRef = { format: 'pdf', fileName, row: index + 1, page, text: original.slice(0, 4000) }
    if (headerScore(values) >= 8) {
      if (!header) { header = values; records.push({ cells: values.map(cell), source }) }
      else if (values.map(cleanHeader).join('|') !== header.map(cleanHeader).join('|')) { records.push({ cells: values.map(cell), source }); warnings.push(`Page ${page} has a different table header. Review the affected rows.`) }
      continue
    }
    if (!header) continue
    if (/^(?:page\s+\d+(?:\s+of\s+\d+)?|(?:opening|beginning|closing|ending|previous)\s+balance|(?:total|summary)\b|end of statement)/i.test(original)) continue
    // A wrapped description is not merged blindly: retain it as unresolved source text.
    records.push({ cells: values.map(cell), source })
    if (records.length > BANK_IMPORT_LIMITS.rows + 1) fail('Split this statement into smaller imports.')
  }
  if (!header || records.length < 2) fail('No readable transaction table was found. Try text extraction or OCR again, or export CSV/Excel from your bank.')
  const table = makeTable(records, fileName, 'pdf', records[0].source.row, text.slice(0, 10000))
  table.warnings.push(...warnings)
  return table
}

/** Called in a bounded browser worker; also directly testable without DOM access. */
export async function readBankWorkbook(bytes: ArrayBuffer, fileName: string): Promise<BankStatementTable[]> {
  if (bytes.byteLength < 4 || bytes.byteLength > BANK_IMPORT_LIMITS.bytes) fail('Choose an Excel statement no larger than 10 MB.')
  const signature = new Uint8Array(bytes, 0, Math.min(4, bytes.byteLength))
  if (signature[0] !== 0x50 || signature[1] !== 0x4b || signature[2] !== 3 || signature[3] !== 4) fail('Choose an original XLSX workbook. Legacy XLS files must be saved as XLSX or CSV first.')
  const XLSX = await import('xlsx')
  const workbook = XLSX.read(bytes, { type: 'array', cellFormula: true, cellDates: false, cellText: true, cellNF: true, bookVBA: false, sheetRows: BANK_IMPORT_LIMITS.rows + BANK_IMPORT_LIMITS.headerRows + 1 })
  if (!workbook.SheetNames.length || workbook.SheetNames.length > BANK_IMPORT_LIMITS.sheets) fail('Use a workbook with 1–10 worksheets.')
  const tables: BankStatementTable[] = []
  let totalCells = 0, totalCharacters = 0
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    if (!sheet['!ref']) continue
    const range = XLSX.utils.decode_range(sheet['!fullref'] || sheet['!ref'])
    if (range.e.r - range.s.r + 1 > BANK_IMPORT_LIMITS.rows + BANK_IMPORT_LIMITS.headerRows || range.e.c + 1 > BANK_IMPORT_LIMITS.columns) fail('A worksheet exceeds the row/column limit. Export a smaller transaction table.')
    const records: BankRawStatementRow[] = []
    for (let row = range.s.r; row <= range.e.r; row++) {
      const cells: BankStatementCell[] = []
      for (let column = 0; column <= range.e.c; column++) {
        if (++totalCells > BANK_IMPORT_LIMITS.cells) fail('This workbook contains too many cells.')
        const source = sheet[XLSX.utils.encode_cell({ r: row, c: column })]
        const text = source ? String(source.w ?? source.v ?? '') : ''
        totalCharacters += text.length
        if (text.length > BANK_IMPORT_LIMITS.cellCharacters || totalCharacters > BANK_IMPORT_LIMITS.characters) fail('This workbook contains too much text.')
        cells.push({ text, ...(source?.t === 'n' && typeof source.v === 'number' ? { number: source.v } : {}), ...(source?.f ? { formula: true } : {}) })
      }
      if (cells.some(entry => entry.text.trim() || entry.formula)) records.push({ cells, source: { format: 'xlsx', fileName, row: row + 1, sheet: sheetName, text: cells.map(cell => cell.text).join('\t').slice(0, 4000) } })
    }
    if (records.length < 2) continue
    const table = makeTable(records, fileName, 'xlsx')
    table.date1904 = Boolean(workbook.Workbook?.WBProps?.date1904)
    tables.push(table)
  }
  if (!tables.length) fail('No transaction worksheet could be read from this workbook.')
  return tables
}
