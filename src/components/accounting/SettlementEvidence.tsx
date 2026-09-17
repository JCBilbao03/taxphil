import { useContext, useEffect, useId, useRef, useState } from 'react'
import { Download, FileText, Paperclip, X } from 'lucide-react'
import { getBlob, ref, uploadBytes } from 'firebase/storage'
import { Button } from '@/components/ui/button'
import { storage } from '@/lib/firebase'
import { useCompany } from '@/hooks/useCompany'
import { CompanyRecordsPreview } from '@/hooks/useCompanyRecords'
import {
  MAX_SETTLEMENT_DOCUMENT_BYTES, MAX_SETTLEMENT_DOCUMENTS, SETTLEMENT_DOCUMENT_KINDS,
  validateSettlementSupportingDocument, validateSettlementSupportingDocuments,
  type SettlementDocumentKind, type SettlementSupportingDocument,
} from '@/lib/accounting'

export type PendingSettlementEvidence = { id: string; kind: SettlementDocumentKind; file: File }
type InvoiceKind = 'payable' | 'receivable'
type FileDetails = Pick<SettlementSupportingDocument, 'name' | 'size' | 'type'>

const documentLabels: Record<SettlementDocumentKind, string> = {
  collection_receipt: 'Collection receipt', deposit_slip: 'Deposit slip', transfer_confirmation: 'Transfer confirmation',
  payment_approval: 'Payment approval', check_copy: 'Check copy', vendor_collection_receipt: 'Vendor collection receipt',
}
const extensionTypes: Record<string, SettlementSupportingDocument['type']> = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg' }
const previewFiles: Map<string, Blob> = import.meta.env.DEV && import.meta.hot
  ? (import.meta.hot.data.settlementEvidenceFiles ??= new Map<string, Blob>()) : new Map<string, Blob>()
// A File is the cache key, so replacing it can never reuse a different document's uploaded bytes.
const savedFiles = new WeakMap<File, Map<string, Promise<Omit<SettlementSupportingDocument, 'kind'>>>>()

/** Check the actual file signature as well as its name, size and declared content type. */
export async function validatePendingSettlementEvidenceFile(file: File): Promise<FileDetails> {
  if (!file || typeof file.slice !== 'function' || typeof file.name !== 'string') throw Error('Choose an original PDF, PNG or JPEG document.')
  if (!file.name.trim() || file.name.length > 200 || /[/\\\u0000-\u001f\u007f]/.test(file.name)) throw Error('Use a filename of 200 characters or fewer, without folder paths or control characters.')
  const extension = file.name.trim().match(/^.+\.(pdf|png|jpe?g)$/i)?.[1].toLowerCase()
  if (!extension || file.name !== file.name.trim()) throw Error('Choose a PDF, PNG or JPEG file with a matching filename extension and no surrounding spaces.')
  if (!Number.isSafeInteger(file.size) || file.size <= 0 || file.size > MAX_SETTLEMENT_DOCUMENT_BYTES) throw Error('Each attachment must be larger than 0 bytes and no larger than 10 MB.')
  const expected = extensionTypes[extension]
  if (file.type && file.type !== 'application/octet-stream' && file.type !== expected) throw Error('The document type does not match its filename. Choose the original PDF, PNG or JPEG file.')
  const bytes = new Uint8Array(await file.slice(0, 32).arrayBuffer())
  const pdf = bytes.length >= 8 && String.fromCharCode(...bytes.slice(0, 5)) === '%PDF-' && /^[12]\.\d$/.test(String.fromCharCode(...bytes.slice(5, 8)))
  const png = bytes.length >= 24 && [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte)
    && bytes[8] === 0 && bytes[9] === 0 && bytes[10] === 0 && bytes[11] === 13
    && String.fromCharCode(...bytes.slice(12, 16)) === 'IHDR'
    && new DataView(bytes.buffer, bytes.byteOffset).getUint32(16) > 0 && new DataView(bytes.buffer, bytes.byteOffset).getUint32(20) > 0
  const jpeg = bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 && bytes[3] >= 192 && bytes[3] <= 254 && bytes[3] !== 216 && bytes[3] !== 217
  const actual = pdf ? 'application/pdf' : png ? 'image/png' : jpeg ? 'image/jpeg' : undefined
  if (actual !== expected) throw Error('The file contents are not a matching PDF, PNG or JPEG. Choose an intact original document.')
  return { name: file.name, size: file.size, type: actual }
}

/** Upload only on settlement submit. Successful files are reused if a later upload or submit fails. */
export async function saveSettlementEvidence(pending: readonly PendingSettlementEvidence[], companyId: string, preview = false): Promise<SettlementSupportingDocument[]> {
  if (typeof companyId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(companyId)) throw Error('Select an active company before saving attachments.')
  if (!Array.isArray(pending) || pending.length > MAX_SETTLEMENT_DOCUMENTS) throw Error('Attach no more than 10 documents to a receipt or payment.')
  if (preview && !import.meta.env.DEV) throw Error('Preview attachments are available only in the local preview.')
  const ids = new Set<string>(), files = new Set<File>()
  const checked: { item: PendingSettlementEvidence; details: FileDetails }[] = []
  // Check every pending file before writing the first one.
  for (const item of pending) {
    if (!item || typeof item.id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(item.id) || ids.has(item.id) || files.has(item.file)) throw Error('Each selected attachment must have a unique document and selection ID.')
    ids.add(item.id); files.add(item.file)
    const details = await validatePendingSettlementEvidenceFile(item.file)
    validateSettlementSupportingDocument({ ...details, kind: item.kind, path: `companies/${companyId}/settlement-evidence/${item.id}` }, undefined, companyId)
    checked.push({ item, details })
  }
  const result: SettlementSupportingDocument[] = []
  for (const { item, details } of checked) {
    const key = `${companyId}/${item.id}/${preview ? 'preview' : 'live'}`
    let cached = savedFiles.get(item.file)
    if (!cached) { cached = new Map(); savedFiles.set(item.file, cached) }
    let upload = cached.get(key)
    if (!upload) {
      const metadata = { ...details, path: `companies/${companyId}/settlement-evidence/${crypto.randomUUID()}` }
      upload = (async () => {
        if (preview && import.meta.env.DEV) previewFiles.set(metadata.path, item.file)
        else await uploadBytes(ref(storage, metadata.path), item.file, { contentType: metadata.type })
        return metadata
      })()
      cached.set(key, upload)
      // A failed upload must be retryable; successful siblings keep their cached results.
      void upload.catch(() => { if (cached!.get(key) === upload) cached!.delete(key) })
    }
    try {
      const metadata = await upload
      result.push(validateSettlementSupportingDocument({ ...metadata, kind: item.kind }, undefined, companyId))
    } catch {
      throw Error(`${details.name} could not be uploaded. Check your company access and connection, then retry. Files already uploaded will be reused.`)
    }
  }
  return validateSettlementSupportingDocuments(result, undefined, companyId)
}

export function SettlementEvidence({ value, onChange, invoiceKind, disabled = false, onValidating, existingCount = 0 }: {
  value: PendingSettlementEvidence[]
  onChange: (value: PendingSettlementEvidence[]) => void
  invoiceKind: InvoiceKind
  disabled?: boolean
  onValidating?: (validating: boolean) => void
  existingCount?: number
}) {
  const id = useId(), [selectedKind, setSelectedKind] = useState<SettlementDocumentKind | ''>('')
  const [validating, setValidating] = useState(false), [error, setError] = useState(''), [status, setStatus] = useState('')
  const epoch = useRef(0), current = useRef({ value, onChange, onValidating, invoiceKind, existingCount })
  useEffect(() => { current.current = { value, onChange, onValidating, invoiceKind, existingCount } })
  useEffect(() => () => { epoch.current++; current.current.onValidating?.(false) }, [])
  useEffect(() => { setSelectedKind(''); setError(''); setStatus('') }, [invoiceKind])
  const kinds = SETTLEMENT_DOCUMENT_KINDS[invoiceKind]
  const locked = disabled || validating
  const savedCount = Number.isSafeInteger(existingCount) && existingCount >= 0 ? existingCount : MAX_SETTLEMENT_DOCUMENTS

  async function select(candidates: File[], kind: SettlementDocumentKind) {
    const run = ++epoch.current
    setError(''); setStatus(''); setValidating(true); current.current.onValidating?.(true)
    try {
      if (!kinds.includes(kind)) throw Error('Choose a document type for this receipt or payment.')
      if (!Number.isSafeInteger(current.current.existingCount) || current.current.existingCount < 0 || current.current.existingCount + current.current.value.length + candidates.length > MAX_SETTLEMENT_DOCUMENTS) throw Error('Attach no more than 10 documents in total, including files already saved. Remove a selected document before adding more.')
      const added: PendingSettlementEvidence[] = []
      for (const file of candidates) {
        try { await validatePendingSettlementEvidenceFile(file) }
        catch (cause) { throw Error(`${file.name}: ${cause instanceof Error ? cause.message : 'This document could not be checked.'}`) }
        if (run !== epoch.current) return
        const duplicate = [...current.current.value, ...added].some(item => item.file.name === file.name && item.file.size === file.size && item.file.lastModified === file.lastModified)
        if (duplicate) throw Error(`${file.name} is already selected. Remove it first if you need to replace it.`)
        added.push({ id: crypto.randomUUID(), kind, file })
      }
      if (run !== epoch.current) return
      if (current.current.invoiceKind !== invoiceKind) throw Error('The receipt or payment changed. Select its attachments again.')
      if (current.current.existingCount + current.current.value.length + added.length > MAX_SETTLEMENT_DOCUMENTS) throw Error('Attach no more than 10 documents in total, including files already saved.')
      current.current.onChange([...current.current.value, ...added])
      setStatus(`${added.length} ${added.length === 1 ? 'document is' : 'documents are'} ready. Files save when you submit.`)
    } catch (cause) {
      if (run === epoch.current) setError(cause instanceof Error ? cause.message : 'The selected documents could not be checked. Try again.')
    } finally {
      if (run === epoch.current) { setValidating(false); current.current.onValidating?.(false) }
    }
  }

  return <section aria-labelledby={`${id}-heading`} className="space-y-3 rounded-xl border border-primary/20 bg-accent/40 p-4">
    <div className="flex items-start gap-3"><Paperclip size={19} className="mt-0.5 shrink-0 text-primary" /><div><h3 id={`${id}-heading`} className="font-semibold">Supporting documents</h3><p className="mt-1 text-sm text-muted-foreground">Attach evidence for this {invoiceKind === 'receivable' ? 'receipt' : 'payment'}. Files save privately with the company record when you submit.</p></div></div>
    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
      <label className="text-sm font-medium" htmlFor={`${id}-kind`}>Document type<select id={`${id}-kind`} value={selectedKind} disabled={locked} className="mt-1 block h-10 w-full rounded-md border bg-card px-3" onChange={event => setSelectedKind(event.target.value as SettlementDocumentKind | '')}><option value="">Choose a document type</option>{kinds.map(kind => <option key={kind} value={kind}>{documentLabels[kind]}</option>)}</select></label>
      <label className="text-sm font-medium" htmlFor={`${id}-files`}>Select files<input id={`${id}-files`} type="file" multiple accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" disabled={locked || !selectedKind || savedCount + value.length >= MAX_SETTLEMENT_DOCUMENTS} aria-describedby={`${id}-hint`} className="mt-1 block w-full rounded-md border bg-card p-1.5 text-sm file:mr-2 file:rounded file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-primary-foreground disabled:opacity-60" onChange={event => { const chosen = Array.from(event.target.files || []); event.target.value = ''; if (chosen.length && selectedKind) void select(chosen, selectedKind) }} /></label>
    </div>
    <p id={`${id}-hint`} className="text-xs text-muted-foreground">Choose the document type first. PDF, PNG or JPEG · Up to 10 MB each · {savedCount + value.length} of 10 documents{savedCount > 0 ? ` (${savedCount} saved, ${value.length} selected)` : ' selected'}</p>
    {value.length > 0 && <ul className="space-y-2" aria-label="Selected supporting documents">{value.map((item, index) => <li key={item.id} className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3"><FileText size={17} className="shrink-0 text-primary" /><div className="min-w-0 flex-1 basis-36"><p className="break-all text-sm font-medium">{item.file.name}</p><p className="mt-0.5 text-xs text-muted-foreground">{Math.max(1, Math.ceil(item.file.size / 1024))} KB · Ready to save</p></div><label className="min-w-0 flex-1 basis-44"><span className="sr-only">Document type for {item.file.name}</span><select aria-label={`Document type for attachment ${index + 1}`} disabled={locked} value={item.kind} className="h-9 w-full rounded-md border bg-background px-2 text-sm" onChange={event => { const kind = event.target.value as SettlementDocumentKind; if (kinds.includes(kind)) onChange(value.map(row => row.id === item.id ? { ...row, kind } : row)) }}>{kinds.map(kind => <option key={kind} value={kind}>{documentLabels[kind]}</option>)}</select></label><Button type="button" size="icon-sm" variant="ghost" disabled={locked} aria-label={`Remove ${item.file.name}`} onClick={() => { onChange(value.filter(row => row.id !== item.id)); setError(''); setStatus('Document removed from this selection.') }}><X size={16} /></Button></li>)}</ul>}
    {validating && <p role="status" className="text-sm">Checking selected documents…</p>}
    {status && <p role="status" className="text-sm text-muted-foreground">{status}</p>}
    {error && <p role="alert" className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">{error}</p>}
  </section>
}

export function SettlementEvidenceList({ files }: { files?: readonly SettlementSupportingDocument[] }) {
  const company = useCompany(), preview = useContext(CompanyRecordsPreview)
  const [busy, setBusy] = useState(''), [error, setError] = useState('')
  const activeCompany = company?.membership?.active ? company.membership.companyId : ''
  if (!files?.length) return null
  async function download(candidate: SettlementSupportingDocument) {
    setError(''); setBusy(candidate.path)
    try {
      if (!activeCompany) throw Error('Open the company record with an active company account to download its documents.')
      const file = validateSettlementSupportingDocument(candidate, undefined, activeCompany)
      if (preview && !import.meta.env.DEV) throw Error('Preview documents are not available here.')
      const local = preview && import.meta.env.DEV ? previewFiles.get(file.path) : undefined
      if (preview && !local) throw Error('This preview document is no longer in memory. Select it again in the local preview.')
      const blob = local || await getBlob(ref(storage, file.path), MAX_SETTLEMENT_DOCUMENT_BYTES)
      if (blob.size !== file.size || (blob.type && blob.type !== file.type)) throw Error('The stored file differs from this record. Ask a company administrator to review the attachment.')
      const url = URL.createObjectURL(blob), link = document.createElement('a')
      try {
        link.href = url; link.download = file.name; link.style.display = 'none'
        document.body.appendChild(link); link.click()
      } finally { link.remove(); setTimeout(() => URL.revokeObjectURL(url), 30_000) }
    } catch (cause) { setError(cause instanceof Error && !('code' in cause) ? cause.message : 'The document could not be downloaded. Check your company access and connection, then retry.') }
    finally { setBusy('') }
  }
  return <div className="mt-3 space-y-2"><ul aria-label="Saved supporting documents" className="space-y-1.5">{files.map((file, index) => <li key={`${file.path}-${index}`} className="flex min-w-0 items-start gap-2 text-xs"><Download size={14} className="mt-0.5 shrink-0 text-primary" /><button type="button" disabled={Boolean(busy)} className="min-w-0 text-left text-primary underline underline-offset-2 disabled:opacity-60" onClick={() => void download(file)}><span className="block break-all">{busy === file.path ? 'Downloading…' : file.name}</span><span className="mt-0.5 block text-[11px] text-muted-foreground">{documentLabels[file.kind] || 'Supporting document'}</span></button></li>)}</ul>{error && <p role="alert" className="max-w-lg text-xs text-destructive">{error}</p>}</div>
}
