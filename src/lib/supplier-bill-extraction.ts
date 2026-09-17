import { normalizePartyTin } from './parties.ts'

export interface SupplierBillFields {
  reference?: string
  date?: string
  due?: string
  total?: string
  vatAmount?: string
  netAmount?: string
  vendorTin?: string
  vendorName?: string
  vendorAddress?: string
  description?: string
}

/** Lines are one-based positions in the supplied reading-order text. */
export interface ExtractionEvidence {
  value: string
  lines: number[]
  text: string
}

export interface SupplierBillExtraction {
  fields: SupplierBillFields
  warnings: string[]
  evidence: Partial<Record<keyof SupplierBillFields, ExtractionEvidence>>
  /** Unresolved candidates retain the printed value, rather than a guessed normalization. */
  candidates: Partial<Record<keyof SupplierBillFields, ExtractionEvidence[]>>
}

type Field = keyof SupplierBillFields
type Line = { text: string; number: number; role: 'supplier' | 'buyer' | 'unknown'; footer: boolean }
type Candidate = ExtractionEvidence & { rank: number; unresolved?: boolean }
type ParsedValue = { value?: string; issue?: string }
const MAX_TEXT = 500_000
const MAX_LINES = 10_000
const MAX_LINE = 2_000
const MAX_CANDIDATES = 30
const supplierMarker = /\b(?:supplier|vendor|seller|issued\s+by)\b|^\s*from\s*:/i
const buyerMarker = /\b(?:bill(?:ed)?\s+to|sold\s+to|ship\s+to|buyer|customer|consignee|recipient)\b/i
const footerMarker = /(?:^|\s{2,})(?:(?:(?:name\s+of\s+(?:the\s+)?)?printer(?:['’]s)?|accredited\s+printer)\s*(?:name|TIN|address|accreditation|:)|printed\s+by\b|(?:printer['’]?s?\s+)?accreditation\s*(?:no|number|:)|authority\s+to\s+print\b|ATP\s*(?:no|number|:))/i
const tableMarker = /^\s*(?:item\s+)?(?:description|particulars)\b.*\b(?:quantity|qty|amount|price|rate)\b/i
const pageMarker = /^---\s*Page\s+\d+\s*---$/i
const documentMarker = /\b(?:sales|service|tax|commercial)?\s*(?:invoice|billing\s+statement)\b/i
const nextLabel = /\b(?:invoice\s+(?:date|no\.?|number)|due\s+date|date\s+(?:issued|of\s+invoice)|(?:supplier|vendor|seller|customer|buyer)\s*(?:name|address|tin)?\s*:|(?:bill|sold|ship)\s+to\s*:|TIN\s*[:#]|grand\s+total|sub[ -]?total|VAT\s+(?:amount|total)|reference\s*(?:no\.?|number|#))/i
const moneyFields: Field[] = ['total', 'vatAmount', 'netAmount']
const fieldNames: Record<Field, string> = { reference: 'invoice reference', date: 'invoice date', due: 'due date', total: 'total', vatAmount: 'VAT amount', netAmount: 'net amount', vendorTin: 'supplier TIN', vendorName: 'supplier name', vendorAddress: 'supplier address', description: 'description' }

function validDate(year: number, month: number, day: number): boolean {
  if (year < 1900 || year > 2199 || month < 1 || month > 12 || day < 1 || day > 31) return false
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

/** Locale-neutral: numeric dates with two different possible interpretations stay unresolved. */
export function normalizeSupplierBillDate(raw: string): ParsedValue {
  const text = raw.trim().replace(/(\d)(?:st|nd|rd|th)\b/gi, '$1').replace(/,/g, '').replace(/\s+/g, ' ')
  let year: number, month: number, day: number
  let match = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:\s+\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)?$/i)
  if (match) [, year, month, day] = match.map(Number)
  else {
    match = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/)
    if (match) {
      const first = Number(match[1]), second = Number(match[2])
      year = Number(match[3])
      if (first <= 12 && second <= 12 && first !== second) return { issue: 'Ambiguous numeric date; choose the day and month manually.' }
      if (first > 12 || first === second) { day = first; month = second }
      else { month = first; day = second }
    } else {
      const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']
      match = text.match(/^(\d{1,2})[ -]([a-z]+)\.?[ -](\d{4})$/i)
      if (match) { day = Number(match[1]); month = months.findIndex(item => item === match![2].toLowerCase() || item.slice(0, 3) === match![2].toLowerCase()) + 1; year = Number(match[3]) }
      else {
        match = text.match(/^([a-z]+)\.?[ -](\d{1,2})[ -](\d{4})$/i)
        if (!match) return { issue: 'Date format could not be read safely; enter the complete date manually.' }
        month = months.findIndex(item => item === match![1].toLowerCase() || item.slice(0, 3) === match![1].toLowerCase()) + 1; day = Number(match[2]); year = Number(match[3])
      }
    }
  }
  if (!validDate(year, month, day)) return { issue: 'Invalid calendar date; review the printed document.' }
  return { value: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` }
}

/** Accepts PHP-style grouped decimal amounts. Never repairs OCR substitutions or locale separators. */
export function normalizeSupplierBillAmount(raw: string): ParsedValue {
  let text = raw.trim().replace(/^(?:PHP|PH₱|₱|P)(?=\s*[-(\d])/i, '').replace(/\s*(?:PHP|PESOS?)$/i, '').trim()
  if (/^[-(]/.test(text) || /[-)]$/.test(text)) return { issue: 'Negative or credit amount; review this document as a credit adjustment.' }
  if (/^\d{1,3}(?: \d{3})+(?:\.\d{1,2})?$/.test(text)) text = text.replace(/ /g, '')
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(text)) return { issue: 'Amount separators or OCR text are ambiguous; enter the amount manually.' }
  const clean = text.replace(/,/g, '')
  const [whole, decimal = ''] = clean.split('.')
  const cents = Number(whole) * 100 + Number(decimal.padEnd(2, '0'))
  if (!Number.isSafeInteger(cents) || cents > 999_999_999_999) return { issue: 'Amount is outside the supported range.' }
  return { value: `${Number(whole)}.${decimal.padEnd(2, '0')}` }
}

function valueAfter(lines: Line[], index: number, end: number): { text: string; lines: number[] } {
  let text = lines[index].text.slice(end).replace(/^\s*[:#|=]\s*/, '').trim()
  const used = [lines[index].number]
  if (!text || /^(?:PHP|₱|P)$/i.test(text)) {
    for (let next = index + 1; next < Math.min(lines.length, index + 4); next++) {
      if (!lines[next].text.trim()) continue
      if (lines[next].footer || pageMarker.test(lines[next].text) || buyerMarker.test(lines[next].text) || supplierMarker.test(lines[next].text)) break
      if (lines[next].text.search(nextLabel) === 0 || /^(?:address|currency|description|particulars|total|date|VAT|net\s+amount|registered\s+name)\s*[:=]/i.test(lines[next].text)) break
      text = `${text} ${lines[next].text.trim()}`.trim()
      used.push(lines[next].number)
      if (!/^(?:PHP|₱|P)$/i.test(text)) break
    }
  }
  // Reading-order text sometimes keeps adjacent invoice header fields on the same line.
  const following = text.search(nextLabel)
  if (following > 0) text = text.slice(0, following).trim().replace(/[|;]$/, '').trim()
  return { text, lines: used }
}

function sourceText(lines: Line[], numbers: number[]): string {
  return numbers.map(number => lines[number - 1]?.text ?? '').join('\n').slice(0, 3_000)
}

function cleanName(text: string): string | undefined {
  const name = text.replace(/\s+/g, ' ').trim().replace(/[|;]+$/, '').trim()
  if (name.length < 3 || name.length > 200 || !/[a-z]/i.test(name) || /^\d+$/.test(name)) return undefined
  if (/^(?:name|address|invoice|description|supplier|vendor|seller|TIN|VAT|official receipt)\s*[:#]?$/i.test(name)) return undefined
  return name
}

function plausibleAddress(text: string): boolean {
  return /\b(?:street|st\.|road|rd\.|avenue|ave\.|barangay|brgy\.?|city|province|building|bldg\.?|floor|unit|block|blk\.?|lot|purok|sitio|subdivision|village)\b/i.test(text) && !/\b(?:invoice|total|TIN|VAT|date|bank|account\s+no)\b/i.test(text)
}

function tinFrom(text: string): string | undefined {
  const match = text.match(/^\d{3}(?:[ -]?\d{3}){2}(?:(?:[ -]?\d{5})|(?:[ -]?\d{3}))?(?!\d)/)
  if (!match || /^[-\s]*\d/.test(text.slice(match[0].length))) return undefined
  try {
    normalizePartyTin(match[0])
    const digits = match[0].replace(/\D/g, '')
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 9)}${digits.length > 9 ? `-${digits.slice(9)}` : ''}`
  } catch { return undefined }
}

/**
 * Extracts suggestions from PDF/OCR reading-order text, without network access or state changes.
 * Currency, identity and conflicting values must be resolved by the user before bill creation.
 */
export function extractSupplierBill(text: string): SupplierBillExtraction {
  const result: SupplierBillExtraction = { fields: {}, warnings: [], evidence: {}, candidates: {} }
  const warn = (message: string) => { if (!result.warnings.includes(message)) result.warnings.push(message) }
  if (typeof text !== 'string' || !text.trim()) { warn('No readable document text was found. Enter the bill details manually or use a clearer PDF.'); return result }
  if (text.length > MAX_TEXT) { warn('Document text exceeds the extraction limit. Split the document or enter the bill details manually.'); return result }
  const rawLines = text.normalize('NFKC').replace(/\r\n?/g, '\n').replace(/\f/g, '\n').replace(/[\u0000-\u0008\u000b\u000e-\u001f\u007f]/g, '').split('\n')
  if (rawLines.length > MAX_LINES || rawLines.some(line => line.length > MAX_LINE)) { warn('Document layout exceeds the extraction limit. Use a single-invoice PDF or enter its details manually.'); return result }
  let role: Line['role'] = 'unknown', footer = false, seenBuyer = false
  const lines: Line[] = rawLines.map((raw, index) => {
    const text = raw.trim()
    if (pageMarker.test(text)) { role = 'unknown'; footer = false; seenBuyer = false; return { text, number: index + 1, role, footer } }
    if (footerMarker.test(text)) footer = true
    if (supplierMarker.test(text) && !buyerMarker.test(text)) role = 'supplier'
    else if (buyerMarker.test(text)) { role = 'buyer'; seenBuyer = true }
    else if (tableMarker.test(text)) role = 'unknown'
    // An unlabeled header before any buyer information is the only inferred supplier region.
    return { text, number: index + 1, role: role === 'unknown' && !seenBuyer && index < 30 ? 'supplier' : role, footer }
  })
  const candidates: Partial<Record<Field, Candidate[]>> = {}
  const overflow = new Set<Field>()
  const add = (field: Field, value: string, numbers: number[], rank = 2, unresolved = false) => {
    const list = candidates[field] ??= []
    if (list.some(item => item.value === value && item.lines.join(',') === numbers.join(','))) return
    if (list.length >= MAX_CANDIDATES) { overflow.add(field); warn(`Too many ${fieldNames[field]} candidates; use a single-invoice PDF and review this field manually.`); return }
    list.push({ value, lines: numbers, text: sourceText(lines, numbers), rank, unresolved })
  }
  const readLabel = (line: Line, regex: RegExp): RegExpMatchArray[] => [...line.text.matchAll(regex)]
  let payableOnly = false, hadBuyerTin = false, uncertainTin = false, mixedSales = false, adjustment = false
  const hasPhp = /(?<![\w/-])(?:PHP|P|₱)\s*[-(]?\s*\d|\d[\d., ]*\s*PHP\b|\b(?:currency|amounts?\s+in|prices?\s+in)\s*[:=-]?\s*PHP\b|^\s*PHP\s*$|\b(?:Philippine\s+)?Pesos?\b/im.test(text)
  const foreignCurrency = /\b(?:USD|EUR|GBP|JPY|AUD|CAD|SGD|HKD|CNY|RMB|MYR|THB|KRW|IDR|INR|DOLLARS?)\b|[$€£¥₩]/i.test(text)
  const creditNote = /^\s*(?:(?:document|transaction)\s*type\s*:\s*)?(?:tax\s+)?(?:credit\s+(?:note|memo(?:randum)?)|refund\s+(?:note|invoice))\b/im.test(text)
  if (creditNote) warn('This document appears to be a credit note or refund. Do not create a positive supplier bill from it without reviewing the adjustment workflow.')
  if (foreignCurrency) warn('A non-PHP or mixed currency was detected. Monetary fields were left blank; convert and review the PHP amounts separately.')

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]
    if (!line.text || line.footer || pageMarker.test(line.text)) continue
    if (/\b(?:withholding|amount\s+paid|payment\s+received|advance\s+payment|deposit\s+applied|less\s*:\s*(?:payment|credit))\b/i.test(line.text)) adjustment = true
    const otherSales = line.text.match(/^(?:VAT[- ]?exempt\s+sales|zero[- ]?rated\s+sales)\s*[:=]?\s*/i)
    if (otherSales) {
      const amount = normalizeSupplierBillAmount(valueAfter(lines, index, otherSales[0].length).text)
      if (!amount.value || Number(amount.value) > 0) mixedSales = true
    }
    const dates: [Field, RegExp][] = [
      ['due', /\b(?:due\s+date|payment\s+due(?:\s+date)?|date\s+due)\s*[:=-]?\s*/gi],
      ['date', /\b(?:invoice\s+date|billing\s+date|issue\s+date|date\s+(?:issued|of\s+invoice))\s*[:=-]?\s*/gi],
      ['date', /^date(?:\s*[:=-]\s*|\s+(?=\d)|\s*$)/gi],
    ]
    for (const [field, regex] of dates) for (const match of readLabel(line, regex)) {
      const printed = valueAfter(lines, index, match.index! + match[0].length)
      const parsed = normalizeSupplierBillDate(printed.text)
      if (parsed.value) add(field, parsed.value, printed.lines)
      else if (printed.text) { add(field, printed.text, printed.lines, 2, true); warn(`${field === 'due' ? 'Due date' : 'Invoice date'}: ${parsed.issue}`) }
    }
    for (const match of readLabel(line, /\b(?:(?:sales|service|tax|commercial)\s+invoice|invoice|bill|document|reference|S\.?I\.?)\s*(?:no\.?|number|num\.?|#)\s*[:#=-]?\s*/gi)) {
      const printed = valueAfter(lines, index, match.index! + match[0].length)
      const value = printed.text.trim()
      if (/^[a-z\d][a-z\d._/-]*(?:\s+[a-z\d._/-]+){0,3}$/i.test(value) && value.length <= 100 && !/^(?:date|no|number|invoice|due)$/i.test(value)) add('reference', value, printed.lines)
      else if (value) { add('reference', value.slice(0, 200), printed.lines, 2, true); warn('Invoice reference could not be separated safely from the surrounding text.') }
    }

    for (const match of readLabel(line, /\b(?:TIN|tax\s+identification(?:\s+(?:number|no\.?))?)\s*(?:no\.?|number|#)?\s*[:#=-]?\s*/gi)) {
      const before = line.text.slice(0, match.index)
      const supplierAt = Math.max(before.toLowerCase().lastIndexOf('supplier'), before.toLowerCase().lastIndexOf('vendor'), before.toLowerCase().lastIndexOf('seller'))
      const buyerAt = Math.max(...['buyer', 'customer', 'bill to', 'billed to', 'sold to', 'ship to'].map(word => before.toLowerCase().lastIndexOf(word)))
      const explicitSupplier = supplierAt > buyerAt && supplierAt >= 0
      const isBuyer = buyerAt > supplierAt || (!explicitSupplier && line.role === 'buyer')
      if (isBuyer) { hadBuyerTin = true; continue }
      const printed = valueAfter(lines, index, match.index! + match[0].length)
      const tin = tinFrom(printed.text)
      if (tin && (explicitSupplier || line.role === 'supplier')) add('vendorTin', tin, printed.lines, explicitSupplier ? 3 : 2)
      else if (tin) uncertainTin = true
      else if (printed.text) warn('A labeled TIN could not be read as a valid 9-digit TIN with an optional branch code. Review it manually.')
    }

    const name = line.text.match(/^\s*(?:(?:supplier|vendor|seller)\s*(?:registered\s+)?(?:name)?|issued\s+by|from)\s*[:=-]\s*/i)
      ?? (line.role === 'supplier' ? line.text.match(/^\s*(?:registered\s+name|business\s+name|company\s+name)\s*[:=-]\s*/i) : null)
    if (name && !buyerMarker.test(line.text.slice(0, name[0].length))) {
      const printed = valueAfter(lines, index, name[0].length)
      const clean = cleanName(printed.text)
      if (clean) add('vendorName', clean, printed.lines, 3)
    }
    const address = line.text.match(/^\s*(?:supplier|vendor|seller)\s+address\s*[:=-]\s*/i)
      ?? (line.role === 'supplier' ? line.text.match(/^\s*(?:registered\s+)?address\s*[:=-]\s*/i) : null)
    if (address) {
      const printed = valueAfter(lines, index, address[0].length)
      if (printed.text && /[a-z]/i.test(printed.text)) {
        for (let next = printed.lines[printed.lines.length - 1]; next < Math.min(lines.length, index + 4); next++) {
          if (lines[next].role !== 'supplier' || lines[next].footer || !plausibleAddress(lines[next].text)) break
          printed.text += `, ${lines[next].text}`; printed.lines.push(lines[next].number)
        }
        if (printed.text.length <= 500) add('vendorAddress', printed.text, printed.lines, 3)
      }
    }

    const monetary: [Field, RegExp, number][] = [
      ['total', /^(?:grand\s+total|invoice\s+total|total\s+invoice\s+amount|total\s+amount(?:\s*\(?(?:VAT\s+)?inclusive\)?)?|total\s+sales|total)(?!\s*(?:amount\s+)?(?:due|paid|before|excluding|excl|VAT|tax|net))\s*[:=]?\s*/i, 3],
      ['total', /^(?:(?:total\s+)?amount\s+due|balance\s+due|net\s+(?:amount\s+)?payable|amount\s+payable)\s*[:=]?\s*/i, 1],
      ['netAmount', /^(?:sub[ -]?total|total\s+(?:before|excluding|excl\.?)\s+VAT|net\s+(?:amount|sales|total)(?:\s*(?:of|before|excluding)\s+VAT)?|(?:amount|sales)\s*\(?net\s+of\s+VAT\)?|VATable\s+(?:sales|amount))\s*[:=]?\s*/i, 2],
      ['vatAmount', /^(?:(?:add\s*:?\s*)?(?:\d{1,2}(?:\.\d+)?\s*%\s*)?VAT\b(?:\s+(?:amount|total))?(?:\s*\(?\d{1,2}(?:\.\d+)?\s*%\)?)?|value\s+added\s+tax)(?!\s*(?:reg|inclusive|included|exclusive|exempt|TIN|sales))\s*[:=]?\s*/i, 2],
    ]
    for (const [field, regex, rank] of monetary) {
      const match = line.text.match(regex)
      if (!match) continue
      const printed = valueAfter(lines, index, match[0].length)
      const parsed = normalizeSupplierBillAmount(printed.text)
      if (field === 'total' && rank === 1) payableOnly = true
      if (parsed.value) add(field, parsed.value, printed.lines, rank)
      else if (printed.text) { add(field, printed.text, printed.lines, rank, true); warn(`${field === 'total' ? 'Invoice total' : field === 'vatAmount' ? 'VAT amount' : 'Net amount'}: ${parsed.issue}`) }
    }
    const description = line.text.match(/^(?:service\s+description|description|particulars)\s*[:=-]\s*/i)
    if (description && !tableMarker.test(line.text)) {
      const printed = valueAfter(lines, index, description[0].length)
      if (printed.text.length >= 3 && printed.text.length <= 500 && /[a-z]/i.test(printed.text)) add('description', printed.text, printed.lines, 3)
    }
    if (tableMarker.test(line.text)) {
      const rows: Line[] = []
      for (let next = index + 1; next < Math.min(lines.length, index + 8); next++) {
        const item = lines[next]
        if (!item.text) continue
        if (item.footer || pageMarker.test(item.text) || /^(?:sub[ -]?total|total|grand|VAT|net|amount\s+due|balance|less|terms|notes|payment|bank|TIN|due\s+date)\b/i.test(item.text) || buyerMarker.test(item.text) || supplierMarker.test(item.text)) break
        if (/[a-z]/i.test(item.text) && !documentMarker.test(item.text)) rows.push(item)
        if (rows.length === 4) break
      }
      if (rows.length && rows.map(row => row.text).join('; ').length <= 500) add('description', rows.map(row => row.text).join('; '), rows.map(row => row.number), 1)
    }
  }

  // Header inference is intentionally restricted to identifiable company names and address lines.
  const header: Line[] = []
  for (const line of lines.slice(0, 15)) {
    if (pageMarker.test(line.text)) { if (header.length) break; else continue }
    if (line.footer || line.role !== 'supplier' || buyerMarker.test(line.text) || documentMarker.test(line.text) || tableMarker.test(line.text)) break
    header.push(line)
  }
  if (!candidates.vendorName?.length) {
    for (const line of header) if (/\b(?:incorporated|inc\.?|corporation|corp\.?|company|co\.?|limited|ltd\.?|trading|enterprises|services|solutions|supply|supplies|hardware|restaurant|hospital|hotel|foundation)\b/i.test(line.text) && !/[:@]|\b(?:TIN|VAT|www|distributor\s+of|member\s+of|address)\b/i.test(line.text) && !plausibleAddress(line.text)) {
      const clean = cleanName(line.text)
      if (clean) add('vendorName', clean, [line.number], 1)
    }
  }
  if (!candidates.vendorAddress?.length && candidates.vendorName?.length) {
    const addressLines = header.filter(line => plausibleAddress(line.text)).slice(0, 4)
    if (addressLines.length && addressLines.map(line => line.text).join(', ').length <= 500) add('vendorAddress', addressLines.map(line => line.text).join(', '), addressLines.map(line => line.number), 1)
  }

  for (const field of Object.keys(candidates) as Field[]) {
    const list = candidates[field]!
    result.candidates[field] = list.map(({ value, lines, text }) => ({ value, lines, text }))
    const rank = Math.max(...list.map(candidate => candidate.rank))
    const best = list.filter(candidate => candidate.rank === rank)
    const values = [...new Set(best.map(candidate => candidate.value))]
    if (values.length !== 1 || best.some(candidate => candidate.unresolved) || overflow.has(field)) {
      if (values.length > 1) warn(`Conflicting ${fieldNames[field]} candidates were found; this field was left blank for review.`)
      continue
    }
    if (field === 'total' && rank === 1) {
      warn('Only an amount due or payable balance was identified. Confirm the gross invoice total manually; it may differ after withholding, payments or credits.')
      continue
    }
    if (field === 'netAmount' && mixedSales && best.some(candidate => /VATable\s+(?:sales|amount)/i.test(candidate.text))) {
      warn('This invoice includes exempt or zero-rated sales. VATable sales alone cannot identify its full net amount.')
      continue
    }
    const selected = best[0]
    result.fields[field] = selected.value
    result.evidence[field] = { value: selected.value, lines: selected.lines, text: selected.text }
  }
  if (hadBuyerTin) warn('Buyer/customer TIN details were excluded from supplier matching.')
  if (uncertainTin) warn('A TIN outside an identifiable supplier section was ignored. Confirm the supplier TIN manually.')
  if (payableOnly && result.fields.total && (adjustment || candidates.total?.some(item => item.rank === 1 && item.value !== result.fields.total))) warn('The payable balance may differ from the gross invoice total. Withholding, payments and credits require separate review.')
  if (moneyFields.some(field => candidates[field]?.length) && !hasPhp && !foreignCurrency) warn('The document does not explicitly identify PHP currency. Monetary fields were left blank for currency review.')
  if (!hasPhp || foreignCurrency || creditNote) for (const field of moneyFields) { delete result.fields[field]; delete result.evidence[field] }
  if (result.fields.total && result.fields.netAmount && result.fields.vatAmount) {
    const cents = (amount: string) => Number(amount.replace('.', ''))
    if (cents(result.fields.netAmount) + cents(result.fields.vatAmount) !== cents(result.fields.total)) warn('The extracted net amount plus VAT does not equal the gross total. Review discounts, exempt sales, other charges and the printed totals before saving.')
  }
  if (result.fields.date && result.fields.due && result.fields.due < result.fields.date) warn('The extracted due date is before the invoice date. Check both dates before saving.')
  if (!Object.keys(result.fields).length) warn('No fields could be selected safely. Review the source document and enter the bill details manually.')
  return result
}

export type SupplierVendorMatch<T> = {
  vendor?: T
  matches: T[]
  reason: 'tin_exact' | 'tin_base' | 'ambiguous' | 'not_found' | 'no_supplier_tin'
}

/** Never matches by name, creates a vendor, or selects a customer/archived record. */
export function matchSupplierVendor<T extends { id: string; kind?: string; active?: boolean; tin?: string; registeredName?: string }>(extraction: SupplierBillExtraction, parties: readonly T[]): SupplierVendorMatch<T> {
  const printedTin = extraction.fields.vendorTin
  if (!printedTin) return { matches: [], reason: 'no_supplier_tin' }
  let normalized: string
  try { normalized = normalizePartyTin(printedTin) } catch { return { matches: [], reason: 'no_supplier_tin' } }
  const hasBranch = printedTin.replace(/\D/g, '').length > 9
  const eligible = parties.flatMap(party => {
    if (party.kind !== 'vendor' || party.active !== true || typeof party.tin !== 'string') return []
    try { return [{ party, normalized: normalizePartyTin(party.tin) }] } catch { return [] }
  })
  const matches = eligible.filter(item => hasBranch ? item.normalized === normalized : item.normalized.slice(0, 9) === normalized.slice(0, 9)).map(item => item.party)
  if (matches.length > 1) return { matches, reason: 'ambiguous' }
  if (!matches.length) return { matches, reason: 'not_found' }
  return { vendor: matches[0], matches, reason: hasBranch ? 'tin_exact' : 'tin_base' }
}
