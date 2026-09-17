import type { DocumentReference, Transaction } from 'firebase-admin/firestore'
import { HttpsError } from 'firebase-functions/v2/https'
import { outstanding, type Books } from './accounting-engine.js'

export type PaymentReservations = { version: number; invoiceId: string; requests: Record<string, number> }
export function reservedPaymentAmount(control: PaymentReservations, excludingId?: string): number {
  const total = Object.entries(control.requests).filter(([id]) => id !== excludingId).reduce((sum, [, amount]) => sum + amount, 0)
  if (!Number.isSafeInteger(total) || total < 0) throw new HttpsError('failed-precondition', 'Payment reservations require review.')
  return total
}
/** Call before writes for direct supplier settlements; receipts have no payment reservation. */
export async function assertPaymentSettlementAllowed(tx: Transaction, companyRef: DocumentReference, books: Books, invoiceId: string, amount: number, excludingRequestId?: string): Promise<void> {
  const invoice = books.invoices.find(row => row.id === invoiceId)
  if (!invoice || invoice.kind !== 'payable') return
  const snapshot = await tx.get(companyRef.collection('paymentControl').doc(`invoice-${invoiceId}`))
  const control: PaymentReservations = snapshot.exists ? snapshot.data() as PaymentReservations : { version: 0, invoiceId, requests: {} }
  if (amount > outstanding(books, invoice) - reservedPaymentAmount(control, excludingRequestId)) throw new HttpsError('failed-precondition', 'This bill has amounts reserved by pending or approved payment requests. Release or cancel those requests before recording another payment.')
}
