import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https'
import { transitionConsultation, validateConsultationRequest, type Consultation, type ConsultationAction } from './consultation-model.js'

async function actorFor(request: CallableRequest) {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in to manage consultations.')
  const user = await getAuth().getUser(request.auth.uid)
  if (user.disabled || !user.emailVerified || request.auth.token.email_verified !== true) {
    throw new HttpsError('permission-denied', 'Verify your email before managing consultations.')
  }
  return { uid: user.uid, name: user.displayName || user.email || 'TaxPhil customer', email: user.email || '', admin: user.customClaims?.admin === true }
}

function id(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9-]{16,64}$/.test(value)) throw new HttpsError('invalid-argument', 'A valid request reference is required.')
  return value
}

export const consultationCreate = onCall({ region: 'asia-southeast1' }, async (request) => {
  const actor = await actorFor(request)
  const requestId = id(request.data?.requestId)
  let details
  try { details = validateConsultationRequest(request.data?.details) } catch (error) {
    throw new HttpsError('invalid-argument', error instanceof Error ? error.message : 'Invalid consultation details.')
  }
  const db = getFirestore()
  const recordRef = db.doc(`consultations/${requestId}`)
  const quotaRef = db.doc(`consultationLimits/${actor.uid}`)
  return db.runTransaction(async (tx) => {
    const existing = await tx.get(recordRef)
    if (existing.exists) {
      if (existing.data()?.ownerUid !== actor.uid) throw new HttpsError('permission-denied', 'This reference is unavailable.')
      const saved = existing.data()!
      if (Object.entries(details).some(([key, value]) => saved[key] !== value)) {
        throw new HttpsError('already-exists', 'This reference was used for different consultation details. Start a new request.')
      }
      return { id: existing.id }
    }
    const quota = await tx.get(quotaRef)
    const now = Date.now()
    const timestamps = ((quota.data()?.timestamps || []) as number[]).filter((time) => time > now - 86_400_000)
    if (timestamps.length >= 5) throw new HttpsError('resource-exhausted', 'You can request up to five consultations per day. Contact support about an existing request.')
    const timestamp = new Date(now).toISOString()
    const record: Consultation = {
      ...details, id: requestId, ownerUid: actor.uid, ownerName: actor.name, ownerEmail: actor.email,
      status: 'requested', createdAt: timestamp, updatedAt: timestamp, revision: 0,
      scheduledAt: null, meetingUrl: null, advisorName: null, responseNote: null,
    }
    tx.create(recordRef, record)
    tx.set(quotaRef, { timestamps: [...timestamps, now] })
    tx.create(recordRef.collection('history').doc(), { actorUid: actor.uid, action: 'requested', at: timestamp, revision: 0 })
    return { id: requestId }
  })
})

export const consultationUpdate = onCall({ region: 'asia-southeast1' }, async (request) => {
  const actor = await actorFor(request)
  const requestId = id(request.data?.id)
  const revision: unknown = request.data?.revision
  const action = request.data?.action as ConsultationAction
  if (!Number.isInteger(revision) || !action || typeof action !== 'object') throw new HttpsError('invalid-argument', 'A revision and action are required.')
  const db = getFirestore()
  const recordRef = db.doc(`consultations/${requestId}`)
  return db.runTransaction(async (tx) => {
    const snapshot = await tx.get(recordRef)
    if (!snapshot.exists) throw new HttpsError('not-found', 'Consultation not found.')
    const record = snapshot.data() as Consultation
    if (!actor.admin && record.ownerUid !== actor.uid) throw new HttpsError('permission-denied', 'You cannot access this consultation.')
    if (record.revision !== revision) throw new HttpsError('aborted', 'This consultation changed. Refresh and try again.')
    let updated: Consultation
    try { updated = transitionConsultation(record, action, actor) } catch (error) {
      throw new HttpsError('failed-precondition', error instanceof Error ? error.message : 'Invalid update.')
    }
    tx.set(recordRef, updated)
    tx.create(recordRef.collection('history').doc(), {
      actorUid: actor.uid, action: action.type, at: updated.updatedAt, revision: updated.revision,
      status: updated.status, scheduledAt: updated.scheduledAt, advisorName: updated.advisorName, responseNote: updated.responseNote,
    })
    return { id: requestId, revision: updated.revision }
  })
})
