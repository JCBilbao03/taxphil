import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Download, Pencil, Plus, Trash2 } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { addTransactionDocument, removeTransactionDocument, updateTransactionDocument } from '@/lib/firestore/transactions'
import { formatCurrency } from '@/lib/utils'
import { downloadTrackingCsv, filterTransactions, parsePesoAmount, todayManila, trackingDateLabel, transactionTotals } from '@/lib/tax-workflows'
import { useAuthUser } from '@/store/useAuthStore'
import { useTaxStore, type Transaction, type TransactionType } from '@/store/useTaxStore'

const inputClass = 'w-full rounded-lg border border-[#cfdae5] bg-white px-3 py-2.5 text-sm text-[#243746] outline-none focus:border-[#087cc1] focus:ring-2 focus:ring-[#087cc1]/15'
const newForm = (type: TransactionType = 'income') => ({ type, description: '', amount: '', date: todayManila(), category: '', reference: '' })

export function IncomeExpenseTracker() {
  const user = useAuthUser()
  const income = useTaxStore(state => state.income), expenses = useTaxStore(state => state.expenses)
  const taxError = useTaxStore(state => state.error), taxLoading = useTaxStore(state => state.loading)
  const [params] = useSearchParams()
  const [form, setForm] = useState(() => newForm(params.get('type') === 'expense' ? 'expense' : 'income'))
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [showForm, setShowForm] = useState(params.has('type'))
  const [filter, setFilter] = useState('all'), [query, setQuery] = useState(''), [from, setFrom] = useState(''), [to, setTo] = useState('')
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<Transaction | null>(null)
  const formHeading = useRef<HTMLHeadingElement>(null)
  const mutation = useRef(false)
  useEffect(() => { if (showForm) formHeading.current?.focus() }, [showForm])
  useEffect(() => { if (confirmDelete) document.getElementById('transaction-delete-prompt')?.focus() }, [confirmDelete])
  const invalidRange = Boolean(from && to && from > to)
  const records = useMemo(() => invalidRange ? [] : filterTransactions([...income, ...expenses], { type: filter, query, from, to }), [income, expenses, filter, query, from, to, invalidRange])
  const totals = transactionTotals(records)
  function begin(item?: Transaction) {
    setError(''); setMessage(''); setEditing(item || null); setConfirmDelete(null)
    setForm(item ? { ...item, amount: String(item.amount), reference: item.reference || '' } : newForm())
    setShowForm(true); formHeading.current?.focus()
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!user || mutation.current) return
    mutation.current = true; setBusy(true); setError(''); setMessage('')
    try {
      const value = { ...form, amount: parsePesoAmount(form.amount), category: form.category.trim() || 'Uncategorized' }
      if (editing) await updateTransactionDocument(user.uid, editing.id, value, editing)
      else await addTransactionDocument(user.uid, value)
      setMessage(editing ? 'Transaction updated.' : 'Transaction added.'); setEditing(null); setForm(newForm(form.type)); setShowForm(false)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The transaction could not be saved.') }
    finally { mutation.current = false; setBusy(false) }
  }
  async function remove() {
    if (!user || !confirmDelete || mutation.current) return
    mutation.current = true; setBusy(true); setError('')
    try {
      await removeTransactionDocument(user.uid, confirmDelete.id, confirmDelete)
      if (editing?.id === confirmDelete.id) { setEditing(null); setShowForm(false) }
      setConfirmDelete(null); setMessage('Transaction removed.')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not remove the transaction.') }
    finally { mutation.current = false; setBusy(false) }
  }
  function exportRows() {
    downloadTrackingCsv(`taxphil-transactions-${todayManila()}.csv`, [['Date', 'Type', 'Description', 'Category', 'Reference', 'Amount PHP'], ...records.map(row => [row.date, row.type, row.description, row.category, row.reference || '', row.amount])])
  }
  return <div className="space-y-6 text-[#243746]">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-[#087cc1]">Personal records</p><h1 className="mt-2 text-2xl font-semibold tracking-tight">Income & expenses</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#60748a]">Track your own income and spending. These records are separate from shared company accounting books and do not calculate your tax liability.</p></div><Button disabled={busy || taxLoading} onClick={() => begin()}><Plus />Add transaction</Button></div>
    {(error || taxError) && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error || taxError}</p>}
    {message && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{message}</p>}
    <div className="grid gap-4 sm:grid-cols-3">{[['Income', totals.income], ['Expenses', totals.expenses], ['Net movement', totals.net]].map(([label, value]) => <section key={String(label)} className="rounded-xl border border-[#dce5ed] bg-white p-5"><p className="text-sm text-[#60748a]">{label}</p><p className="mt-2 text-2xl font-semibold tabular-nums">{formatCurrency(Number(value))}</p><p className="mt-2 text-xs text-[#60748a]">{taxLoading ? 'Loading records…' : 'For the records shown below'}</p></section>)}</div>
    {showForm && <section className="rounded-xl border border-[#cbdce9] bg-white p-5 sm:p-6"><h2 ref={formHeading} tabIndex={-1} className="text-lg font-semibold outline-none">{editing ? 'Edit transaction' : 'New transaction'}</h2><p className="mt-1 text-sm text-[#60748a]">Amounts are in Philippine pesos. Keep the original supporting invoice or receipt.</p><form onSubmit={submit} className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><label className="space-y-1.5 text-sm">Type<select className={inputClass} value={form.type} onChange={e => setForm({ ...form, type: e.target.value as TransactionType })}><option value="income">Income</option><option value="expense">Expense</option></select></label><label className="space-y-1.5 text-sm sm:col-span-2">Description<input className={inputClass} required maxLength={500} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Client invoice or business purchase" /></label><label className="space-y-1.5 text-sm">Amount (PHP)<input className={inputClass} required inputMode="decimal" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="0.00" /></label><label className="space-y-1.5 text-sm">Transaction date<input className={inputClass} type="date" required value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></label><label className="space-y-1.5 text-sm">Category<input className={inputClass} maxLength={100} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="Uncategorized" list="transaction-categories" /><datalist id="transaction-categories">{[...new Set([...income, ...expenses].map(item => item.category))].sort().map(category => <option key={category} value={category} />)}</datalist></label><label className="space-y-1.5 text-sm sm:col-span-2 lg:col-span-3">Reference (optional)<input className={inputClass} maxLength={100} value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })} placeholder="Supporting invoice or receipt number" /></label><div className="flex flex-wrap justify-end gap-2 sm:col-span-2 lg:col-span-3"><Button type="button" variant="outline" disabled={busy} onClick={() => { setShowForm(false); setEditing(null) }}>Cancel</Button><Button type="submit" disabled={busy || taxLoading}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Add transaction'}</Button></div></form></section>}
    <section className="overflow-hidden rounded-xl border border-[#dce5ed] bg-white"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e6ecf2] p-5"><div><h2 className="font-semibold">Transaction history</h2><p className="mt-1 text-sm text-[#60748a]">{records.length} matching record{records.length !== 1 ? 's' : ''}</p></div><Button variant="outline" disabled={!records.length || invalidRange || taxLoading} onClick={exportRows}><Download />Export CSV</Button></div><div className="grid gap-3 border-b border-[#e6ecf2] p-5 sm:grid-cols-2 lg:grid-cols-4"><label className="text-xs text-[#60748a]">Search<input type="search" className={`${inputClass} mt-1.5`} placeholder="Description, category, reference" value={query} onChange={e => setQuery(e.target.value)} /></label><label className="text-xs text-[#60748a]">Type<select className={`${inputClass} mt-1.5`} value={filter} onChange={e => setFilter(e.target.value)}><option value="all">All transactions</option><option value="income">Income only</option><option value="expense">Expenses only</option></select></label><label className="text-xs text-[#60748a]">From<input type="date" className={`${inputClass} mt-1.5`} value={from} onChange={e => setFrom(e.target.value)} /></label><label className="text-xs text-[#60748a]">Through<input type="date" className={`${inputClass} mt-1.5`} value={to} onChange={e => setTo(e.target.value)} /></label>{(query || filter !== 'all' || from || to) && <button className="text-left text-sm text-[#087cc1] underline" onClick={() => { setQuery(''); setFilter('all'); setFrom(''); setTo('') }}>Clear filters</button>}{invalidRange && <p role="alert" className="text-sm text-red-700">The end date must be on or after the start date.</p>}</div>
      {confirmDelete && <div id="transaction-delete-prompt" tabIndex={-1} role="alert" className="border-b border-red-100 bg-red-50 p-5 text-sm text-red-900"><p>Remove “{confirmDelete.description}” ({formatCurrency(confirmDelete.amount)}) from your personal tracker? Download an export first if you need a copy.</p><div className="mt-3 flex gap-2"><Button variant="outline" disabled={busy} onClick={() => setConfirmDelete(null)}>Keep record</Button><Button variant="destructive" disabled={busy} onClick={() => { void remove() }}>{busy ? 'Removing…' : 'Remove record'}</Button></div></div>}
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-[#f7f9fb] text-xs text-[#60748a]"><tr>{['Date', 'Description / reference', 'Category', 'Type', 'Amount', 'Actions'].map(label => <th key={label} className={`px-5 py-3 font-medium ${label === 'Amount' ? 'text-right' : ''}`}>{label}</th>)}</tr></thead><tbody>{taxLoading ? <tr><td colSpan={6} className="p-8 text-center text-[#60748a]">Loading your records…</td></tr> : !records.length ? <tr><td colSpan={6} className="p-10 text-center text-[#60748a]">{income.length || expenses.length ? 'No transactions match your filters.' : 'Add your first income or expense to get started.'}</td></tr> : records.map(item => <tr key={item.id} className="border-t border-[#edf1f5] hover:bg-[#f8fbfd]"><td className="whitespace-nowrap px-5 py-4 text-[#60748a]">{trackingDateLabel(item.date)}</td><td className="max-w-sm px-5 py-4"><p className="break-words font-medium">{item.description}</p>{item.reference && <p className="mt-1 text-xs text-[#60748a]">{item.reference}</p>}</td><td className="px-5 py-4 text-[#60748a]">{item.category}</td><td className="px-5 py-4"><span className={`rounded-md px-2 py-1 text-xs ${item.type === 'income' ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>{item.type === 'income' ? 'Income' : 'Expense'}</span></td><td className="whitespace-nowrap px-5 py-4 text-right font-medium tabular-nums">{formatCurrency(item.amount)}</td><td className="px-5 py-4"><div className="flex gap-1"><Button variant="ghost" size="icon" aria-label={`Edit ${item.description}`} disabled={busy} onClick={() => begin(item)}><Pencil className="size-4" /></Button><Button variant="ghost" size="icon" aria-label={`Remove ${item.description}`} disabled={busy} onClick={() => { setConfirmDelete(item); setMessage('') }}><Trash2 className="size-4" /></Button></div></td></tr>)}</tbody></table></div>
    </section>
  </div>
}
