import { useContext, useEffect, useState } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { ExternalLink, RefreshCw } from 'lucide-react'
import { db } from '@/lib/firebase'
import { CompanyRecordsPreview } from '@/hooks/useCompanyRecords'
import { safeSourceUrl, type RegulationRecord } from '@/lib/compliance-records'
import { Button } from '@/components/ui/button'

type Update = { id: string; agency: string; code: string; title: string; url: string; sourceUrl: string; kind: string; issuedOn: string; firstSeenAt: string; lastSeenAt: string; lastChangedAt: string; sourceName: string }
type Sync = { id: string; name: string; sourceUrl: string; status: string; lastAttemptAt?: string; lastSuccessAt?: string; lastFailureAt?: string; lastError?: string; coverage?: string; foundCount?: number; newCount?: number }
const configured = [
  { id: 'bir-rr', name: 'BIR Revenue Regulations', sourceUrl: 'https://www.bir.gov.ph/revenue-issuances-details' },
  { id: 'bir-rmc', name: 'BIR Revenue Memorandum Circulars', sourceUrl: 'https://www.bir.gov.ph/revenue-issuances-details' },
  { id: 'bir-rmo', name: 'BIR Revenue Memorandum Orders', sourceUrl: 'https://www.bir.gov.ph/revenue-issuances-details' },
  { id: 'sec-mc', name: 'SEC recent Memorandum Circulars', sourceUrl: 'https://www.sec.gov.ph/' },
]
function moment(value?: string) {
  const date = value ? new Date(value) : null
  return date && Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' }).format(date) + ' PHT' : 'No successful check yet'
}
function External({ url, children }: { url: string; children: string }) {
  return safeSourceUrl(url) ? <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[#0876b3] hover:underline">{children}<ExternalLink className="size-3.5 shrink-0" /></a> : <span>{children}</span>
}
function safeUpdate(id: string, value: Record<string, unknown>): Update | null {
  if (!['BIR', 'SEC'].includes(String(value.agency)) || typeof value.url !== 'string' || !safeSourceUrl(value.url)) return null
  const host = new URL(value.url).hostname
  if (!['www.bir.gov.ph', 'bir.gov.ph', 'bir-cdn.bir.gov.ph', 'www.sec.gov.ph', 'sec.gov.ph'].includes(host)) return null
  return { id, agency: String(value.agency), code: String(value.code || '').slice(0, 100), title: String(value.title || '').slice(0, 1000), url: value.url, sourceUrl: String(value.sourceUrl || ''), kind: String(value.kind || 'Guidance'), issuedOn: String(value.issuedOn || ''), firstSeenAt: String(value.firstSeenAt || ''), lastSeenAt: String(value.lastSeenAt || ''), lastChangedAt: String(value.lastChangedAt || ''), sourceName: String(value.sourceName || '') }
}

export function RegulatoryFeed({ onAdd, disabled }: { onAdd?: (record: RegulationRecord) => void; disabled?: boolean }) {
  const preview = useContext(CompanyRecordsPreview)
  const [updates, setUpdates] = useState<Update[]>([]), [checks, setChecks] = useState<Sync[]>([])
  const [updatesReady, setUpdatesReady] = useState(false), [checksReady, setChecksReady] = useState(false)
  const [error, setError] = useState(''), [checkError, setCheckError] = useState('')
  const [search, setSearch] = useState(''), [agency, setAgency] = useState(''), [shown, setShown] = useState(12), [retry, setRetry] = useState(0)
  const [now, setNow] = useState(Date.now)
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(timer) }, [])
  useEffect(() => {
    if (preview) return
    const unsubscribeUpdates = onSnapshot(collection(db, 'regulatoryUpdates'), snapshot => {
      const parsed = snapshot.docs.map(row => safeUpdate(row.id, row.data()))
      setUpdates(parsed.filter((row): row is Update => Boolean(row)).sort((a, b) => b.lastChangedAt.localeCompare(a.lastChangedAt) || b.issuedOn.localeCompare(a.issuedOn) || a.code.localeCompare(b.code, undefined, { numeric: true })))
      setUpdatesReady(true); setError(parsed.some(row => !row) ? 'Some source records could not be displayed and need an administrator review.' : '')
    }, () => { setUpdatesReady(true); setError('The daily source feed could not be loaded. Check your connection and access.') })
    const unsubscribeChecks = onSnapshot(collection(db, 'regulatorySync'), snapshot => {
      setChecks(snapshot.docs.map(row => ({ ...row.data(), id: row.id } as Sync)))
      setChecksReady(true); setCheckError('')
    }, () => { setChecksReady(true); setCheckError('Source check history is unavailable; the freshness of this feed cannot be confirmed.') })
    return () => { unsubscribeUpdates(); unsubscribeChecks() }
  }, [preview, retry])
  const needle = search.trim().toLowerCase()
  const filtered = updates.filter(row => (!agency || row.agency === agency) && (!needle || `${row.title} ${row.code} ${row.kind}`.toLowerCase().includes(needle)))
  function add(row: Update) {
    if (disabled || !onAdd) return
    onAdd({ title: row.title.slice(0, 300), agency: row.agency, number: row.code, year: /\d{4}/.exec(row.code)?.[0] || '', kind: row.kind.slice(0, 40), url: row.url, issuedOn: row.issuedOn, effectiveOn: '', reviewedOn: '', amends: '', notes: row.title.length > 300 ? row.title : '', attachments: [] })
  }
  return <section className="rounded-xl border border-[#cfdeea] bg-white p-5 sm:p-6" aria-label="Daily official regulatory updates"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="flex items-center gap-2 text-lg font-semibold text-[#173b61]"><RefreshCw className="size-5 text-[#087cc1]" />Daily official source feed</h2><p className="mt-2 max-w-4xl text-sm leading-6 text-[#60748a]">Scheduled checks at 8:00 AM Philippine time cover BIR Regulations, Memorandum Circulars and Orders for the current and previous year, plus recent SEC Memorandum Circular announcements. New discoveries require company review; they do not change your tax settings, due dates or accounting books.</p></div></div>
    {preview ? <p className="mt-4 rounded-lg bg-[#eff8fc] p-4 text-sm text-[#365f7b]">The isolated company preview does not check live agency websites. Live source check history will appear here in the company workspace.</p> : <>
      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">{configured.map(source => {
        const state = checks.find(item => item.id === source.id)
        const expired = Boolean(state?.lastSuccessAt && now - Date.parse(state.lastSuccessAt) > 36 * 60 * 60 * 1000)
        const interrupted = Boolean(state?.status === 'checking' && state.lastAttemptAt && now - Date.parse(state.lastAttemptAt) > 30 * 60 * 1000)
        return <div key={source.id} className="rounded-lg border border-[#e1e9f0] bg-[#fbfcfe] p-4"><p className="text-sm font-medium leading-6 text-[#294b6d]">{source.name}</p><p className={`mt-2 text-xs font-medium ${state?.status === 'failed' || expired || interrupted ? 'text-amber-800' : 'text-[#526b84]'}`}>{!checksReady ? 'Loading check history…' : checkError ? 'Check history unavailable' : !state ? 'Daily checks have not started' : interrupted ? 'Source check did not finish' : state.status === 'checking' ? 'Source check in progress' : state.status === 'failed' ? 'Latest check failed' : expired ? 'Source check is overdue' : 'Source check completed'}</p><p className="mt-2 text-xs leading-5 text-[#60748a]">Last successful check:<br />{moment(state?.lastSuccessAt)}</p>{state?.lastAttemptAt && <p className="mt-2 text-xs leading-5 text-[#60748a]">Last attempt: {moment(state.lastAttemptAt)}</p>}{state?.lastError && <p className="mt-2 text-xs leading-5 text-amber-800">{state.lastError}</p>}<div className="mt-3 text-xs"><External url={source.sourceUrl}>Review official site</External></div></div>
      })}</div>
      {(error || checkError) && <div role="alert" className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{error} {checkError}<Button className="ml-2" type="button" variant="outline" onClick={() => { setUpdatesReady(false); setChecksReady(false); setRetry(value => value + 1) }}>Retry loading</Button></div>}
      <div className="mt-5 flex flex-wrap gap-3"><label className="grid min-w-48 flex-1 gap-1 text-xs font-medium text-[#526b84]">Search discovered issuances<input type="search" className="rounded-lg border border-[#cfdae5] bg-white px-3 py-2 text-sm" maxLength={300} value={search} onChange={event => { setSearch(event.target.value); setShown(12) }} placeholder="Issuance code or subject" /></label><label className="grid gap-1 text-xs font-medium text-[#526b84]">Agency<select className="rounded-lg border border-[#cfdae5] bg-white px-3 py-2 text-sm" value={agency} onChange={event => { setAgency(event.target.value); setShown(12) }}><option value="">BIR & SEC</option><option>BIR</option><option>SEC</option></select></label></div>
      {!updatesReady ? <p role="status" className="py-8 text-center text-sm text-[#60748a]">Loading discovered issuances…</p> : filtered.length === 0 ? <p className="py-8 text-center text-sm text-[#60748a]">{updates.length ? 'No discoveries match these filters.' : 'No issuances have been collected yet. Check each source’s status above and consult its official listing.'}</p> : <div className="mt-4 divide-y divide-[#e4ebf1]">{filtered.slice(0, shown).map(row => <article key={row.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="text-xs font-semibold text-[#0876b3]">{row.code}</span><span className="rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-800">Needs company review</span></div><h3 className="mt-2 max-w-4xl text-sm font-medium leading-6 text-[#294b6d]">{row.title}</h3><p className="mt-1 text-xs leading-5 text-[#73879a]">First detected {moment(row.firstSeenAt)}{row.issuedOn ? ` · Agency issue date ${row.issuedOn}` : ''}</p><div className="mt-2 flex gap-4 text-xs"><External url={row.url}>Open official issuance</External><External url={row.sourceUrl}>Source listing</External></div></div>{onAdd && <Button type="button" variant="outline" disabled={disabled} className="shrink-0" onClick={() => add(row)}>Add to company library</Button>}</article>)}</div>}
      {filtered.length > shown && <Button type="button" variant="outline" className="mt-3" onClick={() => setShown(value => value + 24)}>Show more ({filtered.length - shown} remaining)</Button>}
      <p className="mt-4 text-xs leading-5 text-[#73879a]">First detection is when the feed found a document, not its legal publication or effective date. Source checks cover the listings named above. Other agencies, local ordinances and special industry requirements need separate review.</p>
    </>}
  </section>
}
