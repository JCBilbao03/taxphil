import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { Building2, Plus, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useCompany } from '@/hooks/useCompany'
import { useCompanyParties } from '@/hooks/useCompanyParties'
import { validateParty, type Party, type PartyInput, type PartyKind } from '@/lib/parties'

const field = 'grid gap-2 text-sm font-medium text-slate-700'
const control = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/25'

function PartyEditor({ kind, existing, save, onClose, onSaved }: { kind: PartyKind; existing?: Party; save: (value: PartyInput, existing?: Party) => Promise<unknown>; onClose: () => void; onSaved: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const [value, setValue] = useState<PartyInput>(existing || { kind, registeredName: '', tin: '', address: '', email: '', defaultAtc: '', notes: '', active: true })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { dialog.current?.showModal(); const element = dialog.current; return () => element?.close() }, [])
  const update = (key: keyof PartyInput, content: string | boolean) => setValue((current) => ({ ...current, [key]: content }))
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(''); setBusy(true)
    try { await save(validateParty(value), existing); onSaved() }
    catch (error) { setError(error instanceof Error ? error.message : 'The directory record could not be saved.'); setBusy(false) }
  }
  return <dialog ref={dialog} aria-labelledby={titleId} onCancel={(event) => { if (busy) event.preventDefault(); else onClose() }} className="m-auto max-h-[90svh] w-[min(94vw,720px)] overflow-auto rounded-xl border border-slate-200 bg-white p-5 shadow-xl backdrop:bg-slate-950/40 sm:p-7">
    <div className="mb-5 flex items-center justify-between gap-3"><h2 id={titleId} className="text-xl font-semibold text-slate-900">{existing ? 'Edit' : 'Add'} {kind}</h2><Button variant="ghost" size="icon" disabled={busy} onClick={onClose} aria-label="Close directory editor"><X className="size-4" /></Button></div>
    <form onSubmit={(event) => void submit(event)} className="space-y-5"><fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
      <label className={`${field} sm:col-span-2`}>Registered name<Input required maxLength={200} value={value.registeredName} onChange={(e) => update('registeredName', e.target.value)} placeholder="Name on the tax registration" /></label>
      <label className={field}>TIN and branch code<Input required maxLength={24} value={value.tin} onChange={(e) => update('tin', e.target.value)} placeholder="123-456-789-00000" /><span className="text-xs font-normal text-slate-500">9-digit TIN; optional 3- or 5-digit branch. A missing branch is saved as 00000.</span></label>
      <label className={field}>Email (optional)<Input type="email" maxLength={320} value={value.email} onChange={(e) => update('email', e.target.value)} /></label>
      <label className={`${field} sm:col-span-2`}>Registered address<textarea required className={control} rows={2} maxLength={500} value={value.address} onChange={(e) => update('address', e.target.value)} /></label>
      {kind === 'vendor' ? <label className={field}>Default withholding ATC (optional)<Input maxLength={5} value={value.defaultAtc} onChange={(e) => update('defaultAtc', e.target.value.toUpperCase())} placeholder="e.g. WC010" /><span className="text-xs font-normal text-slate-500">Review the ATC and rate for each applicable payment.</span></label> : null}
      {existing ? <label className={field}>Status<select className={control} value={value.active ? 'active' : 'archived'} onChange={(e) => update('active', e.target.value === 'active')}><option value="active">Active</option><option value="archived">Archived</option></select></label> : null}
      <label className={`${field} sm:col-span-2`}>Internal notes (optional)<textarea className={control} rows={3} maxLength={2000} value={value.notes} onChange={(e) => update('notes', e.target.value)} /></label>
    </fieldset>
    <p className="rounded-lg bg-blue-50 p-3 text-sm leading-6 text-blue-900">The name, TIN, and address fill your {kind === 'vendor' ? 'bills and payee records' : 'customer invoices'}. Existing transactions retain the details saved when they were prepared.</p>
    {error ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
    <div className="flex justify-end gap-2 border-t border-slate-200 pt-4"><Button type="button" variant="outline" disabled={busy} onClick={onClose}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? 'Saving…' : `Save ${kind}`}</Button></div>
    </form>
  </dialog>
}

export function PartyDirectory({ kind }: { kind: PartyKind }) {
  const company = useCompany()
  const { parties, loading, error, save } = useCompanyParties(kind)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('active')
  const [editing, setEditing] = useState<Party | 'new' | null>(null)
  const [notice, setNotice] = useState('')
  const canEdit = !!company?.membership?.active && company.membership.role !== 'viewer'
  const displayed = parties.filter((party) => (status === 'all' || party.active === (status === 'active')) && `${party.registeredName} ${party.tin} ${party.normalizedTin} ${party.email}`.toLowerCase().includes(search.toLowerCase()))
  return <div className="space-y-5">
    <div className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center"><div className="flex gap-3"><div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-primary"><Building2 className="size-5" /></div><div><h2 className="text-lg font-semibold text-slate-900">{kind === 'vendor' ? 'Vendor' : 'Customer'} directory</h2><p className="mt-1 max-w-xl text-sm leading-6 text-slate-500">Maintain registered names, TINs and addresses once, then reuse them in your accounting records.</p></div></div><Button disabled={!canEdit || loading} onClick={() => { setEditing('new'); setNotice('') }}><Plus className="size-4" />Add {kind}</Button></div>
    {notice ? <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p> : null}
    <div className="flex flex-wrap gap-3"><div className="relative min-w-[220px] flex-1"><Search className="absolute left-3 top-3 size-4 text-slate-400" /><Input className="pl-9" aria-label={`Search ${kind}s`} placeholder="Search name, TIN, or email" value={search} onChange={(e) => setSearch(e.target.value)} /></div><select className={`${control} w-auto`} aria-label="Directory status" value={status} onChange={(e) => setStatus(e.target.value)}><option value="active">Active records</option><option value="archived">Archived records</option><option value="all">All records</option></select></div>
    {loading ? <p role="status" className="p-6 text-sm text-slate-500">Loading your company directory…</p> : error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</p> : !displayed.length ? <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center"><Building2 className="mx-auto size-8 text-slate-400" /><h3 className="mt-3 font-semibold text-slate-800">{parties.length ? 'No matching records' : `Add your first ${kind}`}</h3><p className="mt-2 text-sm text-slate-500">{parties.length ? 'Try another name, TIN, or status.' : `A registered name, TIN, and address are required before recording a new ${kind === 'vendor' ? 'bill' : 'customer invoice'}.`}</p></div> : <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white"><table className="w-full text-left text-sm"><thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500"><tr>{['Registered name', 'TIN / branch', 'Address', 'Status', ''].map((title) => <th key={title} className="px-4 py-3 font-semibold">{title}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{displayed.map((party) => <tr key={party.id}><td className="min-w-44 px-4 py-4"><p className="font-medium text-slate-900">{party.registeredName}</p>{party.email ? <p className="mt-1 text-xs text-slate-500">{party.email}</p> : null}{party.defaultAtc ? <p className="mt-1 text-xs text-slate-500">Default ATC {party.defaultAtc}</p> : null}</td><td className="whitespace-nowrap px-4 py-4 tabular-nums text-slate-700">{party.tin}</td><td className="min-w-48 max-w-xs px-4 py-4 text-slate-500">{party.address}</td><td className="px-4 py-4"><span className={`rounded-full px-2 py-1 text-xs font-medium ${party.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{party.active ? 'Active' : 'Archived'}</span></td><td className="px-4 py-4"><Button size="sm" variant="outline" disabled={!canEdit} onClick={() => { setEditing(party); setNotice('') }} aria-label={`Edit ${party.registeredName}`}>Edit</Button></td></tr>)}</tbody></table></div>}
    <p className="text-xs leading-5 text-slate-500">TIN format is checked when saving. Verify registration details against the source document. Archived records remain linked to earlier transactions.</p>
    {editing ? <PartyEditor key={editing === 'new' ? `new-${kind}` : editing.id} kind={kind} existing={editing === 'new' ? undefined : editing} save={save} onClose={() => setEditing(null)} onSaved={() => { setNotice(`${kind === 'vendor' ? 'Vendor' : 'Customer'} saved.`); setEditing(null) }} /> : null}
  </div>
}
