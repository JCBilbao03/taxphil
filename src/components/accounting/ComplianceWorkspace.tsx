import { useContext, useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { BookOpen, CheckCircle2, ClipboardList, Download, ExternalLink, Plus, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EvidenceFiles } from './EvidenceFiles'
import { RegulatoryFeed } from './RegulatoryFeed'
import { useCompany, type CompanyContextValue } from '@/hooks/useCompany'
import { CompanyRecordsPreview } from '@/hooks/useCompanyRecords'
import { db } from '@/lib/firebase'
import { PH_COMPLIANCE_SOURCES } from '@/lib/ph-compliance'
import { actualDate, safeSourceUrl, taskStatuses, validateComplianceTask, validateRegulation, type ComplianceTask, type ComplianceTaskStatus, type EvidenceFile, type RegulationRecord } from '@/lib/compliance-records'
import { downloadTrackingCsv, todayManila } from '@/lib/tax-workflows'
import { canEditTask, filterComplianceTasks, filterRegulations, isClosedTask, isManager, isOverdueTask, statusLabels, type RecordMetadata, type RegulationRow, type TaskRow } from './ComplianceWorkspace.helpers'

type Section = 'library' | 'compliance-tracker'
type Editor = { id?: string; version: number; value: RegulationRecord | ComplianceTask }
const panel = 'rounded-xl border border-[#dce5ee] bg-white shadow-[0_2px_7px_rgba(20,49,79,0.025)]'
const input = 'w-full rounded-lg border border-[#cfdae5] bg-white px-3 py-2.5 text-sm text-[#15385d] outline-none focus:border-[#087cc1] focus:ring-2 focus:ring-[#087cc1]/15 disabled:bg-[#f5f7fa] disabled:text-[#526b84]'
const primary = 'rounded-lg bg-[#087cc1] px-4 text-white hover:bg-[#096da7]'
const agencies = ['BIR', 'SEC', 'LGU', 'SSS', 'PhilHealth', 'Pag-IBIG', 'DTI', 'DOLE', 'Other']
const kinds = ['Revenue Regulations', 'Revenue Memorandum Circular', 'Revenue Memorandum Order', 'Memorandum Circular', 'Law', 'Local ordinance', 'Guidance', 'Other']
const emptyRegulation = (): RegulationRecord => ({ title: '', agency: 'BIR', number: '', year: '', kind: 'Guidance', url: '', issuedOn: '', effectiveOn: '', reviewedOn: '', amends: '', notes: '', attachments: [] })
const emptyTask = (uid: string): ComplianceTask => ({ title: '', agency: 'BIR', period: '', sourceUrl: '', assignedTo: uid, dueDate: '', status: 'needs_review', notes: '', filingDate: '', filingReference: '', evidenceUrl: '', attachments: [] })
const causeMessage = (cause: unknown) => cause instanceof Error ? cause.message : 'This record could not be saved. Please try again.'
const dateLabel = (value: string) => value && actualDate(value) ? new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(value + 'T00:00:00Z')) : 'Not recorded'
function metadata(id: string, data: Record<string, unknown>): RecordMetadata {
  if (!Number.isSafeInteger(data.version) || Number(data.version) < 1 || typeof data.createdBy !== 'string') throw Error('A company record needs a data review. Contact your Company Admin.')
  return { id, version: Number(data.version), createdBy: data.createdBy, createdAt: String(data.createdAt || ''), updatedAt: String(data.updatedAt || '') }
}

function Notice({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return <div role={error ? 'alert' : 'status'} className={`rounded-lg border px-4 py-3 text-sm leading-6 ${error ? 'border-red-200 bg-red-50 text-red-800' : 'border-[#cfe4ee] bg-[#eff8fc] text-[#365f7b]'}`}>{children}</div>
}
function SourceLink({ url, children }: { url: string; children: ReactNode }) {
  return safeSourceUrl(url) ? <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[#0876b3] underline-offset-4 hover:underline">{children}<ExternalLink className="size-3.5 shrink-0" aria-hidden="true" /></a> : null
}
function SupportingFiles({ files }: { files: EvidenceFile[] }) {
  return files.length > 0 ? <div className="mt-3"><p className="mb-2 font-medium">Supporting documents</p><EvidenceFiles value={files} /></div> : null
}
function Field({ label, children, wide = false, hint }: { label: string; children: ReactNode; wide?: boolean; hint?: string }) {
  return <label className={`grid content-start gap-1.5 text-sm font-medium text-[#294b6d] ${wide ? 'sm:col-span-2' : ''}`}><span>{label}</span>{children}{hint && <span className="text-xs font-normal leading-5 text-[#60748a]">{hint}</span>}</label>
}

export function ComplianceWorkspace({ section }: { section: Section }) {
  const context = useCompany()
  if (!context?.membership?.active) return <Notice error>Active company access is required to open these records.</Notice>
  return <Workspace key={`${context.membership.companyId}:${context.membership.uid}:${context.membership.role}:${section}`} section={section} context={context} />
}

function Workspace({ section, context }: { section: Section; context: CompanyContextValue }) {
  const member = context.membership!
  const preview = useContext(CompanyRecordsPreview)
  const library = section === 'library'
  const manager = isManager(member.role)
  const canCreate = library ? manager : member.role !== 'viewer'
  const [storedRegulations, setRegulations] = useState<RegulationRow[]>([])
  const [storedTasks, setTasks] = useState<TaskRow[]>([])
  const [storedLoading, setLoading] = useState(true), [loadError, setLoadError] = useState(''), [retry, setRetry] = useState(0)
  const regulations = preview ? (preview.regulations || []) as RegulationRow[] : storedRegulations
  const tasks = preview ? (preview.complianceTasks || []) as TaskRow[] : storedTasks
  const loading = preview ? false : storedLoading
  const [editor, setEditor] = useState<Editor | null>(null), [confirmed, setConfirmed] = useState(false)
  const [saving, setSaving] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('')
  const [fileBusy, setFileBusy] = useState(false)
  const [search, setSearch] = useState(''), [agency, setAgency] = useState(''), [kind, setKind] = useState(''), [status, setStatus] = useState(''), [owner, setOwner] = useState('')
  const [today, setToday] = useState(todayManila)
  const savingRef = useRef(false)
  const formId = useId()
  const editorOpen = Boolean(editor)
  useEffect(() => {
    if (preview) return
    return onSnapshot(collection(db, 'companies', member.companyId, library ? 'regulations' : 'complianceTasks'), snapshot => {
      try {
        if (library) setRegulations(snapshot.docs.map(row => ({ ...validateRegulation(row.data(), member.companyId), ...metadata(row.id, row.data()) })))
        else setTasks(snapshot.docs.map(row => ({ ...validateComplianceTask(row.data(), member.companyId), ...metadata(row.id, row.data()) })))
        setLoadError('')
      } catch (cause) { setLoadError(causeMessage(cause)) }
      setLoading(false)
    }, () => { setLoading(false); setLoadError('Company records could not be loaded. Check your connection and company access, then retry.') })
  }, [member.companyId, library, retry, preview])
  useEffect(() => { if (editorOpen) document.getElementById(`${formId}-title`)?.focus() }, [editorOpen, editor?.id, formId])
  useEffect(() => { const timer = setInterval(() => setToday(todayManila()), 60000); return () => clearInterval(timer) }, [])
  const rows = library ? regulations : tasks
  const latest = editor?.id ? rows.find(row => row.id === editor.id) : undefined
  const stale = Boolean(editor?.id && !loading && (!latest || latest.version !== editor.version))
  const busy = saving || context.busy || fileBusy
  const ready = !loading && !loadError
  const visibleRegulations = filterRegulations(regulations, search, agency, kind)
  const visibleTasks = filterComplianceTasks(tasks, search, agency, status, owner, today)
  const agencyChoices = [...new Set([...agencies, ...rows.map(row => row.agency)])].sort()
  const ownerLabel = (uid: string) => uid ? context.members.find(person => person.uid === uid)?.displayName || context.members.find(person => person.uid === uid)?.email || 'Former or unavailable member' : 'Unassigned'
  function start(value?: RegulationRow | TaskRow) {
    setEditor(value ? { id: value.id, version: value.version, value: library ? validateRegulation(value, member.companyId) : validateComplianceTask(value, member.companyId) } : { version: 0, value: library ? emptyRegulation() : emptyTask(member.uid) })
    setError(''); setMessage(''); setConfirmed(false)
  }
  function change(field: string, value: string) {
    setEditor(current => current ? { ...current, value: { ...current.value, [field]: value } } : null)
    setError(''); setConfirmed(false)
  }
  async function save(event: FormEvent) {
    event.preventDefault()
    if (!editor || savingRef.current || busy || !ready || stale || !canCreate) return
    setError(''); setMessage('')
    if (!library && editor.id && (!latest || !canEditTask(member.role, member.uid, latest as TaskRow))) { setError('Your role cannot update this task.'); return }
    let clean: RegulationRecord | ComplianceTask
    try {
      clean = library ? validateRegulation(editor.value, member.companyId) : validateComplianceTask(editor.value, member.companyId)
      if ('status' in clean) {
        if (isClosedTask(clean) && !manager) throw Error('A Company Admin or Accounting Manager must record filing or non-applicability.')
        if (member.role === 'accountant') clean.assignedTo = member.uid
        if (clean.status === 'filed' && (!confirmed || clean.filingDate > todayManila())) throw Error('Confirm that the filing occurred and enter a filing date no later than today in the Philippines.')
      }
    } catch (cause) { setError(causeMessage(cause)); return }
    savingRef.current = true; setSaving(true)
    try {
      await context.invoke('companyWorkflowSave', { collection: library ? 'regulations' : 'complianceTasks', ...(editor.id ? { id: editor.id } : {}), expectedVersion: editor.version, value: clean })
      setEditor(null); setConfirmed(false); setMessage(library ? 'Regulatory reference saved to this company’s library.' : 'Compliance task saved. Its status reflects the review recorded by your team.')
    } catch (cause) { setError(causeMessage(cause)) }
    finally { savingRef.current = false; setSaving(false) }
  }
  function exportRecords() {
    if (!ready) return
    const exportRows: (string | number)[][] = library
      ? [['Title', 'Agency', 'Issuance number', 'Year', 'Type', 'Official source', 'Issued', 'Effective', 'Reviewed', 'Amends or supersedes', 'Notes', 'Version'], ...visibleRegulations.map(row => [row.title, row.agency, row.number, row.year, row.kind, row.url, row.issuedOn, row.effectiveOn, row.reviewedOn, row.amends, row.notes, row.version])]
      : [['Obligation', 'Agency', 'Period', 'Owner', 'Due date', 'Review status', 'Overdue as of ' + today, 'Source', 'Notes', 'Filing date', 'Acknowledgment', 'Evidence URL', 'Version'], ...visibleTasks.map(row => [row.title, row.agency, row.period, ownerLabel(row.assignedTo), row.dueDate, statusLabels[row.status], isOverdueTask(row, today) ? 'Yes' : 'No', row.sourceUrl, row.notes, row.filingDate, row.filingReference, row.evidenceUrl, row.version])]
    downloadTrackingCsv(`${library ? 'regulatory-library' : 'compliance-tracker'}-${today}.csv`, exportRows)
  }
  const metrics = library
    ? [['Company references', regulations.length], ['Agencies represented', new Set(regulations.map(row => row.agency)).size], ['With review date', regulations.filter(row => row.reviewedOn).length]] as const
    : [['Open obligations', tasks.filter(row => !isClosedTask(row)).length], ['Past recorded due date', tasks.filter(row => isOverdueTask(row, today)).length], ['Ready for manager review', tasks.filter(row => row.status === 'ready_for_review').length]] as const
  return <div className="ubb-workspace">
    <header className="ubb-page-heading"><div><p className="ubb-eyebrow">Company compliance</p><h1>{library ? 'Regulatory Library' : 'Compliance Tracker'}</h1><p className="ubb-page-description">{library ? 'Keep official issuances, amendment references and your company’s review notes together.' : 'Assign obligations, track reviewed dates, and retain filing acknowledgments for your company.'}</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={exportRecords} disabled={!ready || busy || !(library ? visibleRegulations.length : visibleTasks.length)}><Download className="mr-2 size-4" />Export CSV</Button>{canCreate && <Button className={primary} disabled={!ready || busy || editorOpen} onClick={() => start()}><Plus className="mr-2 size-4" />{library ? 'Add reference' : 'Add obligation'}</Button>}</div></header>
    <div className="grid gap-4 sm:grid-cols-3">{metrics.map(([label, total]) => <div key={label} className={`${panel} px-5 py-4`}><p className="text-sm text-[#62788d]">{label}</p><p className="mt-2 text-3xl font-semibold tabular-nums text-[#173b61]">{loading ? '…' : loadError ? '—' : total}</p></div>)}</div>
    <Notice>{library ? 'Company Admins and Accounting Managers maintain this library. A saved reference or review date records your team’s review; applicability must be assessed for this company and period.' : 'Enter due dates confirmed for your company and period. Accountants maintain their assigned tasks; a Company Admin or Accounting Manager records filing or non-applicability. Recorded filing does not submit a return or confirm agency acceptance.'}</Notice>
    {library && <RegulatoryFeed disabled={!ready || busy || editorOpen} onAdd={manager ? value => { setEditor({ version: 0, value }); setError(''); setMessage(''); setConfirmed(false) } : undefined} />}
    {loadError && <Notice error>{loadError}<Button variant="outline" className="ml-3" disabled={busy} onClick={() => { setLoading(true); setLoadError(''); setRegulations([]); setTasks([]); setRetry(value => value + 1) }}>Retry loading</Button></Notice>}
    {error && <Notice error>{error}</Notice>}{message && <Notice>{message}</Notice>}
    {editor && <form onSubmit={save} className={`${panel} p-5 sm:p-6`} aria-busy={busy}>
      <div className="mb-5 flex items-center justify-between gap-4"><h2 className="text-lg font-semibold text-[#173b61]">{editor.id ? 'Edit' : 'New'} {library ? 'regulatory reference' : 'compliance obligation'}</h2><Button type="button" variant="ghost" disabled={busy} aria-label="Close editor" onClick={() => { setEditor(null); setError('') }}><X className="size-4" /></Button></div>
      {stale && <div className="mb-4"><Notice error>This record changed since you opened it. Your unsaved edits have been kept. Reload the current record before making further changes.{latest && <Button type="button" variant="outline" className="ml-2" disabled={busy} onClick={() => start(latest)}>Reload current record</Button>}</Notice></div>}
      <fieldset disabled={busy || !ready || stale} className="grid gap-5 sm:grid-cols-2">
        <Field label={library ? 'Title *' : 'Obligation *'} wide><input id={`${formId}-title`} className={input} maxLength={300} required value={editor.value.title} onChange={event => change('title', event.target.value)} /></Field>
        <Field label="Agency *"><input className={input} list={`${formId}-agencies`} maxLength={60} required value={editor.value.agency} onChange={event => change('agency', event.target.value)} /><datalist id={`${formId}-agencies`}>{agencyChoices.map(item => <option key={item} value={item} />)}</datalist></Field>
        {'kind' in editor.value ? <>
          <Field label="Issuance type *"><input className={input} list={`${formId}-kinds`} maxLength={40} required value={editor.value.kind} onChange={event => change('kind', event.target.value)} /><datalist id={`${formId}-kinds`}>{kinds.map(item => <option key={item} value={item} />)}</datalist></Field>
          <Field label="Issuance number"><input className={input} maxLength={100} placeholder="e.g. RR 7-2024" value={editor.value.number} onChange={event => change('number', event.target.value)} /></Field>
          <Field label="Issuance year"><input className={input} maxLength={4} inputMode="numeric" pattern="[0-9]{4}" placeholder="YYYY" value={editor.value.year} onChange={event => change('year', event.target.value)} /></Field>
          <Field label="Official source URL" wide hint="Use an HTTPS link to the official issuance or agency page."><input className={input} maxLength={2000} type="url" placeholder="https://" value={editor.value.url} onChange={event => change('url', event.target.value)} required={!editor.value.attachments.length} /></Field>
          <Field label="Issued date"><input className={input} type="date" value={editor.value.issuedOn} onChange={event => change('issuedOn', event.target.value)} /></Field>
          <Field label="Effective date" hint="Record only a date confirmed in the issuance."><input className={input} type="date" value={editor.value.effectiveOn} onChange={event => change('effectiveOn', event.target.value)} /></Field>
          <Field label="Company review date"><input className={input} type="date" max={today} value={editor.value.reviewedOn} onChange={event => change('reviewedOn', event.target.value)} /></Field>
          <Field label="Amends or supersedes"><input className={input} maxLength={500} placeholder="Related issuance numbers" value={editor.value.amends} onChange={event => change('amends', event.target.value)} /></Field>
        </> : <>
          <Field label="Reporting period"><input className={input} maxLength={100} placeholder="e.g. 2026 Q3" value={editor.value.period} onChange={event => change('period', event.target.value)} /></Field>
          <Field label="Assigned owner"><select className={input} value={member.role === 'accountant' ? member.uid : editor.value.assignedTo} disabled={member.role === 'accountant'} onChange={event => change('assignedTo', event.target.value)}><option value="">Unassigned</option>{context.members.filter(person => person.active && person.role !== 'viewer').map(person => <option key={person.uid} value={person.uid}>{person.displayName || person.email}{person.uid === member.uid ? ' (you)' : ''}</option>)}{editor.value.assignedTo && !context.members.some(person => person.uid === (editor.value as ComplianceTask).assignedTo && person.active && person.role !== 'viewer') && <option value={editor.value.assignedTo}>Former or unavailable member — reassign</option>}</select></Field>
          <Field label="Confirmed due date" hint="Leave blank until the applicable due date is established."><input className={input} type="date" value={editor.value.dueDate} onChange={event => change('dueDate', event.target.value)} /></Field>
          <Field label="Review status *"><select className={input} value={editor.value.status} onChange={event => change('status', event.target.value)}>{taskStatuses.filter(item => manager || !['filed', 'not_applicable'].includes(item)).map(item => <option key={item} value={item}>{statusLabels[item]}</option>)}</select></Field>
          <Field label="Official requirement or source URL"><input className={input} type="url" placeholder="https://" maxLength={2000} value={editor.value.sourceUrl} onChange={event => change('sourceUrl', event.target.value)} /></Field>
          <div className="rounded-lg border border-[#dce5ee] bg-[#f7fafc] px-4 py-3 sm:col-span-2"><p className="font-medium text-[#294b6d]">Filing evidence</p><p className="mt-1 text-xs leading-5 text-[#60748a]">For completed submissions, keep the actual filing date, acknowledgment reference and evidence. An evidence link is required to record filing when no supporting file is attached.</p><div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label={`Actual filing date${editor.value.status === 'filed' ? ' *' : ''}`}><input className={input} type="date" max={today} required={editor.value.status === 'filed'} value={editor.value.filingDate} onChange={event => change('filingDate', event.target.value)} /></Field>
            <Field label={`Acknowledgment or reference${editor.value.status === 'filed' ? ' *' : ''}`}><input className={input} maxLength={200} required={editor.value.status === 'filed'} value={editor.value.filingReference} onChange={event => change('filingReference', event.target.value)} /></Field>
            <Field label="Evidence URL" wide hint="Use an HTTPS link with access limited to the people who need this evidence."><input className={input} type="url" maxLength={2000} placeholder="https://" required={editor.value.status === 'filed' && !editor.value.attachments.length} value={editor.value.evidenceUrl} onChange={event => change('evidenceUrl', event.target.value)} /></Field>
          </div></div>
        </>}
        <Field label={'status' in editor.value && editor.value.status === 'not_applicable' ? 'Reason this obligation does not apply *' : 'Company review notes'} wide><textarea className={`${input} min-h-28`} maxLength={4000} required={'status' in editor.value && editor.value.status === 'not_applicable'} value={editor.value.notes} onChange={event => change('notes', event.target.value)} /></Field>
        <div className="text-sm text-[#526b84] sm:col-span-2"><EvidenceFiles value={editor.value.attachments} disabled={busy || !ready || stale} onBusy={setFileBusy} onChange={attachments => { setEditor(current => current ? { ...current, value: { ...current.value, attachments } } : null); setConfirmed(false); setError('') }} /></div>
        {'status' in editor.value && editor.value.status === 'filed' && <label className="flex items-start gap-3 rounded-lg border border-[#cfe4ee] bg-[#eff8fc] p-4 text-sm leading-6 text-[#365f7b] sm:col-span-2"><input className="mt-1 size-4 shrink-0 accent-[#087cc1]" type="checkbox" required checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /><span>I have reviewed the acknowledgment and evidence, and confirm that this filing has already occurred.</span></label>}
      </fieldset>
      <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-[#e7edf3] pt-5"><Button type="button" variant="outline" disabled={busy} onClick={() => { setEditor(null); setError('') }}>Cancel</Button><Button type="submit" className={primary} disabled={busy || !ready || stale}>{saving ? 'Saving…' : library ? 'Save reference' : 'Save obligation'}</Button></div>
    </form>}
    <section className={panel} aria-label={library ? 'Company regulatory references' : 'Company compliance obligations'}>
      <div className="flex flex-wrap items-end gap-3 border-b border-[#e3eaf0] p-4 sm:p-5"><label className="grid min-w-48 flex-1 gap-1.5 text-xs font-medium text-[#526b84]">Search<div className="relative"><Search className="pointer-events-none absolute left-3 top-3 size-4 text-[#7b92a6]" /><input className={`${input} pl-9`} type="search" maxLength={300} placeholder={library ? 'Title, issuance number or notes' : 'Obligation, period or reference'} value={search} onChange={event => setSearch(event.target.value)} /></div></label><label className="grid gap-1.5 text-xs font-medium text-[#526b84]">Agency<select className={input} value={agency} onChange={event => setAgency(event.target.value)}><option value="">All agencies</option>{agencyChoices.map(item => <option key={item} value={item}>{item}</option>)}</select></label>{library ? <label className="grid gap-1.5 text-xs font-medium text-[#526b84]">Issuance type<select className={input} value={kind} onChange={event => setKind(event.target.value)}><option value="">All types</option>{[...new Set(regulations.map(row => row.kind))].sort().map(item => <option key={item} value={item}>{item}</option>)}</select></label> : <><label className="grid gap-1.5 text-xs font-medium text-[#526b84]">Status<select className={input} value={status} onChange={event => setStatus(event.target.value)}><option value="">All statuses</option><option value="overdue">Past recorded due date</option>{taskStatuses.map(item => <option key={item} value={item}>{statusLabels[item]}</option>)}</select></label><label className="grid gap-1.5 text-xs font-medium text-[#526b84]">Owner<select className={input} value={owner} onChange={event => setOwner(event.target.value)}><option value="">Everyone</option><option value="__unassigned">Unassigned</option>{[...new Set([member.uid, ...tasks.map(row => row.assignedTo).filter(Boolean)])].map(uid => <option key={uid} value={uid}>{ownerLabel(uid)}{uid === member.uid ? ' (you)' : ''}</option>)}</select></label></>}</div>
      {loading ? <p role="status" className="p-10 text-center text-sm text-[#60748a]">Loading company records…</p> : loadError ? <p className="p-10 text-center text-sm text-[#60748a]">Records are unavailable until the loading issue is resolved.</p> : (library ? visibleRegulations.length : visibleTasks.length) === 0 ? <div className="px-5 py-12 text-center">{library ? <BookOpen className="mx-auto mb-3 size-8 text-[#8fa5b9]" /> : <ClipboardList className="mx-auto mb-3 size-8 text-[#8fa5b9]" />}<h2 className="font-semibold text-[#294b6d]">{rows.length ? 'No matching records' : library ? 'Start your company’s reference library' : 'No company obligations recorded yet'}</h2><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[#60748a]">{rows.length ? 'Adjust the search or filters to see other records.' : library ? 'Use the official links below for research, then save references with the notes relevant to your company.' : 'An empty tracker does not establish that no filings are due. Add obligations after reviewing the company registration and applicable rules.'}</p></div> : <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-[#f7f9fc] text-xs text-[#526b84]"><tr><th className="px-5 py-3">{library ? 'Reference' : 'Obligation'}</th><th className="px-5 py-3">{library ? 'Type / agency' : 'Owner'}</th><th className="px-5 py-3">{library ? 'Dates' : 'Due date'}</th><th className="px-5 py-3">{library ? 'Review' : 'Status'}</th><th className="px-5 py-3"><span className="sr-only">Actions</span></th></tr></thead><tbody>{library ? visibleRegulations.map(row => <tr key={row.id} className="border-t border-[#e5ecf2] align-top"><td className="max-w-sm px-5 py-4"><p className="font-semibold text-[#294b6d]">{row.title}</p><p className="mt-1 text-xs text-[#60748a]">{[row.number, row.year].filter(Boolean).join(' · ') || 'Number not recorded'}</p><div className="mt-2 text-xs"><SourceLink url={row.url}>Official source</SourceLink></div><details className="mt-3 text-xs leading-6 text-[#526b84]"><summary className="cursor-pointer text-[#0876b3]">Review notes & details</summary><p className="mt-2 whitespace-pre-wrap">{row.notes || 'No company review notes yet.'}</p><p className="mt-2">Amends or supersedes: {row.amends || 'Not recorded'}</p><SupportingFiles files={row.attachments} /><p className="mt-2 text-[#7c8fa0]">Version {row.version}</p></details></td><td className="px-5 py-4 text-[#526b84]"><p>{row.kind}</p><p className="mt-1 text-xs">{row.agency}</p></td><td className="px-5 py-4 text-xs leading-6 text-[#526b84]"><p>Issued: {dateLabel(row.issuedOn)}</p><p>Effective: {dateLabel(row.effectiveOn)}</p></td><td className="px-5 py-4 text-xs leading-6 text-[#526b84]">{row.reviewedOn ? <><span className="inline-flex items-center gap-1 text-[#28704f]"><CheckCircle2 className="size-3.5" />Review recorded</span><p>{dateLabel(row.reviewedOn)}</p></> : 'Review date not recorded'}</td><td className="px-5 py-4 text-right">{manager && <Button variant="outline" disabled={busy || editorOpen} onClick={() => start(row)}>Edit</Button>}</td></tr>) : visibleTasks.map(row => <tr key={row.id} className="border-t border-[#e5ecf2] align-top"><td className="max-w-sm px-5 py-4"><p className="font-semibold text-[#294b6d]">{row.title}</p><p className="mt-1 text-xs text-[#60748a]">{[row.agency, row.period].filter(Boolean).join(' · ')}</p><details className="mt-3 text-xs leading-6 text-[#526b84]"><summary className="cursor-pointer text-[#0876b3]">Review notes & evidence</summary><div className="mt-2"><SourceLink url={row.sourceUrl}>Requirement source</SourceLink></div><p className="mt-2 whitespace-pre-wrap">{row.notes || 'No review notes recorded.'}</p>{(row.filingDate || row.filingReference || row.evidenceUrl) && <div className="mt-3 border-l-2 border-[#b8d9ea] pl-3"><p className="font-medium">{row.status === 'filed' ? 'Recorded filing evidence' : 'Retained filing evidence'}</p><p>Date: {dateLabel(row.filingDate)}</p><p className="break-words">Acknowledgment: {row.filingReference || 'Not recorded'}</p><SourceLink url={row.evidenceUrl}>View evidence</SourceLink></div>}<SupportingFiles files={row.attachments} /><p className="mt-2 text-[#7c8fa0]">Version {row.version}</p></details></td><td className="px-5 py-4 text-[#526b84]">{ownerLabel(row.assignedTo)}</td><td className="px-5 py-4 text-xs leading-6 text-[#526b84]"><p>{row.dueDate ? dateLabel(row.dueDate) : 'Awaiting date review'}</p>{isOverdueTask(row, today) && <span className="text-red-700">Past recorded due date</span>}</td><td className="px-5 py-4"><StatusBadge status={row.status} /></td><td className="px-5 py-4 text-right">{canEditTask(member.role, member.uid, row) && <Button variant="outline" disabled={busy || editorOpen} onClick={() => start(row)}>{isClosedTask(row) ? 'Review / reopen' : 'Edit'}</Button>}</td></tr>)}</tbody></table><p className="border-t border-[#e5ecf2] px-5 py-3 text-xs text-[#647a8e]">Showing {library ? visibleRegulations.length : visibleTasks.length} of {rows.length} company records</p></div>}
    </section>
    {library && <OfficialSources />}
  </div>
}

function StatusBadge({ status }: { status: ComplianceTaskStatus }) {
  const color = status === 'filed' ? 'bg-[#eaf5ef] text-[#28704f]' : status === 'ready_for_review' ? 'bg-[#eaf3fb] text-[#126da5]' : status === 'not_applicable' ? 'bg-[#f0f2f5] text-[#617083]' : 'bg-amber-50 text-amber-800'
  return <span className={`inline-flex rounded-md px-2.5 py-1 text-xs leading-5 ${color}`}>{statusLabels[status]}</span>
}

function OfficialSources() {
  const selected = [PH_COMPLIANCE_SOURCES.invoicing, PH_COMPLIANCE_SOURCES.invoiceTransition, PH_COMPLIANCE_SOURCES.electronicInvoices, PH_COMPLIANCE_SOURCES.electronicInvoiceTransition, PH_COMPLIANCE_SOURCES.cas, PH_COMPLIANCE_SOURCES.secReporting, PH_COMPLIANCE_SOURCES.sss, PH_COMPLIANCE_SOURCES.philhealth, PH_COMPLIANCE_SOURCES.pagibig]
  return <section className={`${panel} p-5 sm:p-6`}><h2 className="flex items-center gap-2 text-base font-semibold text-[#294b6d]"><BookOpen className="size-5 text-[#087cc1]" />Selected official references</h2><p className="mt-2 text-sm leading-6 text-[#60748a]">Reference links for Philippine company reviews. These shared links are read-only and do not add obligations or review dates to your company records.</p><div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{selected.map(source => <div key={source.url} className="rounded-lg border border-[#e3ebf2] bg-[#fbfcfe] p-4"><div className="text-sm leading-6"><SourceLink url={source.url}>{source.title}</SourceLink></div><p className="mt-2 text-xs text-[#74899d]">Source checked {dateLabel(source.checkedOn)}</p></div>)}</div></section>
}
