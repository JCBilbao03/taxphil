import { getStorage } from 'firebase-admin/storage'
import { HttpsError } from 'firebase-functions/v2/https'
import { validateSupplierBillPdf, type SupplierBillPdf } from './accounting-engine.js'

export function supplierBillPdfValue(value: unknown, kind: unknown, companyId?: string): SupplierBillPdf {
  if (kind !== 'payable') throw new HttpsError('invalid-argument', 'Supplier bill PDFs can only be attached to accounts payable bills.')
  try { return validateSupplierBillPdf(value, companyId) }
  catch (error) { throw new HttpsError('invalid-argument', error instanceof Error ? error.message : 'Attach a valid supplier bill PDF.') }
}

// Clients cannot replace, edit, or delete these objects. Recheck metadata during
// approval as well, so a server-removed or changed document cannot be posted.
// Reading PDF contents is deliberately separate from accounting authorization.
export async function verifySupplierBillPdf(command: { type: string; input: Record<string, unknown> }, companyId: string): Promise<void> {
  if (command.type !== 'addInvoice' || command.input.supplierBillPdf === undefined) return
  const file = supplierBillPdfValue(command.input.supplierBillPdf, command.input.kind, companyId)
  let metadata
  try { [metadata] = await getStorage().bucket().file(file.path).getMetadata() }
  catch { throw new HttpsError('failed-precondition', 'The uploaded supplier bill PDF could not be verified. Upload it again or retry when document storage is available.') }
  if (metadata.name !== file.path || metadata.contentType !== file.type || Number(metadata.size) !== file.size) {
    throw new HttpsError('failed-precondition', 'The stored supplier bill PDF does not match the attachment. Upload the correct PDF again.')
  }
}
