/** Shared, deterministic bank-reconciliation rules. Money is integer PHP centavos. */
export type BankIssue = { code: string; field?: string; message: string }
export type BankAccount = { id: string; name: string; bankName: string; accountSuffix: string; accountCode: string; currency: 'PHP'; active: boolean }
export type BankSourceRef = { format: 'csv' | 'xlsx' | 'pdf'; fileName: string; row: number; page?: number; sheet?: string; text?: string }
export type BankStatementRow = {
  id: string; date: string | null; description: string; reference: string
  amount: number | null; balance: number | null; source: BankSourceRef
  issues: BankIssue[]; raw: Record<string, string>
}
export type BankBookLine = { id: string; entryId: string; lineIndex: number; date: string; reference: string; description: string; amount: number; source: string }
export type BankAllocation = { bankRowId: string; bookLineId: string; amount: number }
export type BankBooks = { accounts: { code: string; type: string; cash: boolean }[]; entries: { id: string; date: string; reference: string; description: string; source: string; lines: { account: string; debit: number; credit: number }[] }[] }
export const BANK_LIMITS = Object.freeze({ rows: 5000, money: 1_000_000_000_000, allocations: 10000, groupAllocations: 100 })
const identifier = (value: unknown) => typeof value === 'string' && /^[A-Za-z0-9_:-]{1,200}$/.test(value)
export const validBankDate = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && value >= '1900-01-01' && value <= '2199-12-31' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
export const validBankMoney = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && Math.abs(value) <= BANK_LIMITS.money
function string(value: unknown, label: string, max: number, optional = false): string {
  if (typeof value !== 'string' || value.length > max || (!optional && !value.trim()) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) throw Error(`Enter a valid ${label}.`)
  return value.trim()
}
function safeSum(values: number[]): number {
  const value = values.reduce((sum, amount) => sum + amount, 0)
  if (!Number.isSafeInteger(value)) throw Error('A bank-reconciliation total exceeds the supported range.')
  return value
}
const issue = (code: string, message: string, field?: string): BankIssue => ({ code, message, ...(field ? { field } : {}) })

export function validateBankAccount(value: unknown, chart: BankBooks['accounts']): BankAccount {
  const account = value as BankAccount
  if (!account || !identifier(account.id) || account.id.includes(':') || typeof account.active !== 'boolean' || account.currency !== 'PHP') throw Error('Select a valid PHP bank account.')
  if (!chart.some(row => row.code === account.accountCode && row.type === 'Asset' && row.cash)) throw Error('Link the bank to an existing cash/bank asset account.')
  const suffix = string(account.accountSuffix, 'masked bank account suffix', 8)
  if (!/^[A-Za-z0-9]{1,8}$/.test(suffix)) throw Error('Enter only the final 1–8 letters or digits of the bank account number.')
  return { id: account.id, name: string(account.name, 'bank account name', 150), bankName: string(account.bankName, 'bank name', 150), accountSuffix: suffix, accountCode: account.accountCode, currency: 'PHP', active: account.active }
}

/** Draft imports may retain unresolved cells; approval/matching uses the strict default. */
export function validateStatementRows(value: unknown, options: { allowUnresolved?: boolean } = {}): BankStatementRow[] {
  if (!Array.isArray(value) || !value.length || value.length > BANK_LIMITS.rows) throw Error(`Import between 1 and ${BANK_LIMITS.rows} bank statement rows.`)
  const seen = new Set<string>()
  return value.map((input: BankStatementRow) => {
    if (!input || !identifier(input.id) || seen.has(input.id)) throw Error('Every bank statement row needs a unique stable ID.')
    seen.add(input.id)
    if (input.date !== null && !validBankDate(input.date)) throw Error('A bank statement date is invalid.')
    if (input.amount !== null && (!validBankMoney(input.amount) || input.amount === 0)) throw Error('A bank transaction must contain a nonzero signed amount in centavos.')
    if (input.balance !== null && !validBankMoney(input.balance)) throw Error('A bank running balance is invalid.')
    if (!Array.isArray(input.issues) || input.issues.length > 30) throw Error('Invalid bank statement review issues.')
    const issues = input.issues.map(item => ({ code: string(item?.code, 'issue code', 80), message: string(item?.message, 'issue message', 500), ...(item?.field ? { field: string(item.field, 'issue field', 80) } : {}) }))
    if (!options.allowUnresolved && (!input.date || input.amount === null || issues.length)) throw Error('Resolve and review every selected statement row before matching or approving it.')
    const source = input.source
    if (!source || !['csv', 'xlsx', 'pdf'].includes(source.format) || !Number.isSafeInteger(source.row) || source.row < 1 || source.row > 1_000_000) throw Error('Retain the original source row for every bank transaction.')
    if (source.page !== undefined && (!Number.isSafeInteger(source.page) || source.page < 1 || source.page > 10000)) throw Error('Invalid statement page reference.')
    if (!input.raw || typeof input.raw !== 'object' || Array.isArray(input.raw) || Object.keys(input.raw).length > 20) throw Error('Retain valid original statement values.')
    const raw = Object.fromEntries(Object.entries(input.raw).map(([key, val]) => [string(key, 'source field', 80), string(val, 'source value', 4000, true)]))
    return { id: input.id, date: input.date, description: string(input.description, 'bank description', 1000, true), reference: string(input.reference, 'bank reference', 200, true), amount: input.amount, balance: input.balance,
      source: { format: source.format, fileName: string(source.fileName, 'source filename', 200), row: source.row, ...(source.page === undefined ? {} : { page: source.page }), ...(source.sheet === undefined ? {} : { sheet: string(source.sheet, 'worksheet name', 100) }), ...(source.text === undefined ? {} : { text: string(source.text, 'source row text', 4000, true) }) }, issues, raw }
  })
}

export function validateStatementBalances(input: { rows: BankStatementRow[]; openingBalance: number | null; closingBalance: number | null; from?: string; to?: string; order?: 'ascending' | 'descending' }) {
  const rows = validateStatementRows(input.rows, { allowUnresolved: true })
  const issues: BankIssue[] = []
  if (input.from !== undefined && !validBankDate(input.from)) issues.push(issue('invalid_period', 'Enter a valid statement start date.', 'from'))
  if (input.to !== undefined && !validBankDate(input.to)) issues.push(issue('invalid_period', 'Enter a valid statement end date.', 'to'))
  if (input.from && input.to && input.from > input.to) issues.push(issue('invalid_period', 'The statement end must be on or after its start.'))
  if (!validBankMoney(input.openingBalance)) issues.push(issue('missing_opening_balance', 'Enter and review the statement opening balance.', 'openingBalance'))
  if (!validBankMoney(input.closingBalance)) issues.push(issue('missing_closing_balance', 'Enter and review the statement closing balance.', 'closingBalance'))
  const ordered = input.order === 'descending' ? [...rows].reverse() : rows
  let running: number | null = validBankMoney(input.openingBalance) ? input.openingBalance : null
  let previousDate = ''
  for (const row of ordered) {
    if (!row.date || row.amount === null || row.issues.length) issues.push(issue('unresolved_row', `Review statement row ${row.source.row}.`, row.id))
    if (row.date && ((input.from && row.date < input.from) || (input.to && row.date > input.to))) issues.push(issue('outside_period', `Row ${row.source.row} is outside the statement period.`, row.id))
    if (row.date && previousDate && row.date < previousDate) issues.push(issue('row_order', `Check the transaction order near row ${row.source.row}.`, row.id))
    if (row.date) previousDate = row.date
    if (row.amount === null) running = null
    else if (running !== null) running = safeSum([running, row.amount])
    if (row.balance !== null && running !== null && row.balance !== running) issues.push(issue('running_balance_mismatch', `The running balance at row ${row.source.row} does not agree with the extracted transactions.`, row.id))
  }
  const movement = rows.every(row => row.amount !== null) ? safeSum(rows.map(row => row.amount!)) : null
  const calculatedClosingBalance = movement !== null && validBankMoney(input.openingBalance) ? safeSum([input.openingBalance, movement]) : null
  if (calculatedClosingBalance !== null && validBankMoney(input.closingBalance) && calculatedClosingBalance !== input.closingBalance) issues.push(issue('closing_balance_mismatch', 'Opening balance plus transactions does not equal the statement closing balance.', 'closingBalance'))
  return { valid: !issues.length, issues, movement, calculatedClosingBalance, unresolvedRowCount: rows.filter(row => !row.date || row.amount === null || row.issues.length).length }
}

/** Keep original and reversal cash lines: both are real ledger movements. */
export function bankLedgerLines(books: BankBooks, accountCode: string, through = '2199-12-31'): BankBookLine[] {
  if (!books.accounts.some(account => account.code === accountCode && account.cash && account.type === 'Asset')) throw Error('Select a cash/bank asset account.')
  if (!validBankDate(through)) throw Error('Enter a valid bank ledger cutoff date.')
  const result: BankBookLine[] = []
  const seen = new Set<string>()
  for (const entry of books.entries) {
    if (!identifier(entry.id) || !validBankDate(entry.date)) throw Error('A ledger entry has an invalid identity or date.')
    if (entry.date > through) continue
    entry.lines.forEach((line, lineIndex) => {
      if (line.account !== accountCode) return
      if (![line.debit, line.credit].every(value => validBankMoney(value) && value >= 0) || (line.debit > 0) === (line.credit > 0)) throw Error('A bank ledger line has invalid debit/credit amounts.')
      const id = `${entry.id}:${lineIndex}`
      if (seen.has(id)) throw Error('The bank ledger contains duplicate entry identities.')
      seen.add(id)
      result.push({ id, entryId: entry.id, lineIndex, date: entry.date, reference: entry.reference, description: entry.description, amount: line.debit - line.credit, source: entry.source })
    })
  }
  return result.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
}

const normalizedText = (value: string) => value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase()
export function bankRowFingerprint(row: BankStatementRow): string | null {
  if (!row.date || row.amount === null) return null
  return JSON.stringify([row.date, row.amount, normalizedText(row.reference), normalizedText(row.description)])
}
/** Similar rows are candidates for human review, never silently removed. */
export function findBankDuplicateCandidates(rows: BankStatementRow[], existingRows: BankStatementRow[] = []) {
  const known = new Map<string, string[]>()
  for (const row of existingRows) {
    const key = bankRowFingerprint(row)
    if (key) known.set(key, [...(known.get(key) || []), row.id])
  }
  const candidates: { rowId: string; existingRowIds: string[]; reason: 'same_details' }[] = []
  for (const row of rows) {
    const key = bankRowFingerprint(row)
    if (!key) continue
    const matches = (known.get(key) || []).filter(id => id !== row.id)
    if (matches.length) candidates.push({ rowId: row.id, existingRowIds: [...new Set(matches)], reason: 'same_details' })
    known.set(key, [...(known.get(key) || []), row.id])
  }
  return candidates
}

function bookLineMap(lines: BankBookLine[]) {
  const map = new Map<string, BankBookLine>()
  for (const line of lines) {
    if (!identifier(line.entryId) || !Number.isSafeInteger(line.lineIndex) || line.lineIndex < 0 || line.id !== `${line.entryId}:${line.lineIndex}` || map.has(line.id) || !validBankMoney(line.amount) || !line.amount || !validBankDate(line.date)) throw Error('Select valid, unique bank ledger lines.')
    map.set(line.id, line)
  }
  return map
}

/** Positive allocations consume book-line magnitude; their sign comes from that line.
 * This supports split payments and net deposits grouping receipts with bank fees.
 * Pass all existing allocations that touch the supplied rows/book lines.
 */
export function validateBankMatch(input: { bankRows: BankStatementRow[]; bookLines: BankBookLine[]; existingAllocations?: BankAllocation[]; allocations: BankAllocation[] }) {
  const rows = new Map(validateStatementRows(input.bankRows).map(row => [row.id, row]))
  const lines = bookLineMap(input.bookLines)
  if (!Array.isArray(input.allocations) || !input.allocations.length || input.allocations.length > BANK_LIMITS.groupAllocations || !Array.isArray(input.existingAllocations || []) || (input.existingAllocations?.length || 0) > BANK_LIMITS.allocations) throw Error('Select 1–100 valid match allocations.')
  const bookUsed = new Map<string, number>(), bankUsed = new Map<string, number>(), pairs = new Set<string>()
  for (const allocation of [...(input.existingAllocations || []), ...input.allocations]) {
    const row = rows.get(allocation?.bankRowId), line = lines.get(allocation?.bookLineId)
    if (!row || !line || !validBankMoney(allocation.amount) || allocation.amount <= 0) throw Error('A match references an unavailable statement row, ledger line or amount.')
    const pair = JSON.stringify([allocation.bankRowId, allocation.bookLineId])
    if (pairs.has(pair)) throw Error('A bank row and ledger line are already linked. Update their reviewed allocation instead of adding it twice.')
    pairs.add(pair)
    bookUsed.set(line.id, safeSum([bookUsed.get(line.id) || 0, allocation.amount]))
    bankUsed.set(row.id, safeSum([bankUsed.get(row.id) || 0, Math.sign(line.amount) * allocation.amount]))
  }
  const bankRemaining: Record<string, number> = {}, bookRemaining: Record<string, number> = {}
  for (const line of lines.values()) {
    const used = bookUsed.get(line.id) || 0
    if (used > Math.abs(line.amount)) throw Error('A ledger line cannot be matched for more than its remaining amount.')
    bookRemaining[line.id] = used === Math.abs(line.amount) ? 0 : Math.sign(line.amount) * (Math.abs(line.amount) - used)
  }
  for (const row of rows.values()) {
    const used = bankUsed.get(row.id) || 0
    if ((used && Math.sign(used) !== Math.sign(row.amount!)) || Math.abs(used) > Math.abs(row.amount!)) throw Error('A statement row cannot be overmatched or matched in the opposite cash direction.')
    bankRemaining[row.id] = row.amount! - used
  }
  return { allocations: input.allocations.map(row => ({ ...row })), bankRemaining, bookRemaining, matchedBankRowIds: Object.keys(bankRemaining).filter(id => bankRemaining[id] === 0), matchedBookLineIds: Object.keys(bookRemaining).filter(id => bookRemaining[id] === 0) }
}

export function suggestBankMatches(row: BankStatementRow, bookLines: BankBookLine[], allocations: BankAllocation[] = []) {
  if (!row.date || row.amount === null || row.issues.length) return []
  const lines = bookLineMap(bookLines), used = new Map<string, number>()
  let bankUsed = 0
  for (const allocation of allocations) {
    if (!validBankMoney(allocation.amount) || allocation.amount <= 0) throw Error('Invalid existing match allocation.')
    const line = lines.get(allocation.bookLineId)
    if (!line) throw Error('Load the ledger lines referenced by existing allocations before suggesting matches.')
    used.set(line.id, safeSum([used.get(line.id) || 0, allocation.amount]))
    if (allocation.bankRowId === row.id) bankUsed = safeSum([bankUsed, Math.sign(line.amount) * allocation.amount])
  }
  const remaining = row.amount - bankUsed
  if (!remaining || Math.sign(remaining) !== Math.sign(row.amount)) return []
  return bookLines.flatMap(line => {
    const available = Math.abs(line.amount) - (used.get(line.id) || 0)
    if (available <= 0 || Math.sign(line.amount) !== Math.sign(remaining)) return []
    const days = Math.abs(Date.parse(row.date!) - Date.parse(line.date)) / 86400000
    const exactAmount = available === Math.abs(remaining)
    const sameReference = !!row.reference.trim() && normalizedText(row.reference) === normalizedText(line.reference)
    const sameDescription = !!row.description.trim() && normalizedText(row.description) === normalizedText(line.description)
    const reasons = [exactAmount ? 'Same remaining amount' : 'Possible split or group allocation', ...(sameReference ? ['Same reference'] : []), ...(days === 0 ? ['Same date'] : days <= 7 ? [`Dates within ${days} day${days === 1 ? '' : 's'}`] : []), ...(sameDescription ? ['Same description'] : [])]
    const score = (exactAmount ? 100 : 10) + (sameReference ? 40 : 0) + Math.max(0, 20 - days * 2) + (sameDescription ? 10 : 0)
    return [{ bookLineId: line.id, amount: Math.min(available, Math.abs(remaining)), score, exactAmount, daysApart: days, reasons }]
  }).sort((a, b) => b.score - a.score || a.daysApart - b.daysApart || a.bookLineId.localeCompare(b.bookLineId)).slice(0, 10)
}

/** Remove the reviewed, already-cleared opening baseline before offering match candidates.
 * Approved and pending allocations are subtracted separately by the matching workspace.
 */
export function excludeClearedOpeningLines(
  lines: BankBookLine[],
  statement: { bankId: string; from: string; openingOutstandingLineIds: string[] },
  statements: { bankId: string; from: string; status: string; openingOutstandingLineIds: string[] }[],
): BankBookLine[] {
  const baseline = statements.filter(row => row.bankId === statement.bankId && row.status === 'approved').sort((a, b) => a.from.localeCompare(b.from))[0] || statement
  const outstanding = new Set(baseline.openingOutstandingLineIds)
  return lines.filter(line => line.date >= baseline.from || outstanding.has(line.id))
}
