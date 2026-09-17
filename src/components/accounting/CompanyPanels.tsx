import { SupplierBillPdfLink } from './SupplierBillPdf'
import type { Invoice } from '@/lib/accounting'
import { useId, useState, type FormEvent, type ReactNode } from 'react'
import { Check, ClipboardList, Copy, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCompany, roleLabel, type CompanyContextValue, type CompanyMembership, type CompanyRole, type CompanyRow } from '@/hooks/useCompany'
import { DEFAULT_COMPANY_PROFILE, calculateInvoiceTax, getComplianceChecklist, validateCompanyProfile, type CompanyProfile } from '@/lib/ph-compliance'
import { money } from '@/lib/accounting'

const panel = 'rounded-xl border border-[#dce5ee] bg-white shadow-[0_2px_7px_rgba(20,49,79,0.025)]'
const input = 'w-full rounded-lg border border-[#cfdae5] bg-white px-3 py-2 text-sm text-[#15385d] outline-none focus:border-[#1988bb] focus:ring-2 focus:ring-[#1988bb]/15 disabled:bg-[#f5f7fa] disabled:text-[#526b84]'
const primary = 'h-9 rounded-lg bg-[#087fa5] px-4 text-white hover:bg-[#076987]'
const roles: CompanyRole[] = ['admin', 'manager', 'accountant', 'viewer']
const errorMessage = (cause: unknown) => cause instanceof Error ? cause.message : 'This request could not be completed. Please try again.'
const textValue = (value: unknown, fallback = '—') => typeof value === 'string' && value ? value : fallback
const recordValue = (value: unknown): Record<string, unknown> => value && typeof value === 'object' ? value as Record<string, unknown> : {}

function displayDate(value: unknown) {
  let date: Date | null = null
  if (typeof value === 'string' || typeof value === 'number') date = new Date(value)
  else if (value && typeof value === 'object') {
    const timestamp = value as { toDate?: () => Date; seconds?: number; _seconds?: number }
    if (typeof timestamp.toDate === 'function') date = timestamp.toDate()
    else if (typeof timestamp.seconds === 'number') date = new Date(timestamp.seconds * 1000)
    else if (typeof timestamp._seconds === 'number') date = new Date(timestamp._seconds * 1000)
  }
  return date && !Number.isNaN(date.getTime()) ? new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short' }).format(date) : '—'
}

function Notice({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return <div role={error ? 'alert' : 'status'} className={`rounded-lg border px-4 py-3 text-sm leading-6 ${error ? 'border-red-200 bg-red-50 text-red-800' : 'border-[#cfe4ee] bg-[#eff8fc] text-[#365f7b]'}`}>{children}</div>
}

function EmptyState({ title, children }: { title: string; children: ReactNode }) {
  return <div className="px-6 py-12 text-center"><ClipboardList className="mx-auto mb-3 size-8 text-[#8fa5b9]" aria-hidden="true" /><h3 className="font-semibold text-[#173b61]">{title}</h3><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[#526b84]">{children}</p></div>
}

type ProfileFormProps = {
  initial?: Partial<CompanyProfile>
  onSave: (profile: CompanyProfile) => Promise<unknown> | void
  submitLabel?: string
  readOnly?: boolean
}

export function CompanyProfileForm({ initial, onSave, submitLabel = 'Save company profile', readOnly = false }: ProfileFormProps) {
  const id = useId()
  const [profile, setProfile] = useState<CompanyProfile>(() => ({ ...DEFAULT_COMPANY_PROFILE, ...initial, accountantReviewRequired: true }))
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const validation = validateCompanyProfile(profile)
  const fieldError = (field: keyof CompanyProfile) => submitted ? validation.errors.find(issue => issue.field === field)?.message : undefined
  function change<K extends keyof CompanyProfile>(field: K, value: CompanyProfile[K]) {
    setProfile(current => ({ ...current, [field]: value, accountantReviewRequired: true }))
    setSaved(false)
    setError('')
  }
  function field(name: keyof CompanyProfile, label: string, options: { placeholder?: string; hint?: string; required?: boolean; maxLength?: number; wide?: boolean; numeric?: boolean } = {}) {
    const message = fieldError(name)
    return <div className={options.wide ? 'sm:col-span-2' : ''}>
      <label className="mb-1.5 block text-sm font-medium text-[#294b6d]" htmlFor={`${id}-${name}`}>{label}{options.required && <span aria-hidden="true"> *</span>}</label>
      <input id={`${id}-${name}`} name={name} className={input} value={String(profile[name] ?? '')} onChange={event => change(name, event.target.value as CompanyProfile[typeof name])} placeholder={options.placeholder} required={options.required} maxLength={options.maxLength ?? 200} inputMode={options.numeric ? 'numeric' : undefined} aria-invalid={Boolean(message)} aria-describedby={message ? `${id}-${name}-error` : options.hint ? `${id}-${name}-hint` : undefined} />
      {options.hint && <p id={`${id}-${name}-hint`} className="mt-1.5 text-xs leading-5 text-[#60748a]">{options.hint}</p>}
      {message && <p id={`${id}-${name}-error`} className="mt-1.5 text-sm text-red-700">{message}</p>}
    </div>
  }
  function select<K extends keyof CompanyProfile>(name: K, label: string, choices: [CompanyProfile[K], string][]) {
    const message = fieldError(name)
    return <div><label className="mb-1.5 block text-sm font-medium text-[#294b6d]" htmlFor={`${id}-${name}`}>{label} <span aria-hidden="true">*</span></label><select id={`${id}-${name}`} className={input} value={String(profile[name])} onChange={event => change(name, event.target.value as CompanyProfile[K])} aria-invalid={Boolean(message)} aria-describedby={message ? `${id}-${name}-error` : undefined}>{choices.map(([value, title]) => <option key={String(value)} value={String(value)}>{title}</option>)}</select>{message && <p id={`${id}-${name}-error`} className="mt-1.5 text-sm text-red-700">{message}</p>}</div>
  }
  async function save(event: FormEvent) {
    event.preventDefault()
    if (readOnly || saving) return
    setSubmitted(true); setSaved(false); setError('')
    if (!validation.valid) return
    setSaving(true)
    try { await onSave({ ...profile, accountantReviewRequired: true }); setSaved(true) }
    catch (cause) { setError(errorMessage(cause)) }
    finally { setSaving(false) }
  }
  return <form onSubmit={save} noValidate className="space-y-6 text-sm" aria-busy={saving}>
    <p className="text-sm leading-6 text-[#526b84]">Use the details on your company’s registration documents. Fields marked * are required.</p>
    {error && <Notice error>{error}</Notice>}
    {submitted && !validation.valid && <Notice error>Please review the highlighted company details before saving.<ul className="mt-1 list-disc pl-5">{validation.errors.map(issue => <li key={`${issue.field}-${issue.code}`}><a href={`#${id}-${issue.field}`} className="underline">{issue.message}</a></li>)}</ul></Notice>}
    {saved && <Notice>Company profile saved.</Notice>}
    <fieldset disabled={saving || readOnly} className="space-y-6">
      <div><h3 className="mb-4 border-b border-[#e7edf3] pb-3 text-base font-semibold text-[#15385d]">Registered business</h3><div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
        {field('registeredName', 'Registered company name', { required: true, wide: true })}
        {select('entityType', 'Entity type', [['sole_proprietor', 'Sole proprietor'], ['corporation', 'Corporation'], ['opc', 'One Person Corporation'], ['partnership', 'Partnership'], ['nonstock', 'Non-stock corporation'], ['foreign_branch', 'Foreign branch']])}
        {field('businessNature', 'Nature of business', { required: true, placeholder: 'e.g. Professional services', maxLength: 300 })}
        {field('registeredAddress', 'Registered business address', { required: true, wide: true, maxLength: 500 })}
        {field('tin', 'Taxpayer Identification Number', { required: true, placeholder: '123-456-789', numeric: true, maxLength: 20 })}
        {field('branchCode', 'Branch code', { required: true, placeholder: '00000', numeric: true, maxLength: 5 })}
        {field('rdo', 'Revenue District Office code', { required: true, placeholder: 'e.g. 039', maxLength: 10 })}
        {field('secRegistrationNumber', 'SEC registration number', { required: profile.entityType !== 'sole_proprietor', maxLength: 100, hint: 'For SEC-registered entities. Leave blank for a sole proprietor.' })}
      </div></div>
      <div><h3 className="mb-4 border-b border-[#e7edf3] pb-3 text-base font-semibold text-[#15385d]">Tax & reporting settings</h3><div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
        {select('vatStatus', 'VAT registration', [['vat', 'VAT registered'], ['non_vat', 'Non-VAT registered']])}
        {select('incomeTaxRegime', 'Income tax regime', [['graduated', 'Graduated income tax'], ['eight_percent', '8% option — subject to eligibility'], ['corporate', 'Corporate income tax']])}
        {field('fiscalYearEnd', 'Fiscal year end', { required: true, placeholder: '12-31', hint: 'Month and day (MM-DD), as registered.', maxLength: 5 })}
        {select('reportingFramework', 'Financial reporting framework', [['pfrs', 'PFRS'], ['pfrs_smes', 'PFRS for SMEs'], ['pfrs_small', 'PFRS for Small Entities']])}
        {field('casRegistrationReference', 'CAS / CBA registration reference', { hint: 'Enter the applicable BIR registration or acknowledgment reference, if available.' })}
        {field('invoiceSeries', 'Invoice series', { required: true, maxLength: 80, placeholder: 'e.g. INV-2026', hint: 'Match your authorized invoicing arrangements.' })}
        <label className="flex items-start gap-3 rounded-lg border border-[#e1e9f0] p-3"><input type="checkbox" className="mt-0.5 size-4 accent-[#087fa5]" checked={profile.withholdingAgent} onChange={event => change('withholdingAgent', event.target.checked)} /><span><span className="block font-medium text-[#294b6d]">Withholding agent</span><span className="mt-1 block text-xs leading-5 text-[#60748a]">Apply the obligations associated with your registration.</span></span></label>
        <label className="flex items-start gap-3 rounded-lg border border-[#e1e9f0] p-3"><input type="checkbox" className="mt-0.5 size-4 accent-[#087fa5]" checked={profile.hasEmployees} onChange={event => change('hasEmployees', event.target.checked)} /><span><span className="block font-medium text-[#294b6d]">Company has employees</span><span className="mt-1 block text-xs leading-5 text-[#60748a]">Include employer obligations in your review.</span></span></label>
      </div></div>
    </fieldset>
    {submitted && validation.warnings.length > 0 && <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900"><p className="font-medium">Accountant review needed</p><ul className="mt-1 list-disc pl-5">{validation.warnings.map(issue => <li key={`${issue.field}-${issue.code}`}>{issue.message}</li>)}</ul></div>}
    <div className="flex flex-col gap-4 border-t border-[#e7edf3] pt-5 sm:flex-row sm:items-center sm:justify-between"><p className="max-w-xl text-xs leading-5 text-[#60748a]">An accountant must review the registration details, tax elections, and reporting framework. Saving this profile does not certify compliance.</p>{readOnly ? <span className="shrink-0 rounded-md bg-[#f0f4f8] px-3 py-2 text-xs text-[#526b84]">Only a Company Admin can edit</span> : <Button type="submit" disabled={saving} className={primary}>{saving ? 'Saving…' : submitLabel}</Button>}</div>
  </form>
}

function MemberRow({ member, currentUid, canManage, busy, onSave }: { member: CompanyMembership; currentUid: string; canManage: boolean; busy: boolean; onSave: (uid: string, role: CompanyRole, active: boolean) => Promise<void> }) {
  const [role, setRole] = useState(member.role)
  const [active, setActive] = useState(member.active)
  const self = member.uid === currentUid
  const changed = role !== member.role || active !== member.active
  return <tr className="border-t border-[#e8edf3]"><td className="px-5 py-4"><p className="font-medium text-[#203f60]">{member.displayName || member.email}{self && <span className="ml-2 text-xs font-normal text-[#60748a]">You</span>}</p><p className="mt-1 text-xs text-[#60748a]">{member.email}</p></td><td className="px-5 py-4">{canManage && !self ? <select className={`${input} min-w-44`} value={role} onChange={event => setRole(event.target.value as CompanyRole)} disabled={busy} aria-label={`Role for ${member.email}`}>{roles.map(item => <option key={item} value={item}>{roleLabel(item)}</option>)}</select> : roleLabel(member.role)}</td><td className="px-5 py-4">{canManage && !self ? <label className="flex items-center gap-2"><input type="checkbox" checked={active} onChange={event => setActive(event.target.checked)} disabled={busy} className="size-4 accent-[#087fa5]" aria-label={`Active access for ${member.email}`} />Active</label> : <span className={`rounded-md px-2 py-1 text-xs ${member.active ? 'bg-[#eaf5ef] text-[#28704f]' : 'bg-[#f0f2f5] text-[#617083]'}`}>{member.active ? 'Active' : 'Inactive'}</span>}</td>{canManage && <td className="px-5 py-4 text-right">{self ? <span className="text-xs text-[#60748a]">Your account</span> : <Button type="button" variant="outline" disabled={!changed || busy} onClick={() => { void onSave(member.uid, role, active) }}>Save</Button>}</td>}</tr>
}

function TeamPanel({ context }: { context: CompanyContextValue }) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<CompanyRole>('accountant')
  const [invite, setInvite] = useState<{ companyCode: string; inviteCode: string; expiresAt: unknown; email: string } | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [working, setWorking] = useState(false)
  const canManage = context.membership?.role === 'admin'
  const busy = working || context.busy
  async function createInvite(event: FormEvent) {
    event.preventDefault()
    if (!canManage || busy) return
    setError(''); setMessage(''); setInvite(null); setWorking(true)
    try {
      const result = await context.invoke<{ companyCode: string; inviteCode: string; expiresAt: unknown }>('companyInvite', { email: email.trim(), role })
      if (!result.inviteCode || !result.companyCode) throw Error('The service did not return an invitation code. Please try again.')
      setInvite({ ...result, email: email.trim() }); setEmail('')
    } catch (cause) { setError(errorMessage(cause)) }
    finally { setWorking(false) }
  }
  async function saveMember(uid: string, nextRole: CompanyRole, active: boolean) {
    if (!canManage || busy) return
    setError(''); setMessage(''); setWorking(true)
    try { await context.invoke('companySetMemberRole', { uid, role: nextRole, active }); setMessage('Team member access updated.') }
    catch (cause) { setError(errorMessage(cause)) }
    finally { setWorking(false) }
  }
  async function copyInvite() {
    if (!invite) return
    try { await navigator.clipboard.writeText(`Company code: ${invite.companyCode}\nInvitation code: ${invite.inviteCode}\nInvited email: ${invite.email}`); setMessage('Invitation details copied. Share them privately with the invited person.'); setError('') }
    catch { setError('Copy is unavailable. Select the displayed invitation details and copy them manually.') }
  }
  return <div className="space-y-5">{error && <Notice error>{error}</Notice>}{message && <Notice>{message}</Notice>}
    {canManage && <section className={`${panel} p-5 sm:p-6`}><h2 className="text-base font-semibold">Invite a team member</h2><p className="mt-1 text-sm leading-6 text-[#60748a]">Each person signs in with their own account and joins your company using a private invitation.</p><form onSubmit={createInvite} className="mt-5 flex flex-col items-end gap-4 lg:flex-row"><div className="w-full flex-1"><label htmlFor="company-invite-email" className="mb-1.5 block text-sm font-medium">Email address</label><input id="company-invite-email" type="email" required autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} className={input} placeholder="name@company.com" disabled={busy} maxLength={254} /></div><div className="w-full lg:w-56"><label htmlFor="company-invite-role" className="mb-1.5 block text-sm font-medium">Company role</label><select id="company-invite-role" value={role} onChange={event => setRole(event.target.value as CompanyRole)} className={input} disabled={busy}>{roles.map(item => <option key={item} value={item}>{roleLabel(item)}</option>)}</select></div><Button type="submit" className={`${primary} w-full lg:w-auto`} disabled={busy}>{working ? 'Creating…' : 'Create invitation'}</Button></form>
      {invite && <div className="mt-5 rounded-lg border border-[#cce1ed] bg-[#f1f8fc] p-4"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">Invitation ready for {invite.email}</h3><Button type="button" variant="outline" onClick={() => { void copyInvite() }}><Copy aria-hidden="true" />Copy details</Button></div><dl className="mt-4 grid gap-3 sm:grid-cols-2"><div><dt className="text-xs text-[#526b84]">Company code</dt><dd className="mt-1 select-all break-all font-mono">{invite.companyCode}</dd></div><div><dt className="text-xs text-[#526b84]">Private invitation code</dt><dd className="mt-1 select-all break-all font-mono">{invite.inviteCode}</dd></div></dl><p className="mt-3 text-sm leading-6 text-[#526b84]">Share these details privately with the invited person. They must sign in using {invite.email}. No email has been sent. {displayDate(invite.expiresAt) !== '—' && `Expires ${displayDate(invite.expiresAt)}.`}</p></div>}
    </section>}
    <section className={`${panel} overflow-hidden`}><div className="flex items-center justify-between gap-3 p-5"><h2 className="text-base font-semibold">Company team</h2><span className="rounded-md bg-[#eff4f9] px-2.5 py-1 text-xs text-[#526b84]">{context.members.filter(member => member.active).length} active</span></div>{context.members.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-t border-[#e8edf3] bg-[#f7f9fc] text-xs text-[#60748a]"><tr><th className="px-5 py-3 font-medium">Team member</th><th className="px-5 py-3 font-medium">Role</th><th className="px-5 py-3 font-medium">Access</th>{canManage && <th className="px-5 py-3 text-right font-medium">Actions</th>}</tr></thead><tbody>{context.members.map(member => <MemberRow key={`${member.uid}-${member.role}-${member.active}`} member={member} currentUid={context.membership!.uid} canManage={canManage} busy={busy} onSave={saveMember} />)}</tbody></table></div> : <EmptyState title="Team details are loading">Your company’s members will appear here when available.</EmptyState>}</section>
    <section className={`${panel} p-5 sm:p-6`}><h2 className="text-base font-semibold">How access works</h2><div className="mt-4 grid gap-4 sm:grid-cols-2"><RoleDescription role="admin">Manages the company profile, invitations, and user access. Can review another person’s submitted transactions.</RoleDescription><RoleDescription role="manager">Reviews and approves transactions, manages accounting, and closes periods.</RoleDescription><RoleDescription role="accountant">Prepares transactions and submits them for review.</RoleDescription><RoleDescription role="viewer">Reads company records and reports without changing them.</RoleDescription></div><p className="mt-4 border-t border-[#e7edf3] pt-4 text-xs leading-5 text-[#60748a]">A company code identifies your company. Access requires an individual login and an active membership. Company Admins cannot change their own access from this screen.</p></section>
  </div>
}

function RoleDescription({ role, children }: { role: CompanyRole; children: ReactNode }) {
  return <div className="rounded-lg bg-[#f6f9fc] p-4"><p className="font-medium">{roleLabel(role)}</p><p className="mt-1 text-sm leading-6 text-[#60748a]">{children}</p></div>
}

function ApprovalDetail({ command }: { command: Record<string, unknown> }) {
  const payload = recordValue(command.input ?? command.entry ?? command.invoice ?? command)
  const labels: Record<string, string> = { type: 'Action', kind: 'Type', reference: 'Reference', description: 'Description', date: 'Transaction date', due: 'Due date', party: 'Customer / supplier', partyTin: 'Customer / supplier TIN', partyAddress: 'Address', amount: 'Total amount', account: 'Account', taxTreatment: 'Tax treatment', cash: 'Cash / bank account', invoiceId: 'Invoice ID', entryId: 'Entry ID', closedThrough: 'Lock date', code: 'Account code', name: 'Account name' }
  const fields = Object.entries(payload).filter(([key, value]) => key in labels && (typeof value === 'string' || typeof value === 'number'))
  const lines = Array.isArray(payload.lines) ? payload.lines.map(recordValue) : []
  const gross = payload.taxTreatment === 'VAT12' && typeof payload.amount === 'number' && Number.isSafeInteger(payload.amount) && payload.amount > 0 ? payload.amount : null
  const net = gross === null ? null : calculateInvoiceTax(gross, 'VAT12', true).netCentavos
  return <div className="mt-4 rounded-lg border border-[#e0e8ef] bg-[#f8fafd] p-4"><dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">{fields.map(([key, value]) => <div key={key}><dt className="text-xs text-[#60748a]">{key === 'amount' && gross !== null ? 'Total amount (VAT inclusive)' : labels[key]}</dt><dd className="mt-1 break-words text-sm">{key === 'amount' && typeof value === 'number' ? money(value) : String(value)}</dd></div>)}{gross !== null && net !== null && <><div><dt className="text-xs text-[#60748a]">Net amount before VAT</dt><dd className="mt-1 text-sm tabular-nums">{money(net)}</dd></div><div><dt className="text-xs text-[#60748a]">VAT (12%, included in total)</dt><dd className="mt-1 text-sm tabular-nums">{money(gross - net)}</dd></div></>}</dl><SupplierBillPdfLink file={payload.supplierBillPdf as Invoice['supplierBillPdf']} />{lines.length > 0 && <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-[#dce5ee] text-xs text-[#60748a]"><th className="py-2 font-medium">Account</th><th className="py-2 text-right font-medium">Debit</th><th className="py-2 text-right font-medium">Credit</th></tr></thead><tbody>{lines.map((line, index) => <tr key={index}><td className="py-2">{textValue(line.account)}</td><td className="py-2 text-right tabular-nums">{money(typeof line.debit === 'number' ? line.debit : 0)}</td><td className="py-2 text-right tabular-nums">{money(typeof line.credit === 'number' ? line.credit : 0)}</td></tr>)}</tbody></table></div>}{!fields.length && !lines.length && <p className="text-sm text-[#60748a]">No transaction details are available. Review the source record before making a decision.</p>}</div>
}

function ApprovalsPanel({ context }: { context: CompanyContextValue }) {
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [working, setWorking] = useState('')
  const [reasons, setReasons] = useState<Record<string, string>>({})
  const [filter, setFilter] = useState('pending')
  const canApprove = context.membership?.role === 'admin' || context.membership?.role === 'manager'
  const visible = context.approvals.filter(row => filter === 'all' || row.status === 'pending')
  async function decide(row: CompanyRow, type: 'approve' | 'reject') {
    if (!canApprove || context.busy || working) return
    const reason = reasons[row.id]?.trim() || ''
    if (type === 'reject' && !reason) { setError('Add a reason so the preparer knows what to correct.'); return }
    setError(''); setMessage(''); setWorking(row.id)
    try { await context.command({ type, pendingId: row.id, ...(reason ? { reason } : {}) }); setMessage(type === 'approve' ? 'Transaction approved and posted.' : 'Transaction rejected. The reason has been recorded.') }
    catch (cause) { setError(errorMessage(cause)) }
    finally { setWorking('') }
  }
  return <div className="space-y-5">{error && <Notice error>{error}</Notice>}{message && <Notice>{message}</Notice>}<Notice>Review the full transaction before approving. A person cannot approve their own submission. {canApprove ? 'An approval posts the transaction to the company books.' : 'A Company Admin or Accounting Manager must review submitted transactions.'}</Notice><section className={`${panel} overflow-hidden`}><div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e7edf3] p-5"><h2 className="text-base font-semibold">Transaction review</h2><label className="flex items-center gap-2 text-sm text-[#60748a]">Show<select className={input} value={filter} onChange={event => setFilter(event.target.value)}><option value="pending">Pending review</option><option value="all">Recent submissions</option></select></label></div>{visible.length ? <div className="divide-y divide-[#e7edf3]">{visible.map(row => {
      const command = recordValue(row.command)
      const payload = recordValue(command.input ?? command.entry ?? command.invoice ?? command)
      const own = row.preparedBy === context.membership?.uid || row.createdBy === context.membership?.uid || row.submittedBy === context.membership?.uid
      const pending = row.status === 'pending'
      return <article key={row.id} className="p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">{textValue(payload.reference, textValue(row.summary, textValue(command.type, 'Transaction submission')))}</h3><p className="mt-1 text-sm leading-6 text-[#60748a]">Prepared by {textValue(row.preparedByEmail, textValue(row.createdByEmail, textValue(row.submittedByEmail, textValue(row.preparedBy))))} · {displayDate(row.createdAt)}</p></div><span className={`rounded-md px-2.5 py-1 text-xs capitalize ${pending ? 'bg-[#fff5df] text-[#866015]' : row.status === 'approved' ? 'bg-[#eaf5ef] text-[#28704f]' : 'bg-[#f0f2f5] text-[#617083]'}`}>{textValue(row.status, 'Unknown status')}</span></div><details className="mt-3" open={pending}><summary className="cursor-pointer text-sm font-medium text-[#087fa5]">Transaction details</summary><ApprovalDetail command={command} /></details>{row.reason ? <p className="mt-3 text-sm leading-6 text-[#60748a]">Review note: {textValue(row.reason)}</p> : null}{pending && canApprove && <div className="mt-4 border-t border-[#e7edf3] pt-4">{own && <p className="mb-3 text-sm text-[#866015]">This is your submission. Another Company Admin or Accounting Manager must review it.</p>}<label htmlFor={`approval-reason-${row.id}`} className="mb-1.5 block text-sm font-medium">Review note <span className="font-normal text-[#60748a]">(required when rejecting)</span></label><textarea id={`approval-reason-${row.id}`} className={`${input} min-h-20`} value={reasons[row.id] || ''} onChange={event => setReasons(current => ({ ...current, [row.id]: event.target.value }))} maxLength={1000} disabled={Boolean(working) || context.busy || own} /><div className="mt-3 flex flex-wrap justify-end gap-2"><Button type="button" variant="outline" disabled={Boolean(working) || context.busy || own || !context.booksReady} onClick={() => { void decide(row, 'reject') }}>Reject</Button><Button type="button" className={primary} disabled={Boolean(working) || context.busy || own || !context.booksReady} onClick={() => { void decide(row, 'approve') }}><Check aria-hidden="true" />{working === row.id ? 'Processing…' : 'Approve & post'}</Button></div></div>}</article>
    })}</div> : <EmptyState title={filter === 'pending' ? 'No pending approvals' : 'No submissions yet'}>{filter === 'pending' ? 'Transactions submitted for review will appear here before they are posted to your books.' : 'Your company’s submitted transactions and review decisions will appear here.'}</EmptyState>}<p className="border-t border-[#e7edf3] px-5 py-3 text-xs text-[#60748a]">All pending submissions and up to 100 recent submissions.</p></section></div>
}

function CompliancePanel({ profile }: { profile: CompanyProfile }) {
  const checklist = getComplianceChecklist(profile)
  return <div className="space-y-5"><Notice>This checklist is a review aid based on your company profile. It does not confirm BIR or SEC registration, filing, approval, or full compliance. Your accountant should confirm which requirements apply.</Notice><section className={`${panel} overflow-hidden`}><div className="border-b border-[#e7edf3] p-5"><h2 className="text-base font-semibold">Philippine compliance review</h2><p className="mt-1 text-sm text-[#60748a]">Review the requirements and supporting sources for your registered business.</p></div><div className="divide-y divide-[#e7edf3]">{checklist.map(item => <ComplianceItem key={item.id} item={item} />)}</div></section></div>
}

function ComplianceItem({ item }: { item: ReturnType<typeof getComplianceChecklist>[number] }) {
  return <article className="p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="mb-1 text-xs font-medium text-[#60748a]">{item.agency}</p><h3 className="font-semibold">{item.title}</h3></div><span className="rounded-md bg-[#fff5df] px-2.5 py-1 text-xs text-[#866015]">Needs review</span></div><p className="mt-2 text-sm leading-6 text-[#526b84]">{item.description}</p>{item.sources.length > 0 && <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">{item.sources.map(source => <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-[#087fa5] underline-offset-4 hover:underline">{source.title}<ExternalLink className="size-3.5" aria-hidden="true" /></a>)}</div>}<p className="mt-3 text-xs text-[#60748a]">Source review date: {item.sources[0]?.checkedOn || 'Review required'}</p></article>
}

function AuditPanel({ context }: { context: CompanyContextValue }) {
  const [query, setQuery] = useState('')
  const rows = context.audit.filter(row => [row.action, row.actorEmail, row.actorUid, row.summary, row.type].some(value => typeof value === 'string' && value.toLowerCase().includes(query.trim().toLowerCase())))
  return <section className={`${panel} overflow-hidden`}><div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-base font-semibold">Company activity</h2><p className="mt-1 text-sm text-[#60748a]">A read-only record of changes, access updates, and review decisions.</p></div><label className="block sm:max-w-64"><span className="sr-only">Filter activity</span><input type="search" className={input} value={query} onChange={event => setQuery(event.target.value)} placeholder="Filter recent activity" /></label></div>{rows.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-y border-[#e7edf3] bg-[#f7f9fc] text-xs text-[#60748a]"><tr><th className="px-5 py-3 font-medium">Date & time</th><th className="px-5 py-3 font-medium">Activity</th><th className="px-5 py-3 font-medium">User</th><th className="px-5 py-3 font-medium">Details</th></tr></thead><tbody>{rows.map(row => <tr key={row.id} className="border-b border-[#e7edf3] last:border-0"><td className="whitespace-nowrap px-5 py-4 text-[#60748a]">{displayDate(row.createdAt)}</td><td className="px-5 py-4 font-medium">{textValue(row.action, textValue(row.type)).replaceAll('_', ' ')}</td><td className="px-5 py-4">{textValue(row.actorEmail, textValue(row.actorUid))}</td><td className="min-w-56 px-5 py-4 text-[#60748a]">{textValue(row.summary, textValue(row.description, textValue(row.reason)))}</td></tr>)}</tbody></table></div> : <EmptyState title={query ? 'No matching activity' : 'No activity yet'}>{query ? 'Try another person or activity in the records shown.' : 'Company activity will appear here as changes are recorded.'}</EmptyState>}<p className="border-t border-[#e7edf3] px-5 py-3 text-xs text-[#60748a]">Showing up to 100 recent events. Activity records cannot be edited from this screen.</p></section>
}

export function CompanyPanels({ section }: { section: string }) {
  const context = useCompany()
  if (!context || context.loading) return <Notice>Loading your company…</Notice>
  if (!context.membership?.active) return <Notice error>{context.error || 'An active company membership is required to view this page.'}</Notice>
  if (!context.company) return <Notice error={Boolean(context.error)}>{context.error || 'Loading company records…'}</Notice>
  if (!['company', 'team', 'approvals', 'compliance', 'audit'].includes(section)) return <Notice error>This company section is unavailable.</Notice>
  return <div className="space-y-5 text-sm text-[#15385d]">{context.error && <Notice error>{context.error}</Notice>}
    {section === 'company' && <section className={`${panel} p-5 sm:p-6`}><p className="mb-5 inline-flex flex-wrap items-center gap-2 rounded-md bg-[#f0f5fa] px-3 py-2 text-xs text-[#60748a]">Company code <span className="select-all font-mono font-semibold text-[#15385d]">{context.company.companyCode}</span></p><CompanyProfileForm key={JSON.stringify(context.company.profile)} initial={context.company.profile} readOnly={context.membership.role !== 'admin'} onSave={profile => context.invoke('companyUpdateProfile', { profile })} /></section>}
    {section === 'team' && <TeamPanel context={context} />}
    {section === 'approvals' && <ApprovalsPanel context={context} />}
    {section === 'compliance' && <CompliancePanel profile={context.company.profile} />}
    {section === 'audit' && <AuditPanel context={context} />}
  </div>
}
