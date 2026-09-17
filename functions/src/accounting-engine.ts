export type AccountType = 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense'
export type Account = { code: string; name: string; type: AccountType; cash: boolean }
export type Line = { account: string; debit: number; credit: number }
export type Entry = {
  id: string; date: string; reference: string; description: string; lines: Line[]
  source: 'journal' | 'payable' | 'receivable' | 'payment' | 'receipt' | 'reversal'
  createdAt: string; reversalOf?: string
}
export type SupplierBillPdf = { path: string; name: string; size: number; type: 'application/pdf' }
export const MAX_SUPPLIER_BILL_PDF_BYTES = 10 * 1024 * 1024
export function validateSupplierBillPdf(value: unknown, companyId?: string): SupplierBillPdf {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Attach a valid supplier bill PDF.')
  const file = value as Record<string, unknown>
  if (Object.keys(file).some(key => !['path', 'name', 'size', 'type'].includes(key))) throw Error('Supplier bill PDF metadata contains unsupported fields.')
  if (typeof file.path !== 'string' || !/^companies\/[A-Za-z0-9_-]{1,128}\/supplier-bills\/[A-Za-z0-9_-]{1,128}$/.test(file.path)) throw Error('The supplier bill PDF must be stored in company documents.')
  if (companyId !== undefined && file.path.split('/')[1] !== companyId) throw Error('The supplier bill PDF must belong to your company.')
  if (typeof file.name !== 'string' || !file.name.trim() || file.name.length > 200 || /[/\\]/.test(file.name) || [...file.name].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127) || !/\.pdf$/i.test(file.name)) throw Error('Use a PDF filename of at most 200 characters without path separators or control characters.')
  if (typeof file.size !== 'number' || !Number.isSafeInteger(file.size) || file.size <= 0 || file.size > MAX_SUPPLIER_BILL_PDF_BYTES) throw Error('The supplier bill PDF must be between 1 byte and 10 MiB.')
  if (file.type !== 'application/pdf') throw Error('Only PDF supplier bills can be attached.')
  return { path: file.path, name: file.name, size: file.size, type: 'application/pdf' }
}
export type Invoice = {
  id: string; kind: 'payable' | 'receivable'; party: string; reference: string
  date: string; due: string; amount: number; account: string; entryId: string
  taxTreatment?: 'VAT12' | 'VAT_ZERO' | 'VAT_EXEMPT' | 'NON_VAT'
  netAmount?: number; vatAmount?: number; partyId?: string; partyTin?: string; partyAddress?: string; description?: string
  supplierBillPdf?: SupplierBillPdf
}
export type SettlementDocumentKind = 'collection_receipt' | 'deposit_slip' | 'transfer_confirmation' | 'payment_approval' | 'check_copy' | 'vendor_collection_receipt'
export type SettlementSupportingDocument = { path: string; name: string; size: number; type: 'application/pdf' | 'image/png' | 'image/jpeg'; kind: SettlementDocumentKind }
export const MAX_SETTLEMENT_DOCUMENTS = 10
export const MAX_SETTLEMENT_DOCUMENT_BYTES = 10 * 1024 * 1024
export const SETTLEMENT_DOCUMENT_KINDS: Record<Invoice['kind'], readonly SettlementDocumentKind[]> = {
  receivable: ['collection_receipt', 'deposit_slip', 'transfer_confirmation'],
  payable: ['payment_approval', 'check_copy', 'transfer_confirmation', 'vendor_collection_receipt'],
}
export function validateSettlementSupportingDocument(value: unknown, invoiceKind?: Invoice['kind'], companyId?: string): SettlementSupportingDocument {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Attach a valid payment or receipt supporting document.')
  const file = value as Record<string, unknown>
  if (Object.keys(file).some(key => !['path', 'name', 'size', 'type', 'kind'].includes(key))) throw Error('Supporting document metadata contains unsupported fields.')
  if (typeof file.path !== 'string' || !/^companies\/[A-Za-z0-9_-]{1,128}\/settlement-evidence\/[A-Za-z0-9_-]{1,128}$/.test(file.path)) throw Error('The supporting document must be stored with company payment and receipt evidence.')
  if (companyId !== undefined && file.path.split('/')[1] !== companyId) throw Error('The supporting document must belong to your company.')
  if (typeof file.name !== 'string' || !file.name.trim() || file.name.length > 200 || /[/\\]/.test(file.name) || [...file.name].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) throw Error('Use a filename of at most 200 characters without path separators or control characters.')
  const extensions: Record<SettlementSupportingDocument['type'], RegExp> = { 'application/pdf': /\.pdf$/i, 'image/png': /\.png$/i, 'image/jpeg': /\.jpe?g$/i }
  if (typeof file.type !== 'string' || !Object.hasOwn(extensions, file.type) || !extensions[file.type as SettlementSupportingDocument['type']].test(file.name)) throw Error('Supporting documents must be PDF, PNG, or JPEG files with a matching filename extension.')
  if (typeof file.size !== 'number' || !Number.isSafeInteger(file.size) || file.size <= 0 || file.size > MAX_SETTLEMENT_DOCUMENT_BYTES) throw Error('Each supporting document must be between 1 byte and 10 MiB.')
  if (invoiceKind !== undefined && !['payable', 'receivable'].includes(invoiceKind)) throw Error('Choose a valid payment or receipt type.')
  const kinds = invoiceKind === undefined ? [...SETTLEMENT_DOCUMENT_KINDS.payable, ...SETTLEMENT_DOCUMENT_KINDS.receivable] : SETTLEMENT_DOCUMENT_KINDS[invoiceKind]
  if (!kinds.includes(file.kind as SettlementDocumentKind)) throw Error('Choose a supporting document type allowed for this payment or receipt.')
  return { path: file.path, name: file.name, size: file.size, type: file.type as SettlementSupportingDocument['type'], kind: file.kind as SettlementDocumentKind }
}
export function validateSettlementSupportingDocuments(value: unknown, invoiceKind?: Invoice['kind'], companyId?: string): SettlementSupportingDocument[] {
  if (!Array.isArray(value) || value.length > MAX_SETTLEMENT_DOCUMENTS) throw Error('Attach at most 10 supporting documents per payment or receipt.')
  const files = value.map(file => validateSettlementSupportingDocument(file, invoiceKind, companyId))
  if (new Set(files.map(file => file.path)).size !== files.length) throw Error('Attach each supporting document only once per payment or receipt.')
  return files
}
export type Settlement = { id: string; invoiceId: string; entryId: string; amount: number; date: string; supportingDocuments?: SettlementSupportingDocument[] }
export type Books = {
  version: 1; accounts: Account[]; entries: Entry[]; invoices: Invoice[]
  settlements: Settlement[]; closedThrough: string
}
export const initialAccounts: Account[] = [
  { code: '1000', name: 'Cash on Hand', type: 'Asset', cash: true },
  { code: '1010', name: 'Cash in Bank', type: 'Asset', cash: true },
  { code: '1100', name: 'Accounts Receivable', type: 'Asset', cash: false },
  { code: '1200', name: 'Inventory', type: 'Asset', cash: false },
  { code: '1300', name: 'Prepaid Expenses', type: 'Asset', cash: false },
  { code: '1500', name: 'Equipment', type: 'Asset', cash: false },
  { code: '2000', name: 'Accounts Payable', type: 'Liability', cash: false },
  { code: '2100', name: 'Taxes Payable', type: 'Liability', cash: false },
  { code: '2200', name: 'Loans Payable', type: 'Liability', cash: false },
  { code: '3000', name: 'Owner’s Capital', type: 'Equity', cash: false },
  { code: '3100', name: 'Owner’s Drawings', type: 'Equity', cash: false },
  { code: '3200', name: 'Retained Earnings', type: 'Equity', cash: false },
  { code: '4000', name: 'Sales Revenue', type: 'Revenue', cash: false },
  { code: '4100', name: 'Service Revenue', type: 'Revenue', cash: false },
  { code: '5000', name: 'Cost of Sales', type: 'Expense', cash: false },
  { code: '5100', name: 'Rent Expense', type: 'Expense', cash: false },
  { code: '5200', name: 'Salaries Expense', type: 'Expense', cash: false },
  { code: '5300', name: 'Utilities Expense', type: 'Expense', cash: false },
  { code: '5400', name: 'Office Supplies Expense', type: 'Expense', cash: false },
  { code: '5900', name: 'Other Operating Expenses', type: 'Expense', cash: false },
]
export const emptyBooks = (): Books => ({ version: 1, accounts: structuredClone(initialAccounts), entries: [], invoices: [], settlements: [], closedThrough: '' })
export const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
export const money = (cents: number) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format((cents || 0) / 100)
export function cents(value: string): number {
  if (!/^\d+(\.\d{1,2})?$/.test(value)) throw Error('Enter a positive amount with at most two decimal places.')
  const result = Math.round(Number(value) * 100)
  if (!Number.isSafeInteger(result) || result <= 0 || result > 1e12) throw Error('Amount must be between ₱0.01 and ₱10 billion.')
  return result
}
function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && value >= '1900-01-01' && value <= '9999-12-31' && new Date(value).toISOString().slice(0, 10) === value
}
function postingDate(b: Books, date: string) {
  if (!validDate(date)) throw Error('Enter a valid transaction date.')
  if (b.closedThrough && date <= b.closedThrough) throw Error(`The books are closed through ${b.closedThrough}. Use a later date.`)
}
function text(value: string, name: string, max = 200) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw Error(`${name} is required (maximum ${max} characters).`)
}
function validLines(b: Books, lines: Line[]) {
  if (!Array.isArray(lines) || lines.length < 2 || lines.length > 100) throw Error('Use 2–100 journal lines.')
  for (const l of lines) {
    if (!b.accounts.some(a => a.code === l.account)) throw Error('Choose an existing account for every line.')
    if (![l.debit, l.credit].every(n => Number.isSafeInteger(n) && n >= 0 && n <= 1e12) || (l.debit > 0) === (l.credit > 0)) throw Error('Each line must have either a debit or a credit, never both.')
  }
  if (lines.reduce((s, l) => s + l.debit - l.credit, 0) !== 0) throw Error('Total debits must equal total credits.')
}
export function post(b: Books, input: Omit<Entry, 'id' | 'createdAt'>): Books {
  postingDate(b, input.date); text(input.reference, 'Reference'); text(input.description, 'Description', 500); validLines(b, input.lines)
  if (input.source !== 'reversal' && input.reversalOf !== undefined) throw Error('Only reversal entries can link to an original entry.')
  if (b.entries.some(e => e.reference.toLowerCase() === input.reference.trim().toLowerCase())) throw Error('This reference is already used. Choose a unique reference.')
  if (input.source === 'journal' && input.lines.some(l => ['1100', '2000'].includes(l.account))) throw Error('Use Accounts Payable or Accounts Receivable for control-account postings so the subledgers stay in balance.')
  const entry: Entry = { ...input, reference: input.reference.trim(), description: input.description.trim(), id: crypto.randomUUID(), createdAt: new Date().toISOString() }
  return { ...b, entries: [...b.entries, entry] }
}
export const isReversed = (b: Books, entryId: string, asOf = '9999-12-31') => b.entries.some(e => e.source === 'reversal' && e.reversalOf === entryId && e.date <= asOf)
export const outstanding = (b: Books, i: Invoice, asOf = '9999-12-31') => isReversed(b, i.entryId, asOf) ? 0 : i.amount - b.settlements.filter(s => s.invoiceId === i.id && s.date <= asOf && !isReversed(b, s.entryId, asOf)).reduce((sum, s) => sum + s.amount, 0)
export function addInvoice(b: Books, input: Omit<Invoice, 'id' | 'entryId'>): Books {
  if (input.partyId !== undefined && (typeof input.partyId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(input.partyId))) throw Error('Invalid vendor or customer directory reference.')
  if (input.supplierBillPdf !== undefined && input.kind !== 'payable') throw Error('Supplier bill PDFs can only be attached to accounts payable bills.')
  const supplierBillPdf = input.supplierBillPdf === undefined ? undefined : validateSupplierBillPdf(input.supplierBillPdf)
  text(input.party, 'Customer or supplier'); text(input.reference, 'Invoice reference'); postingDate(b, input.date)
  if (!validDate(input.due) || input.due < input.date) throw Error('Due date must be on or after the invoice date.')
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0 || input.amount > 1e12) throw Error('Enter a valid invoice amount.')
  const account = b.accounts.find(a => a.code === input.account)
  const payable = input.kind === 'payable'
  if (!['payable', 'receivable'].includes(input.kind)) throw Error('Choose a valid invoice type.')
  if (input.taxTreatment && !['VAT12', 'VAT_ZERO', 'VAT_EXEMPT', 'NON_VAT'].includes(input.taxTreatment)) throw Error('Choose a valid tax treatment.')
  const vatAmount = input.taxTreatment === 'VAT12' ? Number((BigInt(input.amount) * 12n + 56n) / 112n) : 0
  const netAmount = input.amount - vatAmount
  const taxAccount: Account = payable ? { code: '1400', name: 'Input VAT', type: 'Asset', cash: false } : { code: '2110', name: 'Output VAT Payable', type: 'Liability', cash: false }
  if (vatAmount) {
    const existing = b.accounts.find(a => a.code === taxAccount.code)
    if (existing && (existing.type !== taxAccount.type || existing.cash || existing.name !== taxAccount.name)) throw Error(`Account ${taxAccount.code} must be reserved for ${taxAccount.name}.`)
    if (!existing) b = addAccount(b, taxAccount)
  }
  if (!account || account.cash || ['1100', '2000', '1400', '2110'].includes(account.code) || !(payable ? ['Expense', 'Asset'] : ['Revenue']).includes(account.type)) throw Error('Choose an appropriate expense/asset or revenue account.')
  const id = crypto.randomUUID()
  const next = post(b, { date: input.date, reference: `${payable ? 'AP' : 'AR'}-${input.reference.trim()}`, description: `${input.party.trim()} · ${input.reference.trim()}`, source: input.kind,
    lines: payable ? [{ account: input.account, debit: netAmount, credit: 0 }, ...(vatAmount ? [{ account: taxAccount.code, debit: vatAmount, credit: 0 }] : []), { account: '2000', debit: 0, credit: input.amount }] : [{ account: '1100', debit: input.amount, credit: 0 }, { account: input.account, debit: 0, credit: netAmount }, ...(vatAmount ? [{ account: taxAccount.code, debit: 0, credit: vatAmount }] : [])] })
  return { ...next, invoices: [...b.invoices, { ...input, ...(supplierBillPdf ? { supplierBillPdf } : {}), ...(input.taxTreatment ? { netAmount, vatAmount } : {}), party: input.party.trim(), reference: input.reference.trim(), id, entryId: next.entries.at(-1)!.id }] }
}
export function settle(b: Books, invoiceId: string, amount: number, date: string, cash: string, reference: string, supportingDocuments?: SettlementSupportingDocument[]): Books {
  const invoice = b.invoices.find(i => i.id === invoiceId)
  if (!invoice) throw Error('Invoice not found.')
  const files = supportingDocuments === undefined ? undefined : validateSettlementSupportingDocuments(supportingDocuments, invoice.kind)
  if (date < invoice.date) throw Error('Payment date cannot precede the invoice date.')
  const lastReversal = b.entries.filter(e => e.reversalOf && b.settlements.some(s => s.invoiceId === invoiceId && s.entryId === e.reversalOf)).map(e => e.date).sort().at(-1)
  if (lastReversal && date < lastReversal) throw Error('Use a date on or after the latest payment reversal.')
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > outstanding(b, invoice)) throw Error('Payment must be positive and cannot exceed the outstanding balance.')
  if (!b.accounts.some(a => a.code === cash && a.cash)) throw Error('Select a cash or bank account.')
  const payable = invoice.kind === 'payable'
  const next = post(b, { date, reference, description: `${payable ? 'Payment to' : 'Receipt from'} ${invoice.party} · ${invoice.reference}`, source: payable ? 'payment' : 'receipt', lines: payable ? [{ account: '2000', debit: amount, credit: 0 }, { account: cash, debit: 0, credit: amount }] : [{ account: cash, debit: amount, credit: 0 }, { account: '1100', debit: 0, credit: amount }] })
  return { ...next, settlements: [...b.settlements, { id: crypto.randomUUID(), invoiceId, amount, date, entryId: next.entries.at(-1)!.id, ...(files === undefined ? {} : { supportingDocuments: files }) }] }
}
export function appendSettlementDocuments(b: Books, settlementId: string, documents: SettlementSupportingDocument[]): Books {
  const settlement = b.settlements.find(item => item.id === settlementId)
  if (!settlement) throw Error('Payment or receipt not found.')
  const invoice = b.invoices.find(item => item.id === settlement.invoiceId)
  if (!invoice) throw Error('The original bill or invoice could not be found.')
  if (!Array.isArray(documents) || !documents.length) throw Error('Select at least one new supporting document.')
  const files = validateSettlementSupportingDocuments([...(settlement.supportingDocuments || []), ...documents], invoice.kind)
  return { ...b, settlements: b.settlements.map(item => item.id === settlementId ? { ...item, supportingDocuments: files } : item) }
}
export function reverse(b: Books, entryId: string, date: string): Books {
  const entry = b.entries.find(e => e.id === entryId)
  if (!entry || entry.source === 'reversal' || isReversed(b, entryId)) throw Error('This entry has already been reversed or is itself a reversal.')
  if (date < entry.date) throw Error('Reversal cannot precede the original entry.')
  const invoice = b.invoices.find(i => i.entryId === entryId)
  if (invoice) {
    const payments = b.settlements.filter(s => s.invoiceId === invoice.id)
    if (payments.some(s => !isReversed(b, s.entryId, date))) throw Error('Reverse all payments for this bill or invoice first, using a date no later than this reversal.')
  }
  const baseReference = `REV-${entry.reference}`
  const usedReferences = new Set(b.entries.map(e => e.reference.trim().toLowerCase()))
  let reference = baseReference.slice(0, 200).trimEnd()
  for (let number = 2; usedReferences.has(reference.toLowerCase()); number++) {
    const suffix = `-${number}`
    reference = `${baseReference.slice(0, 200 - suffix.length).trimEnd()}${suffix}`
  }
  const description = `Reversal of ${entry.reference}: ${entry.description}`.slice(0, 500)
  return post(b, { date, reference, description, source: 'reversal', reversalOf: entryId, lines: entry.lines.map(l => ({ account: l.account, debit: l.credit, credit: l.debit })) })
}
export function addAccount(b: Books, account: Account): Books {
  if (!/^\d{4,8}$/.test(account.code) || b.accounts.some(a => a.code === account.code)) throw Error('Use a unique account code of 4–8 digits.')
  text(account.name, 'Account name')
  if (!['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'].includes(account.type) || (account.cash && account.type !== 'Asset')) throw Error('Cash and bank accounts must be assets.')
  return { ...b, accounts: [...b.accounts, { ...account, name: account.name.trim() }].sort((a, c) => a.code.localeCompare(c.code)) }
}
export function closePeriod(b: Books, date: string): Books {
  if (!validDate(date) || date > today() || (b.closedThrough && date <= b.closedThrough)) throw Error('Choose a date after the current lock date and no later than today.')
  return { ...b, closedThrough: date }
}
export function balances(b: Books, from = '', to = '9999-12-31') {
  return b.accounts.map(a => {
    const lines = b.entries.filter(e => e.date >= from && e.date <= to).flatMap(e => e.lines).filter(l => l.account === a.code)
    const debit = lines.reduce((s, l) => s + l.debit, 0), credit = lines.reduce((s, l) => s + l.credit, 0)
    return { ...a, debit, credit, net: debit - credit }
  })
}
export function parseBooks(raw: string): Books {
  const b: Books = JSON.parse(raw)
  if (!b || b.version !== 1 || !Array.isArray(b.accounts) || !Array.isArray(b.entries) || !Array.isArray(b.invoices) || !Array.isArray(b.settlements) || typeof b.closedThrough !== 'string' || (b.closedThrough && !validDate(b.closedThrough))) throw Error('Invalid UBB accounting backup.')
  let chart = emptyBooks()
  chart.accounts = []
  for (const a of b.accounts) { if (typeof a.cash !== 'boolean') throw Error('Invalid account.'); chart = addAccount(chart, a) }
  for (const a of initialAccounts) if (!b.accounts.some(x => x.code === a.code && x.type === a.type && x.cash === a.cash)) throw Error('Required control accounts are missing or changed.')
  const unique = (ids: string[]) => { if (ids.some(id => typeof id !== 'string' || !id) || new Set(ids).size !== ids.length) throw Error('Duplicate or missing record identifiers.') }
  unique(b.entries.map(e => e.id)); unique(b.entries.map(e => e.reference.toLowerCase())); unique(b.invoices.map(i => i.id)); unique(b.settlements.map(s => s.id))
  for (const e of b.entries) {
    postingDate(emptyBooks(), e.date); text(e.reference, 'Reference'); text(e.description, 'Description', 500); validLines(b, e.lines)
    if (!['journal', 'payable', 'receivable', 'payment', 'receipt', 'reversal'].includes(e.source) || !Number.isFinite(Date.parse(e.createdAt))) throw Error('Invalid journal metadata.')
    if (e.source !== 'reversal' && e.reversalOf !== undefined) throw Error('Only reversal entries can link to an original entry.')
    if (e.source === 'journal' && e.lines.some(l => ['1100', '2000'].includes(l.account))) throw Error('Manual control-account postings are not supported.')
    if (e.source === 'reversal') {
      const original = b.entries.find(x => x.id === e.reversalOf && x.source !== 'reversal')
      if (!original || e.date < original.date || b.entries.filter(x => x.reversalOf === original.id).length !== 1 || JSON.stringify(e.lines) !== JSON.stringify(original.lines.map(l => ({ account: l.account, debit: l.credit, credit: l.debit })))) throw Error('Invalid reversal.')
      reverse({ ...b, closedThrough: '', entries: b.entries.filter(x => x.id !== e.id) }, original.id, e.date)
    }
  }
  for (const i of b.invoices) {
    if (!['payable', 'receivable'].includes(i.kind)) throw Error('Invalid invoice type.')
    const check = addInvoice({ ...emptyBooks(), accounts: b.accounts }, i)
    if (i.taxTreatment && (i.netAmount !== check.invoices[0].netAmount || i.vatAmount !== check.invoices[0].vatAmount)) throw Error('Invoice tax breakdown does not match its total.')
    const e = b.entries.find(e => e.id === i.entryId)
    if (!e || e.source !== i.kind || e.date !== i.date || JSON.stringify(e.lines) !== JSON.stringify(check.entries[0].lines) || outstanding(b, i) < 0) throw Error('Invoice and ledger do not match.')
  }
  for (const s of b.settlements) {
    const i = b.invoices.find(i => i.id === s.invoiceId), e = b.entries.find(e => e.id === s.entryId)
    const cash = e?.lines.find(l => b.accounts.some(a => a.code === l.account && a.cash))?.account
    if (!i || !e || !cash || s.date !== e.date) throw Error('Invalid payment link.')
    const check = settle({ ...b, closedThrough: '', entries: [], settlements: [] }, i.id, s.amount, s.date, cash, e.reference, s.supportingDocuments).entries[0]
    if (e.source !== check.source || JSON.stringify(e.lines) !== JSON.stringify(check.lines)) throw Error('Payment and ledger do not match.')
  }
  for (const e of b.entries) {
    if (['payable', 'receivable'].includes(e.source) && b.invoices.filter(i => i.entryId === e.id).length !== 1) throw Error('Unlinked invoice entry.')
    if (['payment', 'receipt'].includes(e.source) && b.settlements.filter(s => s.entryId === e.id).length !== 1) throw Error('Unlinked settlement entry.')
  }
  return b
}
