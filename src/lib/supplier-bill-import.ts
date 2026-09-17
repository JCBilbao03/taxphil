import { matchSupplierVendor, type SupplierBillExtraction } from './supplier-bill-extraction.ts'

export type BillImportField = 'date' | 'due' | 'reference' | 'amount' | 'documentDescription' | 'partyId'
type Vendor = { id: string; kind?: string; active?: boolean; tin?: string; registeredName?: string }

/** Apply recognized values without overwriting fields the user has edited. */
export function planSupplierBillImport(extraction: SupplierBillExtraction, vendors: readonly Vendor[], touched: ReadonlySet<string>) {
  const match = matchSupplierVendor(extraction, vendors)
  const fields = extraction.fields
  const proposed: Record<BillImportField, string> = {
    date: fields.date || '', due: fields.due || '', reference: fields.reference || '',
    amount: fields.total || '', documentDescription: fields.description || '', partyId: match.vendor?.id || '',
  }
  const changes: Partial<Record<BillImportField, string>> = {}
  const kept: string[] = []
  for (const [field, value] of Object.entries(proposed)) {
    if (touched.has(field)) { kept.push(field); continue }
    changes[field as BillImportField] = value
  }
  const notes: string[] = []
  if (match.vendor && !touched.has('partyId')) notes.push(`Matched supplier: ${match.vendor.registeredName || 'saved vendor'} by TIN.${match.reason === 'tin_base' ? ' Confirm the branch against the PDF.' : ''}`)
  if (!match.vendor) notes.push('Select the saved vendor. If the supplier is new, add their name, TIN and address in the vendor directory first.')
  if (kept.length) notes.push('Your manually entered fields were kept. Compare them with the details read from the PDF.')
  if (!fields.date || !fields.due) notes.push('Enter any date that could not be read reliably. No missing date is assumed.')
  if (!fields.total) notes.push('Enter and verify the gross invoice total from the PDF.')
  return { changes, notes, match }
}
