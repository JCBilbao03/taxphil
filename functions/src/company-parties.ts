import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { companyIdentity, companyContext, companyRequireRole, companyAudit } from './company-accounting.js'
import { validateParty } from './parties.js'

export const companyPartySave = onCall({ region: 'asia-southeast1', maxInstances: 20 }, async (request) => {
  const actor = await companyIdentity(request)
  const data = request.data as { id?: unknown; expectedVersion?: unknown; value?: unknown }
  if (!data || typeof data !== 'object' || !Number.isSafeInteger(data.expectedVersion) || (data.expectedVersion as number) < 0) throw new HttpsError('invalid-argument', 'A valid record version is required.')
  if (data.id !== undefined && (typeof data.id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(data.id))) throw new HttpsError('invalid-argument', 'Invalid directory reference.')
  let clean: ReturnType<typeof validateParty>
  try { clean = validateParty(data.value) } catch (error) { throw new HttpsError('invalid-argument', error instanceof Error ? error.message : 'Invalid directory details.') }
  return getFirestore().runTransaction(async (tx) => {
    const { member, companyRef } = await companyContext(tx, actor)
    companyRequireRole(member, ['admin', 'manager', 'accountant'])
    const collection = companyRef.collection('parties')
    const ref = data.id ? collection.doc(data.id as string) : collection.doc()
    const previous = await tx.get(ref)
    if (data.id && !previous.exists) throw new HttpsError('not-found', 'This directory record no longer exists.')
    if ((previous.get('version') || 0) !== data.expectedVersion) throw new HttpsError('aborted', 'This record changed. Close the editor and open the latest version before saving.')
    if (previous.exists && previous.get('kind') !== clean.kind) throw new HttpsError('invalid-argument', 'A vendor cannot be converted into a customer. Create a separate record.')
    const indexRef = companyRef.collection('partyTinIndex').doc(`${clean.kind}_${clean.normalizedTin}`)
    const previousIndexRef = previous.exists ? companyRef.collection('partyTinIndex').doc(`${previous.get('kind')}_${previous.get('normalizedTin')}`) : null
    const index = await tx.get(indexRef)
    if (index.exists && index.get('partyId') !== ref.id) throw new HttpsError('already-exists', `This ${clean.kind} TIN already exists in your company directory. Search archived records before adding another.`)
    const timestamp = new Date().toISOString()
    const record = { ...clean, version: (data.expectedVersion as number) + 1, createdAt: previous.get('createdAt') || timestamp, createdBy: previous.get('createdBy') || actor.uid, updatedAt: timestamp, updatedBy: actor.uid }
    if (previous.exists) tx.update(ref, record); else tx.create(ref, record)
    tx.set(indexRef, { partyId: ref.id })
    if (previousIndexRef && previousIndexRef.path !== indexRef.path) tx.delete(previousIndexRef)
    companyAudit(tx, companyRef, actor, `directory.${clean.kind}.save`, `${clean.active ? 'Saved' : 'Archived'} ${clean.registeredName}.`, { partyId: ref.id, version: record.version })
    return { id: ref.id, version: record.version }
  })
})
