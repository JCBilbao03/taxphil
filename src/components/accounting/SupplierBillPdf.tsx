import { useContext, useEffect, useRef, useState } from 'react'
import { FileText, Upload } from 'lucide-react'
import { getBlob, ref, uploadBytes } from 'firebase/storage'
import { storage } from '@/lib/firebase'
import { useCompany } from '@/hooks/useCompany'
import { CompanyRecordsPreview } from '@/hooks/useCompanyRecords'
import { Button } from '@/components/ui/button'
import { extractSupplierBill, type SupplierBillExtraction } from '@/lib/supplier-bill-extraction'
import { validateSupplierBillPdf, type Invoice } from '@/lib/accounting'

type Attachment = NonNullable<Invoice['supplierBillPdf']>
const previewFiles: Map<string, Blob> = import.meta.hot?.data.supplierBillPdfFiles || new Map<string, Blob>()
if (import.meta.hot) import.meta.hot.data.supplierBillPdfFiles = previewFiles

export async function saveSupplierBillPdf(file: File, companyId: string, preview: boolean): Promise<Attachment> {
  const attachment: Attachment = { path: `companies/${companyId}/supplier-bills/${crypto.randomUUID()}`, name: file.name, size: file.size, type: 'application/pdf' }
  validateSupplierBillPdf(attachment, companyId)
  if (preview && import.meta.env.DEV) previewFiles.set(attachment.path, file)
  else await uploadBytes(ref(storage, attachment.path), file, { contentType: 'application/pdf' })
  return attachment
}

export function SupplierBillPdfLink({ file }: { file?: Attachment }) {
  const company = useCompany(), preview = useContext(CompanyRecordsPreview)
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  if (!file) return null
  async function download() {
    if (!file || !company?.membership?.companyId) return
    setError(''); setBusy(true)
    try {
      validateSupplierBillPdf(file, company.membership.companyId)
      const local = preview && import.meta.env.DEV ? previewFiles.get(file.path) : undefined
      if (preview && import.meta.env.DEV && !local) throw Error('Refresh cleared this preview file.')
      const blob = local || await getBlob(ref(storage, file.path), 10 * 1024 * 1024)
      const url = URL.createObjectURL(blob), link = document.createElement('a')
      link.href = url; link.download = file.name; link.click()
      setTimeout(() => URL.revokeObjectURL(url), 30_000)
    } catch { setError('The PDF could not be downloaded. Check company access and the storage connection.') }
    finally { setBusy(false) }
  }
  return <div className="mt-2 text-xs font-normal"><button type="button" disabled={busy} onClick={() => void download()} className="inline-flex items-center gap-1.5 text-primary underline underline-offset-2"><FileText size={13} />{busy ? 'Downloading…' : 'Supplier bill PDF'}</button>{error && <p role="alert" className="mt-1 max-w-xs text-destructive">{error}</p>}</div>
}

const labels: Record<string, string> = { vendorName: 'Supplier', vendorTin: 'Supplier TIN', vendorAddress: 'Supplier address', reference: 'Invoice reference', date: 'Invoice date', due: 'Due date', total: 'Total (PHP)', netAmount: 'Net amount (PHP)', vatAmount: 'VAT (PHP)', description: 'Description' }

export function SupplierBillPdfImport({ disabled, onFile, onExtract, onReading }: {
  disabled: boolean
  onFile: (file: File | null) => void
  onExtract: (result: SupplierBillExtraction) => string[]
  onReading: (reading: boolean) => void
}) {
  const [file, setFile] = useState<File | null>(null), [url, setUrl] = useState('')
  const [reading, setReading] = useState(false), [progress, setProgress] = useState(''), [error, setError] = useState('')
  const [result, setResult] = useState<SupplierBillExtraction | null>(null), [notes, setNotes] = useState<string[]>([])
  const [sourceText, setSourceText] = useState('')
  const controller = useRef<AbortController | null>(null), generation = useRef(0)
  const callbacks = useRef({ onFile, onExtract, onReading })
  useEffect(() => { callbacks.current = { onFile, onExtract, onReading } })
  useEffect(() => () => { generation.current++; controller.current?.abort() }, [])
  useEffect(() => { if (!file) { setUrl(''); return }; const next = URL.createObjectURL(file); setUrl(next); return () => URL.revokeObjectURL(next) }, [file])

  async function read(candidate: File, forceOcr = false) {
    const run = ++generation.current
    controller.current?.abort()
    const abort = new AbortController(); controller.current = abort
    setReading(true); callbacks.current.onReading(true); setError(''); setResult(null); setNotes([]); setSourceText(''); setProgress('Checking PDF…')
    try {
      if (!/\.pdf$/i.test(candidate.name) || candidate.name.length > 200 || /[\/\\\x00-\x1f\x7f]/.test(candidate.name)) throw Error('Choose a PDF with a filename of 200 characters or fewer.')
      if (!candidate.size || candidate.size > 10 * 1024 * 1024) throw Error('Choose a PDF up to 10 MB.')
      if (candidate.type && candidate.type !== 'application/pdf') throw Error('Choose a PDF file.')
      if (!(await candidate.slice(0, 1024).text()).includes('%PDF-')) throw Error('This file is not a readable PDF.')
      if (run !== generation.current) return
      setFile(candidate); callbacks.current.onFile(candidate)
      const { readSupplierPdf } = await import('@/lib/read-supplier-pdf')
      const read = await readSupplierPdf(candidate, { signal: abort.signal, forceOcr, onProgress: message => { if (run === generation.current) setProgress(message) } })
      if (run !== generation.current) return
      const extracted = extractSupplierBill(read.text)
      extracted.warnings = [...read.warnings, ...extracted.warnings]
      setResult(extracted); setSourceText(read.text); setNotes(callbacks.current.onExtract(extracted))
      setProgress(`${read.pages} ${read.pages === 1 ? 'page' : 'pages'} read${read.ocr ? ' using scan recognition' : ''}. Review the details below.`)
    } catch (cause) {
      if (run === generation.current) { setError(cause instanceof Error ? cause.message : 'This PDF could not be read.'); setProgress('') }
    } finally {
      if (run === generation.current) { setReading(false); callbacks.current.onReading(false) }
    }
  }
  function stop() {
    generation.current++; controller.current?.abort(); setReading(false); callbacks.current.onReading(false)
    setProgress('Reading stopped. You can retry or enter the bill details manually.'); setResult(null); setSourceText('')
  }
  function remove() {
    stop(); setFile(null); callbacks.current.onFile(null); setError(''); setNotes([])
    setProgress('PDF removed. Review any bill details already filled from the document.')
  }
  return <section aria-label="Supplier bill PDF upload" className="space-y-3 rounded-xl border border-primary/20 bg-accent/40 p-4">
    <div className="flex items-start gap-3"><Upload size={20} className="mt-0.5 shrink-0 text-primary" /><div><h3 className="font-semibold">Read a supplier bill</h3><p className="mt-1 text-sm text-muted-foreground">Upload the original PDF to fill the bill details. Scanned pages are read on your device. The PDF saves with the bill for company review.</p></div></div>
    <label className="block text-sm font-medium">Supplier bill PDF<input aria-label="Supplier bill PDF" type="file" accept=".pdf,application/pdf" disabled={disabled || reading} className="mt-2 block w-full rounded-md border bg-card p-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-primary file:px-3 file:py-2 file:text-primary-foreground" onChange={e => { const next = e.target.files?.[0]; e.target.value = ''; if (next) void read(next) }} /><span className="mt-1 block text-xs font-normal text-muted-foreground">PDF · Up to 10 MB and 10 pages · One supplier bill per file</span></label>
    {file && <div className="flex flex-wrap items-center gap-3 text-sm"><a href={url} target="_blank" rel="noreferrer" className="max-w-full break-all text-primary underline">{file.name}</a><span className="text-xs text-muted-foreground">{Math.ceil(file.size / 1024)} KB · saves when you submit</span>{!reading && <><Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => void read(file, true)}>Read scanned pages again</Button><Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={remove}>Remove PDF</Button></>}</div>}
    {progress && <p role="status" className="text-sm">{progress}</p>}
    {reading && <Button type="button" size="sm" variant="outline" onClick={stop}>Stop reading</Button>}
    {error && <p role="alert" className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">{error}{file && ' The PDF remains selected. You can retry reading or enter and review the details manually.'}</p>}
    {notes.length > 0 && <ul className="list-disc space-y-1 pl-5 text-sm">{notes.map(note => <li key={note}>{note}</li>)}</ul>}
    {result && <><p className="text-xs text-muted-foreground">Only clearly identified fields are filled. Existing manual edits are kept. Select the expense account and verify the tax treatment against the PDF.</p>{result.warnings.length > 0 && <ul className="list-disc space-y-1 rounded-md bg-amber-50 p-3 pl-7 text-sm text-amber-900">{result.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>}<details className="rounded-md border bg-card p-3 text-sm"><summary className="cursor-pointer font-medium">Details read from the PDF</summary><dl className="mt-3 grid gap-3 sm:grid-cols-2">{Object.entries(result.fields).map(([key, value]) => <div key={key}><dt className="text-xs text-muted-foreground">{labels[key] || key}</dt><dd className="break-words">{value}</dd></div>)}</dl><details className="mt-3"><summary className="cursor-pointer text-muted-foreground">View extracted text</summary><pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words text-xs">{sourceText}</pre></details></details></>}
  </section>
}
