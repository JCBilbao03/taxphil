import { useEffect, useRef, useState, type FormEvent } from 'react'
import { CalendarDays, CheckCircle2, ExternalLink, Loader2, MessageSquare, Plus, Users, Video } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useConsultations } from '@/hooks/useConsultations'
import { createConsultation, updateConsultation } from '@/lib/consultation-service'
import { CONSULTATION_STATUS, consultationCalendar, formatConsultationDate, manilaDateTimeToISO, normalizeMeetingUrl, toManilaDateTime, validateConsultationRequest, type Consultation, type ConsultationAction, type ConsultationKind } from '@/lib/consultations'
import { useConnectStore } from '@/store/useConnectStore'

const control = 'min-h-10 w-full rounded-lg border border-input bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30'
const label = 'flex flex-col gap-2 text-sm font-medium text-slate-700'

function downloadCalendar(record: Consultation) {
  const url = URL.createObjectURL(new Blob([consultationCalendar(record)], { type: 'text/calendar;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url; anchor.download = `taxphil-consultation-${record.id}.ics`; anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Could not save your request. Please try again.'
}

function RequestForm({ kind, onSaved }: { kind: ConsultationKind; onSaved: () => void }) {
  const [topic, setTopic] = useState('')
  const [notes, setNotes] = useState('')
  const [preferredAt, setPreferredAt] = useState('')
  const [participants, setParticipants] = useState(kind === 'individual' ? 1 : 2)
  const [durationMinutes, setDuration] = useState(30)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const attempt = useRef<{ id: string; payload: string } | null>(null)
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(''); setBusy(true)
    try {
      const details = validateConsultationRequest({ kind, topic, notes, preferredAt: manilaDateTimeToISO(preferredAt), participants, durationMinutes })
      const payload = JSON.stringify(details)
      if (attempt.current?.payload !== payload) attempt.current = { id: crypto.randomUUID(), payload }
      await createConsultation(details, attempt.current!.id)
      onSaved()
    } catch (error) { setError(errorMessage(error)) } finally { setBusy(false) }
  }
  return <form onSubmit={(event) => void submit(event)} className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
    <div><h2 className="text-lg font-semibold text-slate-900">Request a {kind === 'group' ? 'group session' : 'consultation'}</h2><p className="mt-1 text-sm leading-6 text-slate-500">Choose your preferred time. TaxPhil Support will review your request and confirm the advisor, schedule, and meeting link here.</p></div>
    <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
      <label className={`${label} sm:col-span-2`}>What would you like to discuss?<Input required maxLength={120} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Review of quarterly VAT records" /></label>
      <label className={label}>Preferred date and time (Philippines)<Input required type="datetime-local" min={toManilaDateTime(new Date().toISOString())} value={preferredAt} onChange={(e) => setPreferredAt(e.target.value)} /></label>
      <label className={label}>Duration<select className={control} value={durationMinutes} onChange={(e) => setDuration(Number(e.target.value))}><option value={30}>30 minutes</option><option value={60}>60 minutes</option></select></label>
      {kind === 'group' ? <label className={label}>Total participants (including you)<Input type="number" required min={2} max={20} value={participants} onChange={(e) => setParticipants(Number(e.target.value))} /></label> : null}
      <label className={`${label} sm:col-span-2`}>Notes (optional)<textarea className={control} rows={4} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Provide useful context. Keep passwords and payment details out of your notes." /></label>
    </fieldset>
    {error ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
    <div className="flex flex-wrap items-center gap-3"><Button disabled={busy} type="submit">{busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}Submit request</Button><p className="text-xs text-slate-500">Your preferred time is confirmed only after review.</p></div>
  </form>
}

function ManageConsultation({ record, onClose }: { record: Consultation; onClose: () => void }) {
  const [clock, setClock] = useState(() => Date.now())
  useEffect(() => { const timer = setInterval(() => setClock(Date.now()), 30_000); return () => clearInterval(timer) }, [])
  const [scheduledAt, setScheduledAt] = useState(toManilaDateTime(record.scheduledAt || record.preferredAt))
  const [meetingUrl, setMeetingUrl] = useState(record.meetingUrl || '')
  const [advisorName, setAdvisorName] = useState(record.advisorName || '')
  const [responseNote, setResponseNote] = useState(record.responseNote || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function save(type: ConsultationAction['type']) {
    setError(''); setBusy(true)
    try {
      const action: ConsultationAction = type === 'confirm'
        ? { type, scheduledAt: manilaDateTimeToISO(scheduledAt), meetingUrl: normalizeMeetingUrl(meetingUrl), advisorName, responseNote }
        : { type, responseNote }
      await updateConsultation(record, action); onClose()
    } catch (error) { setError(errorMessage(error)) } finally { setBusy(false) }
  }
  return <form onSubmit={(e) => { e.preventDefault(); void save('confirm') }} className="mt-4 space-y-4 rounded-lg border border-blue-200 bg-blue-50/50 p-4">
    <h3 className="font-semibold text-slate-900">{record.status === 'confirmed' ? 'Update confirmed session' : 'Confirm a session'}</h3>
    <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
      <label className={label}>Confirmed time (Philippines)<Input required type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} /></label>
      <label className={label}>Advisor name<Input required maxLength={120} value={advisorName} onChange={(e) => setAdvisorName(e.target.value)} /></label>
      <label className={`${label} sm:col-span-2`}>Meeting link<Input required type="url" value={meetingUrl} onChange={(e) => setMeetingUrl(e.target.value)} placeholder="https://meet.google.com/..." /><span className="text-xs font-normal text-slate-500">Add an existing Google Meet, Zoom, or Microsoft Teams meeting. TaxPhil does not create the meeting.</span></label>
      <label className={`${label} sm:col-span-2`}>Message to customer<textarea className={control} maxLength={1000} rows={2} value={responseNote} onChange={(e) => setResponseNote(e.target.value)} placeholder="Explain schedule changes, instructions, or the reason for declining." /></label>
    </fieldset>
    {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
    <div className="flex flex-wrap gap-2"><Button type="submit" disabled={busy}>{busy ? <Loader2 className="size-4 animate-spin" /> : null}{record.status === 'confirmed' ? 'Save schedule' : 'Confirm session'}</Button><Button type="button" disabled={busy || !responseNote.trim()} variant="outline" onClick={() => void save('decline')}>Decline with reason</Button>{record.status === 'confirmed' ? <Button type="button" disabled={busy || Date.parse(record.scheduledAt || '') > clock} variant="outline" onClick={() => void save('complete')}>Mark completed</Button> : null}<Button type="button" disabled={busy} variant="ghost" onClick={onClose}>Close</Button></div>
  </form>
}

function ConsultationCard({ record, admin }: { record: Consultation; admin: boolean }) {
  const [managing, setManaging] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const active = record.status === 'requested' || record.status === 'confirmed'
  let meetingUrl: string | null = null
  try { if (record.status === 'confirmed') meetingUrl = normalizeMeetingUrl(record.meetingUrl) } catch { /* Invalid stored data must never produce an unsafe link. */ }
  async function cancel() {
    setError(''); setBusy(true)
    try { await updateConsultation(record, { type: 'cancel', responseNote: 'Cancelled by the customer.' }); setConfirmCancel(false) }
    catch (error) { setError(errorMessage(error)) } finally { setBusy(false) }
  }
  return <article className="rounded-xl border border-slate-200 bg-white p-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{record.kind === 'group' ? 'Group session' : 'Individual consultation'} · {record.durationMinutes} min</p><h3 className="font-semibold text-slate-900">{record.topic}</h3>{admin ? <p className="mt-1 text-sm text-slate-500">{record.ownerName} · {record.ownerEmail}</p> : null}</div><span className={`rounded-full px-3 py-1 text-xs font-semibold ${record.status === 'confirmed' ? 'bg-emerald-50 text-emerald-700' : record.status === 'requested' ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>{CONSULTATION_STATUS[record.status]}</span></div>
    <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-slate-500">{record.scheduledAt ? 'Scheduled time' : 'Requested time'}</dt><dd className="mt-1 font-medium text-slate-800">{formatConsultationDate(record.scheduledAt || record.preferredAt)}</dd></div><div><dt className="text-slate-500">{record.advisorName ? 'Advisor' : 'Participants'}</dt><dd className="mt-1 font-medium text-slate-800">{record.advisorName || `${record.participants} ${record.participants === 1 ? 'person' : 'people'}`}</dd></div></dl>
    {record.notes ? <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-600">{record.notes}</p> : null}
    {record.responseNote ? <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-700"><p className="mb-1 font-medium">Latest update</p><p className="whitespace-pre-wrap">{record.responseNote}</p></div> : null}
    {error ? <p role="alert" className="mt-3 text-sm text-red-700">{error}</p> : null}
    <div className="mt-4 flex flex-wrap gap-2">
      {meetingUrl ? <><a href={meetingUrl} target="_blank" rel="noopener noreferrer" className={buttonVariants({ size: 'sm' })}><ExternalLink className="size-4" />Open meeting</a><Button size="sm" variant="outline" onClick={() => { try { downloadCalendar(record) } catch (error) { setError(errorMessage(error)) } }}><CalendarDays className="size-4" />Add to calendar</Button></> : null}
      {admin && active ? <Button size="sm" variant="outline" onClick={() => setManaging(!managing)}>Manage request</Button> : null}
      {!admin && active ? <Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfirmCancel(!confirmCancel)}>Cancel request</Button> : null}
    </div>
    {meetingUrl ? <p className="mt-2 text-xs text-slate-500">Audio, camera, and screen sharing are available in the meeting provider. Calendar downloads do not send invitations.</p> : null}
    {confirmCancel && active ? <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg bg-amber-50 p-3"><p className="text-sm text-amber-900">Cancel this consultation?</p><Button size="sm" variant="destructive" disabled={busy} onClick={() => void cancel()}>Confirm cancellation</Button><Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfirmCancel(false)}>Keep request</Button></div> : null}
    {managing && active ? <ManageConsultation key={`${record.id}-${record.revision}`} record={record} onClose={() => setManaging(false)} /> : null}
  </article>
}

export function ConsultationWorkspace({ kind = 'individual', admin = false }: { kind?: ConsultationKind; admin?: boolean }) {
  const { records, loading, error } = useConsultations(admin)
  const [showForm, setShowForm] = useState(false)
  const [success, setSuccess] = useState(false)
  const [filter, setFilter] = useState('active')
  const [search, setSearch] = useState('')
  const setMode = useConnectStore((state) => state.setActiveMode)
  const scoped = admin ? records : records.filter((record) => record.kind === kind)
  const active = scoped.filter((record) => ['requested', 'confirmed'].includes(record.status))
  const displayed = (filter === 'active' ? active : scoped).filter((record) => `${record.topic} ${record.ownerName} ${record.ownerEmail} ${record.advisorName || ''}`.toLowerCase().includes(search.toLowerCase()))
  const Icon = kind === 'group' ? Users : Video
  return <section className="space-y-5">
    <div className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-start sm:p-6"><div className="flex gap-4"><div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-primary"><Icon className="size-6" /></div><div><h2 className="text-xl font-semibold text-slate-900">{admin ? 'Consultation desk' : kind === 'group' ? 'Group consultations' : 'One-to-one consultations'}</h2><p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">{admin ? 'Review requests, confirm an advisor and time, and share an existing meeting link with the customer.' : 'Arrange a session to discuss your tax or accounting questions. Requests and confirmed meeting details stay in your account.'}</p></div></div>{!admin ? <Button className="shrink-0" onClick={() => { setShowForm(!showForm); setSuccess(false) }}><Plus className="size-4" />{showForm ? 'Close form' : 'Request a session'}</Button> : null}</div>
    {success ? <p role="status" className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><CheckCircle2 className="size-4 shrink-0" />Request saved. Return here for the confirmed schedule and meeting details.</p> : null}
    {showForm && !admin ? <RequestForm key={kind} kind={kind} onSaved={() => { setSuccess(true); setShowForm(false); setFilter('active') }} /> : null}
    <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex gap-2"><Button size="sm" variant={filter === 'active' ? 'default' : 'outline'} onClick={() => setFilter('active')}>Active ({active.length})</Button><Button size="sm" variant={filter === 'all' ? 'default' : 'outline'} onClick={() => setFilter('all')}>All requests ({scoped.length})</Button></div><Input className="max-w-xs" aria-label="Search consultations" placeholder="Search consultations" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
    {loading ? <div role="status" className="flex items-center gap-2 py-8 text-sm text-slate-500"><Loader2 className="size-4 animate-spin" />Loading consultations…</div> : error ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700"><p className="font-semibold">Consultations could not be loaded.</p><p className="mt-1">{error}</p></div> : displayed.length ? <div className="space-y-4">{displayed.map((record) => <ConsultationCard key={record.id} record={record} admin={admin} />)}</div> : <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center"><CalendarDays className="mx-auto size-8 text-slate-400" /><h3 className="mt-3 font-semibold text-slate-800">{search ? 'No matching consultations' : filter === 'active' ? 'No active consultations' : 'No consultation requests yet'}</h3><p className="mt-2 text-sm text-slate-500">{admin ? 'Customer requests will appear here as they are submitted.' : 'Request a session above. A meeting link appears when support confirms it.'}</p></div>}
    {!admin ? <button type="button" className="flex items-center gap-2 text-sm font-medium text-primary hover:underline" onClick={() => setMode('chat')}><MessageSquare className="size-4" />Discuss your request with support</button> : null}
  </section>
}
