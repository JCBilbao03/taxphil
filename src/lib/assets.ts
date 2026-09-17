/** Company-configured asset schedules. No statutory rate, useful life or tax eligibility is inferred. */
export type AssetPolicy = { method: 'straight_line' | 'none'; startMonth: string; usefulLifeMonths: number; residualValue: number; note: string }
export type AssetAccounts = { cost: string; accumulatedDepreciation: string; depreciationExpense: string; accumulatedImpairment: string; impairmentExpense: string; disposalGain: string; disposalLoss: string }
export const emptyAssetAccounts: AssetAccounts = { cost: '', accumulatedDepreciation: '', depreciationExpense: '', accumulatedImpairment: '', impairmentExpense: '', disposalGain: '', disposalLoss: '' }
export type AssetTaxPolicy = AssetPolicy & { basis: number; openingDepreciation: number }
export type AssetInput = {
  code: string; name: string; category: string; serialNumber: string; acquisitionDate: string; inServiceDate: string; basisDate: string
  cost: number; openingDepreciation: number; openingImpairment: number; location: string; custodian: string; notes: string
  sourceMode: 'existing_entry' | 'opening_journal'; sourceEntryId: string; openingEquityAccount: string
  accounts: AssetAccounts; bookPolicy: AssetPolicy; taxPolicy: AssetTaxPolicy
}
export type AssetCommand =
  | { kind: 'register'; reference: string; date: string; input: AssetInput }
  | { kind: 'depreciation'; reference: string; date: string; assetIds: string[]; throughMonth: string; note: string }
  | { kind: 'transfer'; reference: string; date: string; assetId: string; location: string; custodian: string; note: string }
  | { kind: 'impairment'; reference: string; date: string; assetId: string; amount: number; note: string }
  | { kind: 'disposal'; reference: string; date: string; assetId: string; proceeds: number; proceedsAccount: string; finalDepreciation: number; note: string }
  | { kind: 'reverse'; reference: string; date: string; runId: string; note: string }
export type AssetEvent = {
  id: string; runId: string; kind: AssetCommand['kind']; date: string; reference: string; note: string; entryId: string
  costDelta: number; depreciationDelta: number; impairmentDelta: number; depreciationExpense: number; proceeds: number
  throughMonth?: string; location?: string; custodian?: string; reversesEventId?: string
}
export type AssetRecord = AssetInput & { id: string; version: number; createdAt: string; createdBy: string; events: AssetEvent[] }
export type AssetControl = { revision: number; assetCount: number; allocations: Record<string, number>; protectedEntryIds: string[]; sourceAvailableFrom?: Record<string, string> }
export type AssetLine = { account: string; debit: number; credit: number }
export type AssetBooks = { accounts: { code: string; type: string; cash: boolean; name?: string }[]; entries: { id: string; date: string; reference: string; reversalOf?: string; lines: AssetLine[] }[]; closedThrough: string }
export type AssetPreviewRow = { assetId: string; code: string; name: string; cost: number; depreciation: number; impairment: number; carryingValue: number; change: number }
export type AssetPreview = { rows: AssetPreviewRow[]; lines: AssetLine[]; total: number; description: string }
export type AssetRun = { id: string; version: number; command: AssetCommand; status: 'draft' | 'posted' | 'rejected' | 'reversed'; preparedBy: string; preparedAt: string; preparedBooksRevision: number; assetVersions: Record<string, number>; preview: AssetPreview; approvedBy?: string; approvedAt?: string; reviewNote?: string; entryId?: string; resultAssetIds?: string[]; reversedByRunId?: string }
export const emptyAssetControl = (): AssetControl => ({ revision: 0, assetCount: 0, allocations: {}, protectedEntryIds: [] })
export function assetDate(value: unknown, label = 'date'): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '1900-01-01' || value > '9999-12-31' || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw Error(`Enter a valid ${label}.`)
  return value
}
export function assetMonth(value: unknown): string { if (typeof value !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value) || value < '1900-01' || value > '9999-12') throw Error('Choose a valid month.'); return value }
const monthIndex = (month: string) => Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1
const monthEnd = (month: string) => { const [year, number] = month.split('-').map(Number); return `${month}-${new Date(Date.UTC(year, number, 0)).getUTCDate()}` }
export function assetAmount(value: unknown, label: string, positive = false): number { if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < (positive ? 1 : 0) || value > 1e12) throw Error(`${label} must be a whole amount in centavos, within the supported range.`); return value }
const words = (value: unknown, label: string, length = 200, required = true) => { if (typeof value !== 'string' || value.length > length || (required && !value.trim())) throw Error(`Enter ${label} (up to ${length} characters).`); return value.trim() }
const object = (value: unknown): Record<string, unknown> => { if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Asset details are required.'); return value as Record<string, unknown> }
const identifier = (value: unknown) => { const id = words(value, 'a record identifier', 128); if (!/^[A-Za-z0-9_-]+$/.test(id)) throw Error('Invalid asset reference.'); return id }
function policy(value: unknown, cost: number, initialDepreciation: number, impairment: number): AssetPolicy {
  const p = object(value), method = p.method
  if (method !== 'straight_line' && method !== 'none') throw Error('Choose straight-line monthly depreciation or no automatic depreciation.')
  const startMonth = assetMonth(p.startMonth), residualValue = assetAmount(p.residualValue, 'Residual value')
  if (residualValue + initialDepreciation + impairment > cost) throw Error('Residual value plus opening depreciation and impairment cannot exceed cost.')
  const months = p.usefulLifeMonths
  if (typeof months !== 'number' || !Number.isInteger(months) || months < 1 || months > 1200) throw Error('Enter remaining useful life between 1 and 1,200 months.')
  return { method, startMonth, residualValue, usefulLifeMonths: months, note: words(p.note, 'the reviewed depreciation policy and timing basis', 2000) }
}
function account(books: AssetBooks, code: unknown, type: string, label: string) {
  const key = words(code, label, 8), found = books.accounts.find(row => row.code === key)
  if (!found || found.cash || ['1100', '2000', '1400', '2110'].includes(key) || found.type !== type) throw Error(`Select an existing non-cash ${type.toLowerCase()} account for ${label}.`)
  return key
}
export function validateAssetInput(value: unknown, books: AssetBooks): AssetInput {
  const i = object(value), a = object(i.accounts)
  const cost = assetAmount(i.cost, 'Acquisition cost', true), openingDepreciation = assetAmount(i.openingDepreciation, 'Opening depreciation'), openingImpairment = assetAmount(i.openingImpairment, 'Opening impairment')
  if (openingDepreciation + openingImpairment > cost) throw Error('Opening depreciation and impairment cannot exceed cost.')
  const acquisitionDate = assetDate(i.acquisitionDate, 'acquisition date'), inServiceDate = assetDate(i.inServiceDate, 'available-for-use date'), basisDate = assetDate(i.basisDate, 'register opening date')
  if (inServiceDate < acquisitionDate || basisDate < acquisitionDate) throw Error('The service and register opening dates cannot precede acquisition.')
  const bookPolicy = policy(i.bookPolicy, cost, openingDepreciation, openingImpairment)
  if (bookPolicy.startMonth < inServiceDate.slice(0, 7) || bookPolicy.startMonth < basisDate.slice(0, 7)) throw Error('Remaining book depreciation must start no earlier than the register opening and available-for-use month.')
  const t = object(i.taxPolicy), basis = assetAmount(t.basis, 'Tax basis'), taxOpening = assetAmount(t.openingDepreciation, 'Opening tax depreciation')
  const taxPolicy = { ...policy(t, basis, taxOpening, 0), basis, openingDepreciation: taxOpening }
  if (taxPolicy.startMonth < basisDate.slice(0, 7)) throw Error('The tax schedule must start no earlier than the register opening month.')
  const accounts: AssetAccounts = {
    cost: account(books, a.cost, 'Asset', 'asset cost'), accumulatedDepreciation: account(books, a.accumulatedDepreciation, 'Asset', 'accumulated depreciation'), depreciationExpense: account(books, a.depreciationExpense, 'Expense', 'depreciation expense'),
    accumulatedImpairment: account(books, a.accumulatedImpairment, 'Asset', 'accumulated impairment'), impairmentExpense: account(books, a.impairmentExpense, 'Expense', 'impairment expense'), disposalGain: account(books, a.disposalGain, 'Revenue', 'disposal gain'), disposalLoss: account(books, a.disposalLoss, 'Expense', 'disposal loss'),
  }
  if (new Set([accounts.cost, accounts.accumulatedDepreciation, accounts.accumulatedImpairment]).size !== 3) throw Error('Use distinct cost, accumulated depreciation and accumulated impairment accounts.')
  if (i.sourceMode !== 'existing_entry' && i.sourceMode !== 'opening_journal') throw Error('Choose an existing posted acquisition/opening entry or a new opening journal.')
  return { code: words(i.code, 'an asset code', 60), name: words(i.name, 'an asset name'), category: words(i.category, 'an asset category', 100), serialNumber: words(i.serialNumber, 'a serial number', 100, false), acquisitionDate, inServiceDate, basisDate, cost, openingDepreciation, openingImpairment,
    location: words(i.location, 'a location', 150), custodian: words(i.custodian, 'a custodian', 150), notes: words(i.notes, 'asset notes', 2000, false), accounts, bookPolicy, taxPolicy,
    sourceMode: i.sourceMode, sourceEntryId: i.sourceMode === 'existing_entry' ? identifier(i.sourceEntryId) : '', openingEquityAccount: i.sourceMode === 'opening_journal' ? account(books, i.openingEquityAccount, 'Equity', 'opening balance equity') : '',
  }
}
export function validateAssetCommand(value: unknown, books: AssetBooks): AssetCommand {
  const c = object(value), reference = words(c.reference, 'a unique reference', 180), date = assetDate(c.date)
  if (c.kind === 'register') { const input = validateAssetInput(c.input, books); if (date !== input.basisDate) throw Error('Registration date must match the register opening date.'); return { kind: c.kind, reference, date, input } }
  const note = words(c.note, 'the review basis', 2000)
  if (c.kind === 'depreciation') { if (!Array.isArray(c.assetIds) || !c.assetIds.length || c.assetIds.length > 100) throw Error('Select 1–100 assets.'); const assetIds = c.assetIds.map(identifier); if (new Set(assetIds).size !== assetIds.length) throw Error('Select each asset once.'); const throughMonth = assetMonth(c.throughMonth); if (date < monthEnd(throughMonth)) throw Error('Post monthly depreciation on or after the selected month end.'); return { kind: c.kind, reference, date, assetIds, throughMonth, note } }
  if (c.kind === 'reverse') return { kind: c.kind, reference, date, runId: identifier(c.runId), note }
  const assetId = identifier(c.assetId)
  if (c.kind === 'transfer') return { kind: c.kind, reference, date, assetId, location: words(c.location, 'the new location', 150), custodian: words(c.custodian, 'the new custodian', 150), note }
  if (c.kind === 'impairment') return { kind: c.kind, reference, date, assetId, amount: assetAmount(c.amount, 'Impairment', true), note }
  if (c.kind === 'disposal') return { kind: c.kind, reference, date, assetId, proceeds: assetAmount(c.proceeds, 'Net proceeds'), proceedsAccount: account(books, c.proceedsAccount, 'Asset', 'a dedicated disposal proceeds clearing account'), finalDepreciation: assetAmount(c.finalDepreciation, 'Reviewed final depreciation'), note }
  throw Error('Choose a supported asset action.')
}
export function effectiveAssetEvents(asset: AssetRecord, asOf = '9999-12-31') { const events = asset.events.filter(event => event.date <= asOf); const reversed = new Set(events.map(event => event.reversesEventId).filter(Boolean)); return events.filter(event => event.kind !== 'reverse' && !reversed.has(event.id)) }
export function assetBalances(asset: AssetRecord, asOf = '9999-12-31') {
  const events = asset.events.filter(event => event.date <= asOf), current = effectiveAssetEvents(asset, asOf)
  const cost = events.reduce((sum, event) => sum + event.costDelta, 0), depreciation = events.reduce((sum, event) => sum + event.depreciationDelta, 0), impairment = events.reduce((sum, event) => sum + event.impairmentDelta, 0)
  return { cost, depreciation, impairment, carryingValue: cost - depreciation - impairment, status: !current.some(event => event.kind === 'register') ? 'void' : current.some(event => event.kind === 'disposal') ? 'disposed' : 'active', location: current.filter(event => event.location !== undefined).at(-1)?.location || asset.location, custodian: current.filter(event => event.custodian !== undefined).at(-1)?.custodian || asset.custodian }
}
function activeAsset(assets: AssetRecord[], id: string, date: string) { const asset = assets.find(row => row.id === id); if (!asset) throw Error('Asset not found.'); if (assetBalances(asset).status !== 'active') throw Error(`${asset.code} is disposed or its registration was reversed.`); if (asset.events.some(event => event.date > date)) throw Error(`${asset.code} has later activity. Use a date on or after its latest event.`); return asset }
function requirePriorDepreciation(asset: AssetRecord, date: string) {
  const p = asset.bookPolicy, last = effectiveAssetEvents(asset).filter(event => event.kind === 'depreciation' && event.throughMonth).at(-1)?.throughMonth
  const prior = Math.min(monthIndex(date.slice(0, 7)) - 1, monthIndex(p.startMonth) + p.usefulLifeMonths - 1)
  if (p.method === 'straight_line' && assetBalances(asset).carryingValue > p.residualValue && prior >= monthIndex(p.startMonth) && (!last || monthIndex(last) < prior)) throw Error('Post the configured book depreciation through the previous month before impairment or disposal. Review the current-month charge separately.')
}
export function assetDepreciation(asset: AssetRecord, throughMonth: string) {
  const p = asset.bookPolicy, last = effectiveAssetEvents(asset).filter(event => event.kind === 'depreciation' && event.throughMonth).at(-1)?.throughMonth
  const first = last ? monthIndex(last) + 1 : monthIndex(p.startMonth), end = Math.min(monthIndex(assetMonth(throughMonth)), monthIndex(p.startMonth) + p.usefulLifeMonths - 1)
  if (end < first) throw Error(`${asset.code}: this period is already posted or precedes its next depreciation month.`)
  const b = assetBalances(asset), amount = Math.max(0, b.carryingValue - p.residualValue), remaining = monthIndex(p.startMonth) + p.usefulLifeMonths - first
  if (p.method === 'none' || !amount || remaining <= 0) return 0
  // Divide the remaining depreciable amount across the remaining configured months.
  return Number((BigInt(amount) * BigInt(end - first + 1) + BigInt(Math.floor(remaining / 2))) / BigInt(remaining))
}
export const assetAllocationKey = (entryId: string, accountCode: string, side: 'debit' | 'credit') => `${entryId}|${accountCode}|${side}`
export function assetAllocations(input: AssetInput): Record<string, number> { return input.sourceMode === 'existing_entry' ? Object.fromEntries([[assetAllocationKey(input.sourceEntryId, input.accounts.cost, 'debit'), input.cost], [assetAllocationKey(input.sourceEntryId, input.accounts.accumulatedDepreciation, 'credit'), input.openingDepreciation], [assetAllocationKey(input.sourceEntryId, input.accounts.accumulatedImpairment, 'credit'), input.openingImpairment]].filter(([, amount]) => Number(amount) > 0)) as Record<string, number> : {} }
export function validateAssetAllocation(input: AssetInput, books: AssetBooks, allocations: Record<string, number>) {
  if (input.sourceMode !== 'existing_entry') return
  const entry = books.entries.find(row => row.id === input.sourceEntryId)
  if (!entry || entry.date > input.basisDate || books.entries.some(row => row.reversalOf === entry.id) || entry.reversalOf) throw Error('Select an unreversed posted acquisition or opening entry dated no later than registration.')
  for (const [key, amount] of Object.entries(assetAllocations(input))) { const [, code, side] = key.split('|'); const available = entry.lines.filter(line => line.account === code).reduce((sum, line) => sum + line[side as 'debit' | 'credit'], 0); if (amount + (allocations[key] || 0) > available) throw Error('Asset allocations exceed the available amount on the source entry. Review its cost and opening depreciation/impairment lines.') }
}
function compactLines(lines: AssetLine[]) { const totals = new Map<string, number>(); for (const line of lines) totals.set(line.account, (totals.get(line.account) || 0) + line.debit - line.credit); return [...totals].filter(([, n]) => n !== 0).map(([account, n]) => ({ account, debit: Math.max(n, 0), credit: Math.max(-n, 0) })) }
export function previewAssetCommand(assets: AssetRecord[], books: AssetBooks, raw: AssetCommand): AssetPreview {
  const c = validateAssetCommand(raw, books), rows: AssetPreviewRow[] = [], lines: AssetLine[] = []
  const line = (account: string, amount: number) => { if (amount) lines.push({ account, debit: Math.max(amount, 0), credit: Math.max(-amount, 0) }) }
  if (c.kind === 'reverse') throw Error('Reversal previews use the saved asset action and its journal.')
  if (c.kind === 'register') { const i = c.input; if (assets.some(asset => asset.code.toLowerCase() === i.code.toLowerCase() && assetBalances(asset).status !== 'void')) throw Error('This asset code is already registered.'); rows.push({ assetId: '', code: i.code, name: i.name, cost: i.cost, depreciation: i.openingDepreciation, impairment: i.openingImpairment, carryingValue: i.cost - i.openingDepreciation - i.openingImpairment, change: i.cost }); if (i.sourceMode === 'opening_journal') { line(i.accounts.cost, i.cost); line(i.accounts.accumulatedDepreciation, -i.openingDepreciation); line(i.accounts.accumulatedImpairment, -i.openingImpairment); line(i.openingEquityAccount, -(i.cost - i.openingDepreciation - i.openingImpairment)) } }
  else for (const id of c.kind === 'depreciation' ? c.assetIds : [c.assetId]) {
    const asset = activeAsset(assets, id, c.date), b = assetBalances(asset), a = asset.accounts; let change = 0
    if (c.kind === 'depreciation') { change = assetDepreciation(asset, c.throughMonth); line(a.depreciationExpense, change); line(a.accumulatedDepreciation, -change) }
    if (c.kind === 'impairment') { requirePriorDepreciation(asset, c.date); if (c.amount > b.carryingValue) throw Error('Impairment cannot exceed carrying value.'); change = c.amount; line(a.impairmentExpense, change); line(a.accumulatedImpairment, -change) }
    if (c.kind === 'disposal') { requirePriorDepreciation(asset, c.date); if (c.finalDepreciation > Math.max(0, b.carryingValue - asset.bookPolicy.residualValue)) throw Error('Final depreciation cannot reduce carrying value below residual value.'); if ([a.cost, a.accumulatedDepreciation, a.accumulatedImpairment].includes(c.proceedsAccount)) throw Error('Use a separate disposal proceeds clearing account.'); change = b.carryingValue; line(a.depreciationExpense, c.finalDepreciation); line(a.accumulatedDepreciation, -c.finalDepreciation); line(c.proceedsAccount, c.proceeds); line(a.accumulatedDepreciation, b.depreciation + c.finalDepreciation); line(a.accumulatedImpairment, b.impairment); line(a.cost, -b.cost); const loss = b.carryingValue - c.finalDepreciation - c.proceeds; line(loss >= 0 ? a.disposalLoss : a.disposalGain, loss) }
    rows.push({ assetId: asset.id, code: asset.code, name: asset.name, ...b, change })
  }
  const compact = compactLines(lines)
  if (compact.some(item => !Number.isSafeInteger(item.debit) || !Number.isSafeInteger(item.credit) || Math.max(item.debit, item.credit) > 1e12) || compact.reduce((n, item) => n + item.debit - item.credit, 0) !== 0) throw Error('The proposed asset journal is outside supported limits or does not balance.')
  if (c.kind === 'depreciation' && !compact.length) throw Error('No depreciation remains for the selected assets and period.')
  return { rows, lines: compact, total: rows.reduce((sum, row) => sum + row.change, 0), description: `${c.kind === 'register' ? 'Register asset' : c.kind === 'depreciation' ? 'Asset depreciation' : `Asset ${c.kind}`} · ${c.reference}` }
}
export function assetReconciliation(assets: AssetRecord[], books: AssetBooks, asOf: string) {
  assetDate(asOf)
  const expected = new Map<string, number>()
  for (const asset of assets) { const b = assetBalances(asset, asOf); for (const [code, amount] of [[asset.accounts.cost, b.cost], [asset.accounts.accumulatedDepreciation, -b.depreciation], [asset.accounts.accumulatedImpairment, -b.impairment]] as const) expected.set(code, (expected.get(code) || 0) + amount) }
  return [...expected].map(([account, registerBalance]) => { const ledgerBalance = books.entries.filter(entry => entry.date <= asOf).flatMap(entry => entry.lines).filter(line => line.account === account).reduce((sum, line) => sum + line.debit - line.credit, 0); return { account, name: books.accounts.find(a => a.code === account)?.name || account, registerBalance, ledgerBalance, difference: ledgerBalance - registerBalance } })
}
export function assetTaxSchedule(asset: AssetRecord, from: string, to: string) {
  assetDate(from); assetDate(to); if (from > to) throw Error('Choose a valid reporting period.')
  const p = asset.taxPolicy, events = effectiveAssetEvents(asset, to), disposal = events.find(event => event.kind === 'disposal')
  const active = events.some(event => event.kind === 'register'), monthsBefore = (date: string) => Math.max(0, Math.min(p.usefulLifeMonths, monthIndex(date.slice(0, 7)) - monthIndex(p.startMonth) + (date >= monthEnd(date.slice(0, 7)) ? 1 : 0)))
  const cutoff = disposal && disposal.date < to ? disposal.date : to, start = new Date(`${from}T00:00:00Z`); start.setUTCDate(start.getUTCDate() - 1)
  const base = Math.max(0, p.basis - p.openingDepreciation - p.residualValue), cumulative = (months: number) => Number((BigInt(base) * BigInt(months) + BigInt(Math.floor(p.usefulLifeMonths / 2))) / BigInt(p.usefulLifeMonths))
  const taxDepreciation = active && p.method === 'straight_line' ? Math.max(0, cumulative(monthsBefore(cutoff)) - cumulative(monthsBefore(start.toISOString().slice(0, 10)))) : 0
  const bookDepreciation = asset.events.filter(event => event.date >= from && event.date <= to).reduce((sum, event) => sum + event.depreciationExpense, 0)
  return { assetId: asset.id, assetVersion: asset.version, code: asset.code, name: asset.name, from, to, bookDepreciation, taxDepreciation, adjustment: bookDepreciation - taxDepreciation, taxBasis: p.basis, bookPolicySnapshot: { ...asset.bookPolicy }, taxPolicySnapshot: { ...p }, note: p.note, reviewRequired: true, warning: 'Company-configured monthly tax schedule. Review eligibility, timing, impairments, disposal-month treatment and return adjustments; no tax rule is inferred.' }
}
