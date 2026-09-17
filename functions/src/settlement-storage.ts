import { getStorage } from 'firebase-admin/storage'
import { HttpsError } from 'firebase-functions/v2/https'
import { validateSettlementSupportingDocuments, type Books, type Invoice, type SettlementSupportingDocument } from './accounting-engine.js'

export function settlementDocumentsValue(value: unknown, invoiceKind?: Invoice['kind'], companyId?: string): SettlementSupportingDocument[] {
  try { return validateSettlementSupportingDocuments(value, invoiceKind, companyId) }
  catch (error) { throw new HttpsError('invalid-argument', error instanceof Error ? error.message : 'Attach valid supporting documents.') }
}

export async function verifySettlementDocuments(command: { type: string; input: Record<string, unknown> }, books: Books, companyId: string): Promise<void> {
  if (!['settle', 'attachSettlementDocuments'].includes(command.type) || command.input.supportingDocuments === undefined) return
  const settlement = command.type === 'attachSettlementDocuments' ? books.settlements.find(item => item.id === command.input.settlementId) : undefined
  if (command.type === 'attachSettlementDocuments' && !settlement) throw new HttpsError('failed-precondition', 'The payment or receipt could not be found in your company books.')
  const invoice = books.invoices.find(item => item.id === (settlement ? settlement.invoiceId : command.input.invoiceId))
  if (!invoice) throw new HttpsError('failed-precondition', 'The bill or invoice could not be found in your company books.')
  // The stored invoice determines whether this is a payment or a receipt.
  const files = settlementDocumentsValue(command.input.supportingDocuments, invoice.kind, companyId)
  await Promise.all(files.map(async file => {
    let metadata
    try { [metadata] = await getStorage().bucket().file(file.path).getMetadata() }
    catch { throw new HttpsError('failed-precondition', 'An uploaded supporting document could not be verified. Upload it again or retry when document storage is available.') }
    if (metadata.name !== file.path || metadata.contentType !== file.type || Number(metadata.size) !== file.size) {
      throw new HttpsError('failed-precondition', 'A stored supporting document does not match its attachment. Upload the correct file again.')
    }
  }))
}
