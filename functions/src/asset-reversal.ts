import { HttpsError } from 'firebase-functions/v2/https'
import type { Transaction, DocumentReference } from 'firebase-admin/firestore'

/** Read before any transaction writes. Asset corrections must update the register and ledger together. */
export async function assertAssetEntryReversalAllowed(tx: Transaction, companyRef: DocumentReference, entryId: string) {
  const control = await tx.get(companyRef.collection('assetControl').doc('default'))
  if ((control.get('protectedEntryIds') || []).includes(entryId)) {
    throw new HttpsError('failed-precondition', 'This entry supports the asset register. Reverse its latest action in Asset Tracking before correcting its accounting source.')
  }
}
