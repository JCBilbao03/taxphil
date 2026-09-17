import { useContext, useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { BookOpen, Download, Plus, Search, ShieldCheck, X } from 'lucide-react'
import { useAuthUser } from '@/store/useAuthStore'
import { useAccounting } from '@/hooks/useAccounting'
import { addAccount, addInvoice, balances, cents, closePeriod, money, isReversed, outstanding, parseBooks, post, reverse, settle, today, type Account, type AccountType, type Books, type Entry, type Invoice, type Settlement } from '@/lib/accounting'
import { Button } from '@/components/ui/button'

import { accountingModules as modules } from '@/components/accounting/accounting-modules'
import { AccountingOverview } from '@/components/accounting/AccountingOverview'
import { CompanyPanels } from '@/components/accounting/CompanyPanels'
import { TaxWorkspace } from '@/components/accounting/TaxWorkspace'
import { ComplianceWorkspace } from '@/components/accounting/ComplianceWorkspace'
import { PartyDirectory } from '@/components/accounting/PartyDirectory'
import { PayrollWorkspace } from '@/components/accounting/PayrollWorkspace'
import { AssetWorkspace } from '@/components/accounting/AssetWorkspace'
import { PaymentWorkspace } from '@/components/accounting/PaymentWorkspace'
import { BankWorkspace } from '@/components/accounting/BankWorkspace'
import { useCompany } from '@/hooks/useCompany'
import { calculateInvoiceTax } from '@/lib/ph-compliance'
import { exportPersonalBooks } from '@/lib/legacy-accounting'
import { useCompanyParties } from '@/hooks/useCompanyParties'
import { partyInvoiceSnapshot } from '@/lib/parties'
import { CompanyRecordsPreview } from '@/hooks/useCompanyRecords'
import { SupplierBillPdfImport, SupplierBillPdfLink, saveSupplierBillPdf } from '@/components/accounting/SupplierBillPdf'
import { planSupplierBillImport } from '@/lib/supplier-bill-import'
import type { SupplierBillExtraction } from '@/lib/supplier-bill-extraction'
import { SettlementEvidence, SettlementEvidenceList, saveSettlementEvidence, type PendingSettlementEvidence } from '@/components/accounting/SettlementEvidence'

const inputClass = 'w-full rounded-md border border-input bg-card px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring'
const panelClass = 'rounded-lg border border-border bg-card p-5 shadow-[0_1px_2px_rgb(16_45_80_/_0.02)]'
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="grid gap-1.5 text-sm font-medium">{label}{children}</label> }
function Empty({ title, children }: { title: string; children: ReactNode }) { return <div className="px-5 py-14 text-center"><BookOpen className="mx-auto mb-3 size-8 text-muted-foreground" /><h3 className="font-semibold">{title}</h3><p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{children}</p></div> }
function Table({ headers, rows }: { headers: string[]; rows: ReactNode[][] }) {
  return <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b bg-muted/50 text-xs text-muted-foreground"><tr>{headers.map(h => <th key={h} className="whitespace-nowrap px-4 py-3 font-medium">{h}</th>)}</tr></thead><tbody className="divide-y divide-border">{rows.map((row, index) => <tr key={index} className="hover:bg-muted/30">{row.map((cell, col) => <td key={col} className="px-4 py-3 align-top tabular-nums">{cell}</td>)}</tr>)}</tbody></table></div>
}
function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const link = document.createElement('a'); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
}
function csv(name: string, rows: (string | number)[][]) {
  download(name, '\uFEFF' + rows.map(row => row.map(value => { const s = String(value); return `"${(/^[=+@\-\t\r]/.test(s) ? "'" : '') + s.replaceAll('"', '""')}"` }).join(',')).join('\r\n'), 'text/csv;charset=utf-8')
}
function Modal({ title, onClose, children, busy = false }: { title: string; onClose: () => void; children: ReactNode; busy?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => { ref.current?.showModal(); const dialog = ref.current; return () => dialog?.close() }, [])
  return <dialog ref={ref} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); event.stopPropagation(); if (!busy) onClose() }} className="ubb-modal m-auto max-h-[90svh] w-[min(94vw,780px)] overflow-auto rounded-2xl border border-border bg-card p-5 text-foreground shadow-xl backdrop:bg-black/40 sm:p-7"><div className="mb-5 flex items-center justify-between gap-4"><h2 id={titleId} className="text-xl font-semibold">{title}</h2><Button variant="ghost" size="icon" onClick={onClose} disabled={busy} aria-label="Close dialog"><X className="size-4" /></Button></div>{children}</dialog>
}
function AccountSelect({ accounts, value, onChange, label = 'Account' }: { accounts: Account[]; value: string; onChange: (v: string) => void; label?: string }) {
  return <select aria-label={label} className={inputClass} required value={value} onChange={e => onChange(e.target.value)}><option value="">Choose account</option>{accounts.map(a => <option key={a.code} value={a.code}>{a.code} · {a.name}</option>)}</select>
}
type Edit = 'journal' | 'payable' | 'receivable' | 'account' | { invoice: Invoice } | { entry: Entry }
export function AccountingPage() {
  const user = useAuthUser()
  return user ? <AccountingWorkspace key={user.uid} uid={user.uid} /> : null
}
export function AccountingWorkspace({ uid }: { uid: string }) {
  const company = useCompany()
  const canWrite = !company || (!!company.membership?.active && company.membership.role !== 'viewer')
  const canManage = !company || ['admin', 'manager'].includes(company.membership?.role || '')
  const { module = 'overview' } = useParams()
  const [queryParams, setQueryParams] = useSearchParams()
  const section = modules.find(m => m[0] === module)?.[0] ?? 'overview'
  const { books, ready, error: storageError, save, rawBackup } = useAccounting(uid)
  const [edit, setEdit] = useState<Edit | null>(null)
  const [entryBusy, setEntryBusy] = useState(false)
  const [notice, setNotice] = useState(''), [error, setError] = useState('')
  useEffect(() => { setNotice(''); setError('') }, [section])
  const [from, setFrom] = useState(''), [to, setTo] = useState(today())
  const [account, setAccount] = useState('1000')
  const [selectPayment, setSelectPayment] = useState<Invoice['kind'] | null>(null)
  const [preset, setPreset] = useState('all')
  const search = queryParams.get('q') || ''
  const statusFilter = queryParams.get('status') || ''
  const setSearch = (value: string) => { const next = new URLSearchParams(queryParams); if (value) next.set('q', value); else next.delete('q'); setQueryParams(next, { replace: true }) }
  function applyPeriod(value: string) {
    setPreset(value)
    const now = today(), monthStart = `${now.slice(0, 7)}-01`
    if (value === 'all') { setFrom(''); setTo(now) }
    if (value === 'month') { setFrom(monthStart); setTo(now) }
    if (value === 'year') { setFrom(`${now.slice(0, 4)}-01-01`); setTo(now) }
    if (value === 'last-month') { const end = previousDay(monthStart); setFrom(`${end.slice(0, 7)}-01`); setTo(end) }
  }
  const [lockDate, setLockDate] = useState('')
  const upload = useRef<HTMLInputElement>(null)
  const asOf = to || today()
  const usesDateRange = ['overview', 'journal', 'ledger', 'disbursements', 'receipts', 'reports'].includes(section)
  const rangeValid = !usesDateRange || !from || from <= asOf
  const entries = books.entries.filter(e => e.date >= from && e.date <= asOf).sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))
  const searched = entries.filter(e => `${e.reference} ${e.description}`.toLowerCase().includes(search.toLowerCase()))
  const balance = balances(books, '', asOf), period = balances(books, from, asOf)
  const total = (type: AccountType, rows = balance) => rows.filter(a => a.type === type).reduce((s, a) => s + a.net, 0)
  const profit = -total('Revenue', period) - total('Expense', period)
  const cumulativeProfit = -total('Revenue') - total('Expense')
  const invoices = books.invoices.filter(i => i.date <= asOf)
  async function change(fn: (b: Books) => Books, message: string, command?: Record<string, unknown>) {
    setError(''); setNotice('')
    try { const result = await save(fn, false, command); setNotice(result?.status === 'pending' ? 'Submitted for approval. The ledger will update after a different authorized reviewer approves it.' : message); setEdit(null) } catch (e) { setError(e instanceof Error ? e.message : 'Unable to save. Please check browser storage.'); throw e }
  }
  const name = (code: string) => books.accounts.find(a => a.code === code)?.name ?? code
  const entryRows = (list: Entry[]) => list.map(e => [e.date, <div key="reference"><span className="font-medium">{e.reference}</span><p className="text-xs text-muted-foreground">{e.source}</p></div>, <details key="details"><summary className="cursor-pointer">{e.description}</summary><div className="mt-2 space-y-1 text-xs text-muted-foreground">{e.lines.map((l, n) => <p key={n}>{name(l.account)}: {l.debit ? `Dr ${money(l.debit)}` : `Cr ${money(l.credit)}`}</p>)}</div></details>, money(e.lines.reduce((s, l) => s + l.debit, 0)), canManage && e.source !== 'reversal' && !books.entries.some(x => x.reversalOf === e.id) ? <Button key="reverse" variant="outline" size="sm" disabled={!ready || !canWrite} onClick={() => setEdit({ entry: e })}>Reverse</Button> : <span key="status" className="text-xs text-muted-foreground">{books.entries.some(x => x.reversalOf === e.id) ? 'Reversed' : 'Posted'}</span>])
  const exportJournal = () => csv('ubb-journal.csv', [['Date', 'Reference', 'Description', 'Source', 'Account code', 'Account name', 'Debit PHP', 'Credit PHP'], ...searched.flatMap(e => e.lines.map(l => [e.date, e.reference, e.description, e.source, l.account, name(l.account), (l.debit / 100).toFixed(2), (l.credit / 100).toFixed(2)]))])
  const opening = balances(books, '', from ? previousDay(from) : '1899-12-31').find(a => a.code === account)?.net ?? 0
  const ledger = entries.flatMap(e => e.lines.filter(l => l.account === account).map(l => ({ entry: e, line: l }))).reduce((result, { entry: e, line: l }) => {
    const balance = result.balance + l.debit - l.credit
    return { balance, rows: [...result.rows, [e.date, e.reference, e.description, money(l.debit), money(l.credit), `${money(Math.abs(balance))} ${balance < 0 ? 'Cr' : 'Dr'}`]] }
  }, { balance: opening, rows: [] as string[][] })
  const running = ledger.balance, ledgerRows = ledger.rows
  const cashItems = entries.flatMap(e => e.lines.filter(l => books.accounts.some(a => a.code === l.account && a.cash) && (section === 'receipts' ? l.debit > 0 : l.credit > 0)).map(l => ({entry:e,line:l})))
  const cashRows = cashItems.map(({entry:e,line:l}) => [e.date, e.reference, name(l.account), e.description, money(section === 'receipts' ? l.debit : l.credit)])
  const cashTotal = entries.flatMap(e => e.lines).filter(l => books.accounts.some(a => a.code === l.account && a.cash)).reduce((s, l) => s + (section === 'receipts' ? l.debit : l.credit), 0)
  const invoiceList = invoices.filter(i => i.kind === section && `${i.party} ${i.reference}`.toLowerCase().includes(search.toLowerCase()) && (!statusFilter || (outstanding(books, i, asOf) > 0 && (statusFilter === 'overdue' ? i.due < asOf : statusFilter === 'due-soon' ? daysBetween(asOf, i.due) >= 0 && daysBetween(asOf, i.due) <= 6 : true)))).sort((a, b) => a.due.localeCompare(b.due))
  const heading = modules.find(m => m[0] === section)![1]
  return <div className="ubb-workspace">
    {!['library','compliance-tracker'].includes(section) && <div className="ubb-page-heading">
      <div><p className="ubb-eyebrow">{section === 'overview' ? 'Your business at a glance' : 'Your accounting workspace'}</p><h1>{section === 'overview' ? 'Accounting overview' : heading}</h1><p className="ubb-page-description">{modules.find(m => m[0] === section)![3]}</p></div>
      <div className="flex shrink-0 flex-wrap items-center gap-4">
        <span className="ubb-book-status"><ShieldCheck size={15} />{storageError ? 'Books need attention' : !ready ? 'Loading books…' : books.closedThrough ? `Locked through ${books.closedThrough}` : 'Books open · PHP'}</span>
        {canWrite && ['journal', 'ledger', 'payable', 'receivable', 'disbursements', 'receipts', 'accounts', 'reports', 'settings'].includes(section) && <Button disabled={!ready || !canWrite} onClick={() => setEdit('journal')}><Plus size={15} />New journal entry</Button>}
      </div>
    </div>}
    {(storageError || error) && <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{storageError || error}</div>}
    {notice && <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</div>}
    {['overview', 'journal', 'ledger', 'payable', 'receivable', 'disbursements', 'receipts', 'reports'].includes(section) && <div className="ubb-date-toolbar"><div className="ubb-date-fields"><Field label="Reporting period"><select aria-label="Reporting period" className={inputClass} value={preset} onChange={e => applyPeriod(e.target.value)}><option value="all">All activity</option><option value="month">This month</option><option value="last-month">Last month</option><option value="year">This year</option><option value="custom">Custom dates</option></select></Field>{usesDateRange && <Field label="From date (optional)"><input type="date" className={inputClass} value={from} max={asOf} onChange={e => { setFrom(e.target.value); setPreset('custom') }} /></Field>}<Field label={['payable', 'receivable'].includes(section) ? 'As of date' : 'Through date'}><input type="date" className={inputClass} value={asOf} onChange={e => { setTo(e.target.value); setPreset('custom') }} /></Field></div><p>{['payable', 'receivable'].includes(section) ? 'Balances include payments recorded through the selected date.' : 'Activity follows your selected dates. Account balances include all earlier postings.'}</p></div>}
    {!rangeValid ? <p role="alert" className="text-destructive">From date must not be after the through date.</p> : <>
    {['company', 'team', 'compliance', 'approvals', 'audit'].includes(section) && <CompanyPanels section={section} />}
    {company && (section === 'tax-mapping' || section === 'tax-details' || section === 'tax-returns') && <TaxWorkspace section={section} />}
    {company && (section === 'library' || section === 'compliance-tracker') && <ComplianceWorkspace section={section} />}
    {company && (section === 'vendors' || section === 'customers') && <PartyDirectory kind={section === 'vendors' ? 'vendor' : 'customer'} />}
    {company && (section === 'employees' || section === 'payroll') && <PayrollWorkspace section={section} />}
    {company && section === 'assets' && <AssetWorkspace />}
    {company && section === 'bank-reconciliation' && <BankWorkspace />}
    {company && section === 'payments' && <PaymentWorkspace />}
    {company && ['receivable','payable'].includes(section) && <div className="company-notice">Record existing invoices and bills using their original references. These records do not issue BIR-registered invoices or submit tax returns. VAT amounts require supporting documents and accountant review.</div>}
    {section === 'overview' && <AccountingOverview books={books} from={from} asOf={asOf} ready={ready} canWrite={canWrite} canSettle={canManage} onCreate={setEdit} onRecord={setSelectPayment} />}
    {statusFilter && ['payable', 'receivable'].includes(section) && <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/20 bg-accent px-4 py-3 text-sm"><span>{statusFilter === 'overdue' ? 'Showing unpaid overdue documents' : statusFilter === 'due-soon' ? 'Showing unpaid documents due in the next 7 days' : 'Filtered documents'}</span><Button variant="ghost" onClick={() => { const next = new URLSearchParams(queryParams); next.delete('status'); setQueryParams(next) }}>Show all</Button></div>}
    {section === 'journal' && <section className="overflow-hidden rounded-xl border border-border bg-card"><div className="flex flex-wrap items-center justify-between gap-3 p-5"><h2 className="font-semibold">Posted journal entries</h2><div className="flex flex-wrap gap-2"><label className="flex items-center gap-2"><Search className="size-4" /><input className={inputClass} aria-label="Search journal" placeholder="Search reference or description" value={search} onChange={e => setSearch(e.target.value)} /></label><Button variant="outline" onClick={exportJournal}><Download className="mr-2 size-4" />Export CSV</Button></div></div>{searched.length ? <Table headers={['Date', 'Reference', 'Details · expand to view lines', 'Total debit', 'Action']} rows={entryRows([...searched].reverse())} /> : <Empty title="No journal entries">Post a balanced journal, bill, invoice, or payment to see it here. Posted entries stay in the audit trail; use a reversal to correct a posted entry.</Empty>}</section>}
    {section === 'ledger' && <section className={panelClass}><div className="mb-5 flex flex-wrap items-end justify-between gap-3"><Field label="Ledger account"><AccountSelect accounts={books.accounts} value={account} onChange={setAccount} /></Field><Button variant="outline" onClick={() => csv(`ubb-ledger-${account}.csv`, [['From', from || 'Beginning', 'Through', asOf], ['Opening balance', money(opening)], ['Date', 'Reference', 'Description', 'Debit', 'Credit', 'Balance'], ...ledgerRows as string[][]])}>Export ledger</Button></div><div className="mb-4 flex justify-between rounded-lg bg-muted p-3 text-sm"><span>Opening balance: {money(Math.abs(opening))} {opening < 0 ? 'Cr' : 'Dr'}</span><span>Closing: {money(Math.abs(running))} {running < 0 ? 'Cr' : 'Dr'}</span></div>{ledgerRows.length ? <Table headers={['Date', 'Reference', 'Description', 'Debit', 'Credit', 'Running balance']} rows={ledgerRows} /> : <Empty title="No activity for this account">Choose another account or date range, or post your first journal entry.</Empty>}</section>}
    {(section === 'payable' || section === 'receivable') && <><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">{section === 'payable' ? 'Supplier bills' : 'Customer invoices'}</h2><p className="text-sm text-muted-foreground">Record totals in PHP. Partial payments are supported.</p></div><Button disabled={!ready || !canWrite} onClick={() => setEdit(section)}><Plus className="mr-2 size-4" />{section === 'payable' ? 'Add bill' : 'Add invoice'}</Button></div><div className="grid gap-3 sm:grid-cols-4">{[['Current', 0, 0], ['1–30 days overdue', 1, 30], ['31–60 days overdue', 31, 60], ['61+ days overdue', 61, Infinity]].map(([label, min, max]) => <div key={label} className={panelClass}><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-xl font-semibold">{money(invoices.filter(i => i.kind === section && Math.max(0, daysBetween(i.due, asOf)) >= Number(min) && Math.max(0, daysBetween(i.due, asOf)) <= Number(max)).reduce((s, i) => s + outstanding(books, i, asOf), 0))}</p></div>)}</div><div className="flex flex-wrap gap-3"><input aria-label="Search invoices" className={`${inputClass} max-w-sm`} placeholder="Search customer, supplier, or reference" value={search} onChange={e => setSearch(e.target.value)} /><Button variant="outline" onClick={() => csv(`ubb-${section}.csv`, [['As of', asOf], ['Party', 'Reference', 'Date', 'Due', 'Tax treatment', 'Net PHP', 'VAT PHP', 'Total PHP', 'Outstanding PHP'], ...invoiceList.map(i => [i.party, i.reference, i.date, i.due, i.taxTreatment || 'Unclassified', (i.netAmount ?? i.amount) / 100, (i.vatAmount ?? 0) / 100, i.amount / 100, outstanding(books, i, asOf) / 100])])}>Export CSV</Button></div><section className="overflow-hidden rounded-xl border border-border bg-card">{invoiceList.length ? <Table headers={['Party / reference', 'Issued / due', 'Total', 'Outstanding', 'Status', 'Action']} rows={invoiceList.map(i => { const open = outstanding(books, i, asOf); return [<div key="party" className="font-medium">{i.party}<p className="text-xs font-normal text-muted-foreground">{i.reference}</p><SupplierBillPdfLink file={i.supplierBillPdf} /><SettlementHistory books={books} invoice={i} asOf={asOf} /></div>, <div key="date">{i.date}<p className="text-xs text-muted-foreground">Due {i.due}</p></div>, <div key="total">{money(i.amount)}<p className="text-xs text-muted-foreground">{i.taxTreatment || 'Unclassified'}{i.vatAmount ? ` · VAT ${money(i.vatAmount)}` : ''}</p></div>, money(open), <span key="status" className={`rounded-full px-2 py-1 text-xs ${!open ? 'bg-emerald-50 text-emerald-800' : i.due < asOf ? 'bg-amber-50 text-amber-800' : 'bg-muted text-muted-foreground'}`}>{isReversed(books, i.entryId, asOf) ? 'Voided' : !open ? 'Paid' : i.due < asOf ? 'Overdue' : open < i.amount ? 'Part-paid' : 'Open'}</span>, outstanding(books, i) > 0 ? <Button key="settle" variant="outline" size="sm" disabled={!ready || !canManage} onClick={() => setEdit({ invoice: i })}>{section === 'payable' ? 'Record payment' : 'Record receipt'}</Button> : <span key="settled" className="text-xs text-muted-foreground">{isReversed(books, i.entryId) ? 'Voided' : 'Settled'}</span>] })} /> : <Empty title={section === 'payable' ? 'No supplier bills yet' : 'No customer invoices yet'}>Add your first {section === 'payable' ? 'bill' : 'invoice'} to track due dates, outstanding balances, and payments.</Empty>}</section></>}
    {['disbursements', 'receipts'].includes(section) && <section className="overflow-hidden rounded-xl border border-border bg-card"><div className="flex flex-wrap justify-between gap-3 p-5"><div><h2 className="font-semibold">{heading}</h2><p className="mt-1 text-xs text-muted-foreground">Cash and bank {section === 'receipts' ? 'debits' : 'credits'} from all postings, including internal transfers.</p></div><Button variant="outline" onClick={() => csv(`ubb-${section}.csv`, [['Date', 'Reference', 'Cash / bank account', 'Description', 'Amount PHP'], ...cashRows, ['', '', '', 'Total', money(cashTotal)]])}>Export CSV</Button></div>{cashRows.length ? <Table headers={['Date', 'Reference', 'Cash / bank', 'Description', 'Amount', 'Supporting documents']} rows={[...cashRows.map((row,index) => [...row, <SettlementEvidenceList key={cashItems[index].entry.id} files={books.settlements.find(settlement => settlement.entryId === (cashItems[index].entry.reversalOf || cashItems[index].entry.id))?.supportingDocuments} />]), ['', '', '', 'Total', money(cashTotal), '']]} /> : <Empty title={`No cash ${section === 'receipts' ? 'receipts' : 'disbursements'}`}>Record a {section === 'receipts' ? 'customer receipt' : 'supplier payment'}, or post a journal using a cash or bank account.</Empty>}</section>}
    {section === 'accounts' && <section className="overflow-hidden rounded-xl border border-border bg-card"><div className="flex items-center justify-between p-5"><div><h2 className="font-semibold">Chart of accounts</h2><p className="mt-1 text-xs text-muted-foreground">Add accounts as needed. Control accounts keep receivables and payables reconciled.</p></div><Button disabled={!ready || !canManage} onClick={() => setEdit('account')}>Add account</Button></div><Table headers={['Code', 'Account name', 'Type', 'Use']} rows={books.accounts.map(a => [a.code, a.name, a.type, a.cash ? 'Cash books' : ['1100', '2000'].includes(a.code) ? 'Subledger control' : 'General posting'])} /></section>}
    {section === 'reports' && <><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">Financial reports</h2><p className="text-xs text-muted-foreground">Accrual basis · Calculated from posted entries · PHP</p></div><Button variant="outline" onClick={() => csv('ubb-financial-reports.csv', [['As of', asOf], ['Trial balance'], ['Code', 'Account', 'Debit PHP', 'Credit PHP'], ...balance.map(a => [a.code, a.name, Math.max(a.net, 0) / 100, Math.max(-a.net, 0) / 100]), ['Income statement from', from || 'Beginning', 'to', asOf], ['Revenue', -total('Revenue', period) / 100], ['Expenses', total('Expense', period) / 100], ['Net income', profit / 100], ['Balance sheet'], ['Assets', total('Asset') / 100], ['Liabilities', -total('Liability') / 100], ['Equity including earnings', (-total('Equity') + cumulativeProfit) / 100]])}>Export reports</Button></div><div className="grid gap-5 lg:grid-cols-2"><section className={panelClass}><h3 className="mb-4 font-semibold">Income statement</h3><p className="mb-3 text-xs text-muted-foreground">{from || 'Beginning'} through {asOf}</p><Table headers={['Account', 'Amount']} rows={[...period.filter(a => ['Revenue', 'Expense'].includes(a.type) && (a.debit || a.credit)).map(a => [`${a.name} · ${a.type}`, money(a.type === 'Revenue' ? -a.net : a.net)]), ['Total revenue', money(-total('Revenue', period))], ['Total expenses', money(total('Expense', period))], [<strong key="amount">Net income / (loss)</strong>, <strong key="amount">{money(profit)}</strong>]]} /></section><section className={panelClass}><h3 className="mb-4 font-semibold">Balance sheet</h3><p className="mb-3 text-xs text-muted-foreground">As of {asOf}</p><Table headers={['Account / category', 'Amount']} rows={[...balance.filter(a => ['Asset', 'Liability', 'Equity'].includes(a.type) && a.net).map(a => [a.name, money(a.type === 'Asset' ? a.net : -a.net)]), ['Total assets', money(total('Asset'))], ['Total liabilities', money(-total('Liability'))], ['Equity before earnings', money(-total('Equity'))], ['Accumulated net earnings', money(cumulativeProfit)], [<strong key="amount">Liabilities + equity + earnings</strong>, <strong key="amount">{money(-total('Liability') - total('Equity') + cumulativeProfit)}</strong>]]} /></section></div><section className="overflow-hidden rounded-xl border border-border bg-card"><h3 className="p-5 font-semibold">Trial balance <span className="text-sm font-normal text-muted-foreground">· As of {asOf}</span></h3><Table headers={['Code', 'Account', 'Debit balance', 'Credit balance']} rows={[...balance.filter(a => a.debit || a.credit).map(a => [a.code, a.name, money(Math.max(a.net, 0)), money(Math.max(-a.net, 0))]), ['', <strong key="amount">Total</strong>, <strong key="amount">{money(balance.reduce((s, a) => s + Math.max(a.net, 0), 0))}</strong>, <strong key="amount">{money(balance.reduce((s, a) => s + Math.max(-a.net, 0), 0))}</strong>]]} /></section></>}
    {section === 'settings' && <div className="grid items-start gap-5 lg:grid-cols-2"><section className={panelClass}><h2 className="font-semibold">Backup & restore</h2><p className="my-3 text-sm leading-relaxed text-muted-foreground">{company ? 'These books are shared by authorized members of your company. Download a JSON snapshot for safekeeping. Company books cannot be replaced with a browser backup; any migration requires a reviewed process.' : 'These isolated preview books are stored in this browser. Export a backup before clearing browser data.'}</p><div className="flex flex-wrap gap-2"><Button onClick={() => download(`ubb-accounting-${today()}.json`, rawBackup(), 'application/json')}>{storageError ? 'Export recovery file' : 'Download backup'}</Button>{!company && <Button variant="outline" onClick={() => upload.current?.click()}>Restore backup</Button>}{company && <Button variant="outline" onClick={() => { try { exportPersonalBooks(uid); setError(''); setNotice('Previous personal books exported. Your company books are unchanged.') } catch (cause) { setError(cause instanceof Error ? cause.message : 'Export failed.') } }}>Export previous personal books</Button>}<input ref={upload} type="file" accept=".json,application/json" className="hidden" aria-label="Restore accounting backup" onChange={async e => { const file = e.target.files?.[0]; e.target.value = ''; if (!file) return; try { if (file.size > 10e6) throw Error('Backup exceeds 10 MB.'); const restored = parseBooks(await file.text()); if (!window.confirm(`Replace this account’s local books with ${restored.entries.length} journal entries from this backup? Download your current backup first.`)) return; await save(() => restored, true); setError(''); setNotice('Backup restored successfully.') } catch (err) { setError(err instanceof Error ? err.message : 'Restore failed.') } }} /></div></section><section className={panelClass}><h2 className="font-semibold">Close an accounting period</h2><p className="my-3 text-sm text-muted-foreground">Lock posting dates through a reviewed period. New journals and payments must use a later date. This lock cannot be moved backward here.</p><form onSubmit={e => { e.preventDefault(); if (window.confirm(`Close the books through ${lockDate}? This prevents backdated postings.`)) void change(b => closePeriod(b, lockDate), 'Accounting period locked.', { type: 'closePeriod', date: lockDate }).catch(() => {}) }} className="space-y-3"><Field label="Close through"><input required type="date" max={today()} className={inputClass} value={lockDate} onChange={e => setLockDate(e.target.value)} /></Field><Button type="submit" disabled={!ready || !canManage} variant="outline">Lock period</Button></form></section><section className={`${panelClass} lg:col-span-2`}><h2 className="font-semibold">How postings work</h2><p className="mt-3 text-sm leading-relaxed text-muted-foreground">Journal entries must balance. Supplier bills debit an expense or asset and credit accounts payable; customer invoices debit accounts receivable and credit revenue. Payments settle those balances against cash or bank. Record opening cash, assets, liabilities, and capital through Journal Entry; enter opening unpaid bills and invoices in the respective subledgers using the appropriate accounts. Posted journals, invoices, bills, and payments can be reversed from Journal Entry with a dated entry, preserving the original record.</p><p className="mt-3 text-sm text-muted-foreground">Company transactions are validated by the accounting service, with role-based approval and an audit trail. VAT-tagged documents separate net value and VAT. This module does not submit BIR or SEC filings, issue registered invoices, determine withholding rates, or transfer money. Review tax treatment with your accountant. To correct a document, reverse settlements first, reverse the original posting, then record a replacement.</p></section></div>}
    </>}
    {selectPayment && <Modal title={selectPayment === 'payable' ? 'Choose a supplier bill' : 'Choose a customer invoice'} onClose={() => setSelectPayment(null)}>
      <p className="mb-5 text-sm text-muted-foreground">Select the document for this {selectPayment === 'payable' ? 'payment' : 'receipt'}. This records money already {selectPayment === 'payable' ? 'paid' : 'received'}.</p>
      <div className="max-h-[50svh] space-y-2 overflow-y-auto">{books.invoices.filter(i => i.kind === selectPayment && outstanding(books, i) > 0).map(i => <button type="button" key={i.id} className="flex w-full items-center justify-between gap-4 rounded-lg border border-border p-4 text-left hover:bg-muted" onClick={() => { setSelectPayment(null); setEdit({ invoice: i }) }}><span><span className="block text-sm font-semibold">{i.party}</span><span className="mt-1 block text-xs text-muted-foreground">{i.reference} · Due {i.due}</span></span><span className="whitespace-nowrap text-sm font-semibold text-primary">{money(outstanding(books, i))}</span></button>)}</div>
      {!books.invoices.some(i => i.kind === selectPayment && outstanding(books, i) > 0) && <Empty title={selectPayment === 'payable' ? 'No unpaid supplier bills' : 'No unpaid customer invoices'}>Add a {selectPayment === 'payable' ? 'bill' : 'customer invoice'} first, then record its {selectPayment === 'payable' ? 'payment' : 'receipt'}.</Empty>}
      <div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={() => setSelectPayment(null)}>Cancel</Button><Button disabled={!ready || !canWrite} onClick={() => { const kind = selectPayment; setSelectPayment(null); setEdit(kind) }}><Plus size={15} />{selectPayment === 'payable' ? 'Add bill' : 'Add invoice'}</Button></div>
    </Modal>}
    {edit && <Modal busy={entryBusy} title={typeof edit === 'object' ? 'invoice' in edit ? (edit.invoice.kind === 'payable' ? 'Record supplier payment' : 'Record customer receipt') : 'Reverse journal entry' : edit === 'journal' ? 'New journal entry' : edit === 'account' ? 'Add account' : edit === 'payable' ? 'Add supplier bill' : 'Add customer invoice'} onClose={() => setEdit(null)}><EntryForm books={books} edit={edit} onBusy={setEntryBusy} onSave={change} onClose={() => setEdit(null)} /></Modal>}
  </div>
}
function previousDay(date: string) { const d = new Date(`${date}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10) }
function daysBetween(from: string, to: string) { return Math.floor((Date.parse(to) - Date.parse(from)) / 86400000) }

function SettlementHistory({ books, invoice, asOf = '9999-12-31' }: { books: Books; invoice: Invoice; asOf?: string }) {
  const company = useCompany()
  const [addingTo, setAddingTo] = useState<Settlement | null>(null), [addingBusy, setAddingBusy] = useState(false)
  const canAttach = !!company?.membership?.active && ['admin','manager'].includes(company.membership.role)
  const history = books.settlements.filter(settlement => settlement.invoiceId === invoice.id && settlement.date <= asOf).sort((a, b) => a.date.localeCompare(b.date))
  if (!history.length) return null
  return <><details className="mt-3 text-xs font-normal"><summary className="cursor-pointer text-primary">{invoice.kind === 'receivable' ? 'Receipt' : 'Payment'} history & documents ({history.length})</summary><div className="mt-3 space-y-3">{history.map(settlement => {
    const entry = books.entries.find(entry => entry.id === settlement.entryId)
    const cash = entry?.lines.find(line => books.accounts.some(account => account.code === line.account && account.cash))
    return <article key={settlement.id} className="min-w-60 rounded-lg border border-border bg-muted/30 p-3"><p className="font-medium">{entry?.reference || 'Reference unavailable'} · {money(settlement.amount)}</p><p className="mt-1 text-muted-foreground">{settlement.date} · {books.accounts.find(account => account.code === cash?.account)?.name || 'Cash / bank'}{isReversed(books, settlement.entryId, asOf) ? ' · Reversed' : ''}</p><SettlementEvidenceList files={settlement.supportingDocuments} />{!settlement.supportingDocuments?.length && <p className="mt-2 text-muted-foreground">No supporting documents attached.</p>}{canAttach && (settlement.supportingDocuments?.length || 0) < 10 && <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => setAddingTo(settlement)}>Add documents</Button>}</article>
  })}</div></details>{addingTo && <Modal title="Add supporting documents" busy={addingBusy} onClose={() => setAddingTo(null)}><AppendSettlementEvidence settlement={books.settlements.find(item => item.id === addingTo.id) || addingTo} invoice={invoice} onBusy={setAddingBusy} onDone={() => setAddingTo(null)} /></Modal>}</>
}

function AppendSettlementEvidence({ settlement, invoice, onBusy, onDone }: { settlement: Settlement; invoice: Invoice; onBusy: (busy: boolean) => void; onDone: () => void }) {
  const company = useCompany(), preview = useContext(CompanyRecordsPreview)
  const [files,setFiles] = useState<PendingSettlementEvidence[]>([]), [busy,setBusy] = useState(false), [validating,setValidating] = useState(false), [error,setError] = useState('')
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; onBusy(false) } }, [onBusy])
  const existingCount = settlement.supportingDocuments?.length || 0
  async function submit(event: FormEvent) {
    event.preventDefault(); setError('')
    if (!company?.membership?.companyId || validating || !files.length) return
    setBusy(true); onBusy(true)
    try {
      if (existingCount + files.length > 10) throw Error('A receipt or payment can hold up to 10 supporting documents.')
      const supportingDocuments = await saveSettlementEvidence(files,company.membership.companyId,!!preview)
      if (!mounted.current) return
      await company.command({type:'attachSettlementDocuments',input:{settlementId:settlement.id,supportingDocuments}})
      onDone()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not add the documents.'); setBusy(false); onBusy(false) }
  }
  return <form onSubmit={submit}><fieldset disabled={busy} className="min-w-0 space-y-4"><p className="text-sm text-muted-foreground">{invoice.party} · {invoice.reference} · {invoice.kind === 'receivable' ? 'Receipt' : 'Payment'} dated {settlement.date} for {money(settlement.amount)}. Adding evidence keeps the original accounting entry unchanged.</p><SettlementEvidence value={files} onChange={setFiles} invoiceKind={invoice.kind} existingCount={existingCount} onValidating={setValidating} disabled={busy} />{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={busy} onClick={onDone}>Cancel</Button><Button type="submit" disabled={busy || validating || !files.length || existingCount + files.length > 10}>{busy ? 'Saving documents…' : 'Save documents'}</Button></div></fieldset></form>
}

function EntryForm({ books, edit, onSave, onClose, onBusy }: { books: Books; edit: Edit; onBusy: (busy: boolean) => void; onSave: (fn: (b: Books) => Books, message: string, command?: Record<string, unknown>) => Promise<void>; onClose: () => void }) {
  const company = useCompany()
  const { parties, loading: partiesLoading, error: partiesError } = useCompanyParties(edit === 'payable' ? 'vendor' : 'customer', edit === 'payable' || edit === 'receivable')
  const [partyId, setPartyId] = useState('')
  const chosenParty = parties.find((item) => item.id === partyId)
  const [taxTreatment, setTaxTreatment] = useState<NonNullable<Invoice['taxTreatment']>>(company?.company?.profile.vatStatus === 'vat' ? 'VAT12' : 'NON_VAT')
  const [partyTin, setPartyTin] = useState(''), [partyAddress, setPartyAddress] = useState(''), [documentDescription, setDocumentDescription] = useState('')
  const invoice = typeof edit === 'object' && 'invoice' in edit ? edit.invoice : null
  const reversal = typeof edit === 'object' && 'entry' in edit ? edit.entry : null
  const [date, setDate] = useState(today()), [due, setDue] = useState(today())
  const [reference, setReference] = useState(''), [description, setDescription] = useState(''), [party, setParty] = useState('')
  const [amount, setAmount] = useState(invoice ? (outstanding(books, invoice) / 100).toFixed(2) : '')
  const [account, setAccount] = useState(invoice ? '1010' : edit === 'payable' ? '5900' : '4100')
  const [code, setCode] = useState(''), [accountName, setAccountName] = useState(''), [type, setType] = useState<AccountType>('Asset'), [cash, setCash] = useState(false)
  const [lines, setLines] = useState([{ account: '1000', debit: '', credit: '' }, { account: '3000', debit: '', credit: '' }])
  const [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const preview = useContext(CompanyRecordsPreview)
  const [settlementDocuments, setSettlementDocuments] = useState<PendingSettlementEvidence[]>([]), [documentsValidating, setDocumentsValidating] = useState(false)
  const [pdfFile, setPdfFile] = useState<File | null>(null), [pdfReading, setPdfReading] = useState(false)
  const [pdfReviewed, setPdfReviewed] = useState(false), [pdfExtraction, setPdfExtraction] = useState<SupplierBillExtraction | null>(null)
  const pdfSaved = useRef<Invoice['supplierBillPdf']>(undefined)
  const mounted = useRef(true), liveParty = useRef(chosenParty)
  useEffect(() => { liveParty.current = chosenParty }, [chosenParty])
  useEffect(() => { setPdfReviewed(false) }, [chosenParty?.registeredName, chosenParty?.tin, chosenParty?.address, chosenParty?.active])
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const manualFields = useRef(new Set<string>())
  const touch = (field: string) => { manualFields.current.add(field); setPdfReviewed(false) }
  function acceptPdf(file: File | null) {
    setPdfFile(file); pdfSaved.current = undefined; setPdfReviewed(false); setPdfExtraction(null)
    if (file) {
      if (!manualFields.current.has('account')) setAccount('')
      const setters = { date: setDate, due: setDue, reference: setReference, amount: setAmount, documentDescription: setDocumentDescription, partyId: setPartyId }
      for (const [key, setter] of Object.entries(setters)) if (!manualFields.current.has(key)) setter('')
    }
  }
  function applyPdf(extraction: SupplierBillExtraction) {
    setPdfExtraction(extraction); setPdfReviewed(false)
    const plan = planSupplierBillImport(extraction, parties, manualFields.current)
    const setters = { date: setDate, due: setDue, reference: setReference, amount: setAmount, documentDescription: setDocumentDescription, partyId: setPartyId }
    for (const [key, value] of Object.entries(plan.changes)) setters[key as keyof typeof setters](value)
    return plan.notes
  }
  const debit = lines.reduce((s, l) => s + Math.round((Number(l.debit) || 0) * 100), 0), credit = lines.reduce((s, l) => s + Math.round((Number(l.credit) || 0) * 100), 0)
  let taxPreview: ReturnType<typeof calculateInvoiceTax> | null = null
  try { taxPreview = calculateInvoiceTax(cents(amount), taxTreatment, true) } catch { /* Incomplete input has no calculated preview. */ }
  useEffect(() => () => onBusy(false), [onBusy])
  const updateLine = (index: number, key: string, value: string) => setLines(lines.map((l, i) => i === index ? { ...l, [key]: value } : l))
  async function submit(e: FormEvent) {
    e.preventDefault(); setError(''); setBusy(true); onBusy(true)
    try {
      if (edit === 'account') {
        const input = { code, name: accountName, type, cash }
        await onSave(b => addAccount(b, input), 'Account added.', { type: 'addAccount', input })
      } else if (invoice) {
        if (documentsValidating) throw Error('Wait for the supporting files to finish checking.')
        const validatedAmount = cents(amount)
        settle(books, invoice.id, validatedAmount, date, account, reference)
        const supportingDocuments = settlementDocuments.length && company?.membership?.companyId ? await saveSettlementEvidence(settlementDocuments, company.membership.companyId, !!preview) : []
        if (!mounted.current) return
        const input = { invoiceId: invoice.id, amount: validatedAmount, date, cash: account, reference, ...(supportingDocuments.length ? { supportingDocuments } : {}) }
        await onSave(b => settle(b, input.invoiceId, input.amount, date, account, reference, supportingDocuments), `${invoice.kind === 'receivable' ? 'Receipt' : 'Payment'} recorded and cash book updated.`, { type: 'settle', input })
      } else if (reversal) {
        await onSave(b => reverse(b, reversal.id, date), 'Reversal posted. The original remains in the audit trail.', { type: 'reverse', input: { entryId: reversal.id, date } })
      } else if (edit === 'journal') {
        const input = { date, reference, description, source: 'journal' as const, lines: lines.map(l => ({ account: l.account, debit: l.debit && Number(l.debit) !== 0 ? cents(l.debit) : 0, credit: l.credit && Number(l.credit) !== 0 ? cents(l.credit) : 0 })) }
        await onSave(b => post(b, input), 'Balanced journal posted to the ledger.', { type: 'post', input })
      } else if (edit === 'payable' || edit === 'receivable') {
        if (company && !chosenParty) throw Error(`Select a saved ${edit === 'payable' ? 'vendor' : 'customer'} with a TIN first.`)
        const snapshot = company && chosenParty ? partyInvoiceSnapshot(chosenParty, edit) : { party, partyTin, partyAddress }
        if (pdfReading || (pdfFile && !pdfReviewed)) throw Error('Review the PDF and bill details before saving.')
        if (pdfFile && company?.membership?.companyId && !pdfSaved.current) {
          pdfSaved.current = await saveSupplierBillPdf(pdfFile, company.membership.companyId, !!preview)
        }
        if (!mounted.current) return
        if (company && chosenParty && (!liveParty.current || JSON.stringify(partyInvoiceSnapshot(liveParty.current, edit)) !== JSON.stringify(snapshot))) throw Error('The supplier or customer record changed while saving. Review the latest details and submit again.')
        const input = { kind: edit, date, due, reference, ...snapshot, amount: cents(amount), account, taxTreatment, description: documentDescription, ...(pdfSaved.current ? { supplierBillPdf: pdfSaved.current } : {}) }
        await onSave(b => addInvoice(b, input), `${edit === 'payable' ? 'Bill' : 'Invoice'} recorded and journal posted.`, { type: 'addInvoice', input })
      }
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to save this entry.'); setBusy(false); onBusy(false) }
  }
  const pdfVatMismatch = pdfExtraction?.fields.vatAmount !== undefined && taxPreview && Math.abs(Math.round(Number(pdfExtraction.fields.vatAmount) * 100) - taxPreview.vatCentavos) > 1
  return <form onSubmit={submit}><fieldset disabled={busy} className="min-w-0 space-y-5">
    {company && edit === 'payable' && <SupplierBillPdfImport disabled={busy || partiesLoading} onFile={acceptPdf} onExtract={applyPdf} onReading={setPdfReading} />}
    {invoice && <div className="rounded-lg bg-muted p-3 text-sm"><strong key="amount">{invoice.party} · {invoice.reference}</strong><p className="mt-1">TIN: {invoice.partyTin || 'Not recorded on this legacy document'}</p><p className="mt-1">Current outstanding: {money(outstanding(books, invoice))}</p><p className="mt-1 text-xs text-muted-foreground">Records money already {invoice.kind === 'receivable' ? 'received' : 'paid'}; no money is transferred.</p><SupplierBillPdfLink file={invoice.supplierBillPdf} /><SettlementHistory books={books} invoice={invoice} /></div>}
    {reversal && <p className="rounded-lg bg-muted p-3 text-sm">Reverse {reversal.reference} with equal and opposite lines. Both entries remain visible in the ledger.</p>}
    {edit === 'account' ? <div className="grid gap-4 sm:grid-cols-2"><Field label="Account code"><input className={inputClass} required pattern="[0-9]{4,8}" value={code} onChange={e => setCode(e.target.value)} /></Field><Field label="Account name"><input className={inputClass} required maxLength={200} value={accountName} onChange={e => setAccountName(e.target.value)} /></Field><Field label="Account type"><select className={inputClass} value={type} onChange={e => { setType(e.target.value as AccountType); setCash(false) }}>{['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'].map(t => <option key={t}>{t}</option>)}</select></Field><label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={type !== 'Asset'} checked={cash} onChange={e => setCash(e.target.checked)} />Cash or bank account</label></div> : <>
      <div className="grid gap-4 sm:grid-cols-2"><Field label="Posting date"><input className={inputClass} type="date" required value={date} onChange={e => { touch('date'); setDate(e.target.value) }} /></Field>{!reversal && <Field label={invoice ? (invoice.kind === 'receivable' ? 'Receipt reference' : 'Payment reference') : 'Reference number'}><input className={inputClass} required maxLength={150} placeholder={invoice ? 'e.g. bank transfer, deposit or check number' : edit === 'journal' ? 'e.g. JE-0001' : 'e.g. INV-0001'} value={reference} onChange={e => { touch('reference'); setReference(e.target.value) }} /></Field>}</div>
      {(edit === 'payable' || edit === 'receivable') && <div className="grid gap-4 sm:grid-cols-2"><Field label={edit === 'payable' ? 'Vendor' : 'Customer'}>{company ? <><select aria-label={edit === 'payable' ? 'Vendor' : 'Customer'} className={inputClass} required disabled={partiesLoading} value={partyId} onChange={e => { touch('partyId'); setPartyId(e.target.value) }}><option value="">{partiesLoading ? 'Loading directory…' : `Choose a saved ${edit === 'payable' ? 'vendor' : 'customer'}`}</option>{parties.filter(item => item.active).map(item => <option key={item.id} value={item.id}>{item.registeredName} · {item.tin}</option>)}</select><span className="text-xs font-normal text-muted-foreground">Set up the {edit === 'payable' ? 'vendor' : 'customer'} and TIN in the company directory first.</span>{partiesError && <span role="alert" className="text-xs text-destructive">{partiesError}</span>}</> : <input className={inputClass} required maxLength={200} value={party} onChange={e => setParty(e.target.value)} />}</Field><Field label="Due date"><input className={inputClass} type="date" required min={date} value={due} onChange={e => { touch('due'); setDue(e.target.value) }} /></Field></div>}
      {(edit === 'payable' || edit === 'receivable') && <div className="grid gap-4 sm:grid-cols-2"><Field label="Tax treatment"><select className={inputClass} value={taxTreatment} onChange={e => { touch('taxTreatment'); setTaxTreatment(e.target.value as NonNullable<Invoice['taxTreatment']>) }}>{(!company || company.company?.profile.vatStatus === 'vat') && <><option value="VAT12">12% VAT · total includes VAT</option><option value="VAT_ZERO">Zero-rated · supporting basis required</option><option value="VAT_EXEMPT">VAT-exempt · supporting basis required</option></>}{(!company || company.company?.profile.vatStatus !== 'vat' || edit === 'payable') && <option value="NON_VAT">Non-VAT · gross value</option>}</select></Field><Field label="Counterparty TIN"><input className={inputClass} maxLength={24} readOnly={!!company} required={!!company} value={company ? chosenParty?.tin || '' : partyTin} onChange={e => setPartyTin(e.target.value)} /></Field><Field label="Registered address"><input className={inputClass} maxLength={500} readOnly={!!company} required={!!company} value={company ? chosenParty?.address || '' : partyAddress} onChange={e => setPartyAddress(e.target.value)} /></Field><Field label="Goods or services description"><input className={inputClass} required={!!company} maxLength={500} value={documentDescription} onChange={e => { touch('documentDescription'); setDocumentDescription(e.target.value) }} /></Field><p className="sm:col-span-2 rounded-md bg-blue-50 p-3 text-sm text-blue-900">{taxPreview && taxTreatment === 'VAT12' ? `Net ${money(taxPreview.netCentavos)} + VAT ${money(taxPreview.vatCentavos)}` : 'Review the tax classification against the original supporting invoice.'}</p></div>}
      {edit === 'journal' && <><Field label="Description"><textarea className={inputClass} required maxLength={500} rows={2} placeholder="What is this entry for?" value={description} onChange={e => setDescription(e.target.value)} /></Field><div className="space-y-3">{lines.map((l, index) => <div key={index} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2 rounded-lg border border-border p-3 sm:grid-cols-[2fr_1fr_1fr_auto]"><div className="col-span-3 sm:col-span-1"><Field label={`Account · line ${index + 1}`}><AccountSelect accounts={books.accounts.filter(a => !['1100', '2000'].includes(a.code))} value={l.account} onChange={v => updateLine(index, 'account', v)} label={`Account line ${index + 1}`} /></Field></div><Field label="Debit (PHP)"><input aria-label={`Debit line ${index + 1}`} type="number" min="0" step="0.01" className={inputClass} value={l.debit} onChange={e => updateLine(index, 'debit', e.target.value)} /></Field><Field label="Credit (PHP)"><input aria-label={`Credit line ${index + 1}`} type="number" min="0" step="0.01" className={inputClass} value={l.credit} onChange={e => updateLine(index, 'credit', e.target.value)} /></Field><Button type="button" variant="ghost" size="icon" disabled={lines.length <= 2} aria-label={`Remove line ${index + 1}`} onClick={() => setLines(lines.filter((_, i) => i !== index))}><X className="size-4" /></Button></div>)}</div><div className="flex flex-wrap items-center justify-between gap-3"><Button type="button" variant="outline" disabled={lines.length >= 100} onClick={() => setLines([...lines, { account: '', debit: '', credit: '' }])}>Add line</Button><div className="text-right text-sm tabular-nums"><p>Debits {money(debit)} · Credits {money(credit)}</p><p className={debit > 0 && debit === credit ? 'text-emerald-700' : 'text-amber-700'}>{debit > 0 && debit === credit ? 'Balanced — ready to post' : `Difference: ${money(Math.abs(debit - credit))}`}</p></div></div><p className="text-xs text-muted-foreground">For opening balances, offset existing assets and liabilities against capital or retained earnings. Use the AP/AR modules for unpaid bills and invoices.</p></>}
      {(invoice || edit === 'payable' || edit === 'receivable') && <div className="grid gap-4 sm:grid-cols-2"><Field label={invoice ? (invoice.kind === 'receivable' ? 'Receipt amount (PHP)' : 'Payment amount (PHP)') : 'Document total, including VAT (PHP)'}><input className={inputClass} type="number" required min="0.01" step="0.01" value={amount} onChange={e => { touch('amount'); setAmount(e.target.value) }} /></Field><Field label={invoice ? 'Cash / bank account' : edit === 'payable' ? 'Expense / asset account' : 'Revenue account'}><AccountSelect accounts={books.accounts.filter(a => invoice ? a.cash : !a.cash && !['1100', '2000', '1400', '2110'].includes(a.code) && (edit === 'payable' ? ['Asset', 'Expense'].includes(a.type) : a.type === 'Revenue'))} value={account} onChange={value => { touch('account'); setAccount(value) }} /></Field></div>}
    </>}
    {company && invoice && <SettlementEvidence value={settlementDocuments} onChange={setSettlementDocuments} invoiceKind={invoice.kind} disabled={busy} onValidating={setDocumentsValidating} />}
    {pdfFile && <div className="space-y-3 rounded-lg border border-primary/20 p-4">
      {pdfVatMismatch && <p role="alert" className="text-sm text-amber-900">The VAT read from this PDF differs from the selected tax treatment. Check the gross total and classification. This bill form uses one expense account and one tax treatment; mixed transactions need separate reviewed entries.</p>}
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" required disabled={busy || pdfReading} checked={pdfReviewed} onChange={e => setPdfReviewed(e.target.checked)} /><span>I checked the original PDF, supplier and TIN, reference, dates, total, expense account and tax treatment.</span></label>
    </div>}
    {error && <p role="alert" className="rounded-lg bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
    <div className="flex justify-end gap-2 border-t border-border pt-4"><Button type="button" variant="outline" disabled={busy} onClick={onClose}>Cancel</Button><Button type="submit" disabled={busy || documentsValidating || pdfReading || (!!pdfFile && !pdfReviewed) || (!!company && (edit === 'payable' || edit === 'receivable') && (!chosenParty?.active || partiesLoading || !!partiesError)) || (edit === 'journal' && (debit !== credit || !debit))}>{busy ? 'Saving…' : edit === 'account' ? 'Save account' : reversal ? 'Post reversal' : invoice ? (invoice.kind === 'receivable' ? 'Record receipt' : 'Record payment') : company?.membership?.role === 'accountant' ? 'Submit for approval' : 'Post to books'}</Button></div>
  </fieldset></form>
}
