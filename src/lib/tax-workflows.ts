/** Personal tracking helpers. These do not calculate statutory tax or file a return. */
export const BIR_TRACKING_SOURCES = {
  calendar: 'https://bir-cdn.bir.gov.ph/BIR/pdf/RMC%20No.%20110-2025%20Digest.pdf',
  filing: 'https://bir-cdn.bir.gov.ph/BIR/pdf/RMC%20No.%2087-2024.pdf',
  services: 'https://www.bir.gov.ph/',
}
export function todayManila(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  const get = (type: string) => parts.find(part => part.type === type)!.value
  return `${get('year')}-${get('month')}-${get('day')}`
}
export function validTrackingDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '1900-01-01' || value > '9999-12-31') return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}
export function trackingDateLabel(value: string): string {
  return validTrackingDate(value) ? new Intl.DateTimeFormat('en-PH', { timeZone: 'UTC', year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(`${value}T00:00:00Z`)) : 'Date needs review'
}
export function daysToDeadline(value: string, today = todayManila()): number {
  if (!validTrackingDate(value) || !validTrackingDate(today)) return NaN
  return Math.round((Date.parse(`${value}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000)
}
export type TrackingStatus = 'upcoming' | 'due_soon' | 'overdue' | 'filed' | 'review'
export function deadlineStatus(item: { status: string; dueDate: string }, today = todayManila()): TrackingStatus {
  if (item.status === 'filed') return 'filed'
  const days = daysToDeadline(item.dueDate, today)
  if (!Number.isFinite(days)) return 'review'
  return days < 0 ? 'overdue' : days <= 14 ? 'due_soon' : 'upcoming'
}
export const trackingStatusLabel: Record<TrackingStatus, string> = { upcoming: 'Upcoming', due_soon: 'Due soon', overdue: 'Overdue', filed: 'Recorded filed', review: 'Review date' }
export function parsePesoAmount(value: string, allowZero = false): number {
  const input = value.trim()
  if (!/^\d+(\.\d{1,2})?$/.test(input)) throw Error('Enter a peso amount with no more than two decimal places.')
  const [whole, fraction = ''] = input.split('.')
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  if (!Number.isSafeInteger(cents) || cents > 1e12 || cents < (allowZero ? 0 : 1)) throw Error(`Amount must be ${allowZero ? 'zero or more' : 'at least ₱0.01'} and no more than ₱10 billion.`)
  return cents / 100
}
export function validatePesoAmount(value: number, allowZero = false): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw Error('Enter a valid peso amount.')
  return parsePesoAmount(String(value), allowZero)
}
export function safeTrackingUrl(value: string): string {
  const text = value.trim()
  if (!text) return ''
  let url: URL
  try { url = new URL(text) } catch { throw Error('Enter a complete http or https link.') }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || text.length > 1000) throw Error('Use an http or https link without login credentials, up to 1,000 characters.')
  return text
}
function bounded(value: string, label: string, max: number, required = true): string {
  if (typeof value !== 'string' || (required && !value.trim()) || value.length > max) throw Error(`${label} ${required ? 'is required and ' : ''}must be ${max} characters or fewer.`)
  return value.trim()
}
export type PersonalTransactionInput = { type: 'income' | 'expense'; description: string; amount: number; date: string; category: string; reference?: string }
export function normalizeTransaction(value: PersonalTransactionInput): PersonalTransactionInput {
  if (!['income', 'expense'].includes(value.type)) throw Error('Choose income or expense.')
  if (!validTrackingDate(value.date)) throw Error('Enter a valid transaction date.')
  return { type: value.type, description: bounded(value.description, 'Description', 500), amount: validatePesoAmount(value.amount), date: value.date, category: bounded(value.category || 'Uncategorized', 'Category', 100), reference: bounded(value.reference || '', 'Reference', 100, false) }
}
export type ManualDeadlineInput = { formType: string; title: string; dueDate: string; amountDue: number; taxPeriod?: string; sourceUrl?: string; notes?: string }
export function normalizeDeadline(value: ManualDeadlineInput): Required<ManualDeadlineInput> {
  if (!validTrackingDate(value.dueDate)) throw Error('Enter a valid due date confirmed for this obligation.')
  return { formType: bounded(value.formType, 'Form or obligation code', 30), title: bounded(value.title, 'Description', 200), dueDate: value.dueDate, amountDue: validatePesoAmount(value.amountDue, true), taxPeriod: bounded(value.taxPeriod || '', 'Tax period', 100, false), sourceUrl: safeTrackingUrl(value.sourceUrl || ''), notes: bounded(value.notes || '', 'Notes', 1000, false) }
}
export type FilingEvidence = { filingDate: string; filingReference: string; filingNotes?: string; evidenceUrl?: string }
export function normalizeFilingEvidence(value: FilingEvidence, today = todayManila()): Required<FilingEvidence> {
  if (!validTrackingDate(value.filingDate) || value.filingDate > today) throw Error('The recorded filing date must be a valid date no later than today in the Philippines.')
  return { filingDate: value.filingDate, filingReference: bounded(value.filingReference, 'Filing acknowledgement or reference', 200), filingNotes: bounded(value.filingNotes || '', 'Filing notes', 1000, false), evidenceUrl: safeTrackingUrl(value.evidenceUrl || '') }
}
export function filterTransactions<T extends PersonalTransactionInput>(items: T[], filters: { type?: string; query?: string; from?: string; to?: string }): T[] {
  const query = (filters.query || '').trim().toLowerCase()
  return items.filter(item => (!filters.type || filters.type === 'all' || item.type === filters.type) && (!filters.from || item.date >= filters.from) && (!filters.to || item.date <= filters.to) && (!query || `${item.description} ${item.category} ${item.reference || ''}`.toLowerCase().includes(query))).sort((a, b) => b.date.localeCompare(a.date))
}
export function transactionTotals(items: Pick<PersonalTransactionInput, 'type' | 'amount'>[]) {
  const income = items.filter(item => item.type === 'income').reduce((sum, item) => sum + Math.round(item.amount * 100), 0)
  const expenses = items.filter(item => item.type === 'expense').reduce((sum, item) => sum + Math.round(item.amount * 100), 0)
  return { income: income / 100, expenses: expenses / 100, net: (income - expenses) / 100 }
}
/** Quote values and neutralize spreadsheet formulas in user-controlled text. */
export function trackingCsv(rows: (string | number)[][]): string {
  return '\uFEFF' + rows.map(row => row.map(value => {
    let text = String(value)
    if (typeof value === 'string' && /^[\s]*[=+@-]/.test(text)) text = `'${text}`
    return `"${text.replaceAll('"', '""')}"`
  }).join(',')).join('\r\n')
}
export function downloadTrackingCsv(name: string, rows: (string | number)[][]): void {
  const url = URL.createObjectURL(new Blob([trackingCsv(rows)], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a'); link.href = url; link.download = name; link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
