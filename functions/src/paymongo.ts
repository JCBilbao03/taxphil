import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { getAuth } from 'firebase-admin/auth'
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore'
import { onCall, onRequest, HttpsError, type CallableRequest } from 'firebase-functions/v2/https'
import { inspectCheckout, paymongoCheckoutUrl, validateAssistanceCheckout, type ProviderCheckout } from './permit-payments.js'

const options = { region: 'asia-southeast1', maxInstances: 20 }
function secretKey() {
  const key = process.env.PAYMONGO_SECRET_KEY
  if (!key || !/^sk_(live|test)_/.test(key)) throw new HttpsError('failed-precondition', 'Assistance checkout is not available. Contact TaxPhil Support.')
  return key
}
function liveMode() { return secretKey().startsWith('sk_live_') }
function identifier(value: unknown) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) throw new HttpsError('invalid-argument', 'Invalid payment reference.')
  return value
}
async function verifiedUser(request: CallableRequest) {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in to continue.')
  const user = await getAuth().getUser(request.auth.uid)
  if (user.disabled || !user.emailVerified || request.auth.token.email_verified !== true || user.email !== request.auth.token.email) throw new HttpsError('permission-denied', 'Verify your email and sign in again before managing payments.')
  return user.uid
}
function appOrigin() {
  const origin = new URL(process.env.APP_ORIGIN || 'https://taxphil.com')
  if (origin.protocol !== 'https:' || origin.username || origin.password) throw new HttpsError('failed-precondition', 'The checkout return address needs configuration.')
  return origin.origin
}
async function providerRequest(path: string, body?: unknown, requestKey?: string): Promise<ProviderCheckout> {
  const response = await fetch(`https://api.paymongo.com${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Basic ${Buffer.from(`${secretKey()}:`).toString('base64')}`, 'Content-Type': 'application/json', ...(requestKey ? { 'Idempotency-Key': requestKey } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(25_000),
  })
  if (!response.ok) {
    console.error('PayMongo request failed', response.status)
    throw new HttpsError('unavailable', 'The payment provider could not complete this request. Check the saved payment status before trying again.')
  }
  const result = await response.json() as { data?: ProviderCheckout }
  if (!result.data?.id || !result.data.attributes) throw new HttpsError('unavailable', 'The payment provider returned an incomplete response.')
  return result.data
}

export const createPermitCheckout = onCall(options, async (request) => {
  const userId = await verifiedUser(request)
  let input: ReturnType<typeof validateAssistanceCheckout>
  try { input = validateAssistanceCheckout(request.data) } catch (error) { throw new HttpsError('invalid-argument', error instanceof Error ? error.message : 'Invalid checkout details.') }
  const mode = liveMode()
  const key = createHash('sha256').update(`${userId}:${input.requestId}`).digest('hex')
  const db = getFirestore()
  const permitRef = db.doc(`users/${userId}/permits/p_${key.slice(0, 24)}`)
  const paymentRef = db.doc(`users/${userId}/payments/pm_${key.slice(0, 24)}`)
  const fingerprint = createHash('sha256').update(JSON.stringify(input)).digest('hex')
  const previous = await paymentRef.get()
  if (previous.exists) {
    if (previous.get('requestFingerprint') !== fingerprint) throw new HttpsError('already-exists', 'This request reference was already used with different payment details.')
    if (previous.get('status') === 'paid') throw new HttpsError('already-exists', 'This assistance payment is already confirmed. Open the saved payment record.')
    return { checkoutUrl: paymongoCheckoutUrl(previous.get('checkoutUrl')), permitId: permitRef.id, paymentId: paymentRef.id, livemode: previous.get('livemode') }
  }
  const amountCentavos = Math.round(input.amount * 100)
  const referenceNumber = `TP-ASST-${key.slice(0, 16).toUpperCase()}`
  const origin = appOrigin()
  const checkout = await providerRequest('/v2/checkout_sessions', { data: { attributes: {
    line_items: [{ amount: amountCentavos, currency: 'PHP', name: `TaxPhil permit assistance — ${input.assistanceReference}`, quantity: 1 }],
    description: 'Payment to TaxPhil for agreed permit assistance services. Government fees and LGU permit issuance are handled separately.',
    payment_method_types: ['card', 'gcash', 'paymaya'],
    success_url: `${origin}/permits/${permitRef.id}/receipt?checkout=returned`,
    cancel_url: `${origin}/permits/${permitRef.id}/receipt?checkout=cancelled`,
    reference_number: referenceNumber, send_email_receipt: false,
    metadata: { userId, permitId: permitRef.id, paymentId: paymentRef.id, purpose: 'taxphil_assistance' },
  } } }, key)
  const checkoutUrl = paymongoCheckoutUrl(checkout.attributes.checkout_url)
  if (checkout.attributes.livemode !== mode) throw new HttpsError('failed-precondition', 'The checkout environment does not match the configured payment account.')
  await db.runTransaction(async (tx) => {
    const old = await tx.get(paymentRef)
    if (old.exists) {
      if (old.get('requestFingerprint') !== fingerprint || old.get('paymongoCheckoutId') !== checkout.id) throw new HttpsError('aborted', 'The payment request changed. Check your saved payment records.')
      return
    }
    const timestamp = FieldValue.serverTimestamp()
    tx.create(permitRef, { businessName: input.businessName, lgu: input.lgu, permitType: input.permitType, year: input.year, amount: input.amount,
      assistanceReference: input.assistanceReference, purpose: 'taxphil_assistance', livemode: mode, status: 'pending', paymentId: paymentRef.id, createdAt: timestamp, updatedAt: timestamp })
    tx.create(paymentRef, { permitId: permitRef.id, amount: input.amount, amountCentavos, currency: 'PHP', status: 'pending',
      paymongoCheckoutId: checkout.id, checkoutUrl, referenceNumber, assistanceReference: input.assistanceReference, purpose: 'taxphil_assistance',
      livemode: mode, requestFingerprint: fingerprint, createdAt: timestamp, updatedAt: timestamp })
  })
  return { checkoutUrl, permitId: permitRef.id, paymentId: paymentRef.id, livemode: mode }
})

async function reconcile(userId: string, permitId: string, paymentId: string, checkout: ProviderCheckout) {
  const db = getFirestore(), permitRef = db.doc(`users/${userId}/permits/${permitId}`), paymentRef = db.doc(`users/${userId}/payments/${paymentId}`)
  return db.runTransaction(async (tx) => {
    const [permit, payment] = await tx.getAll(permitRef, paymentRef)
    if (!permit.exists || !payment.exists || payment.get('permitId') !== permitId || permit.get('paymentId') !== paymentId) throw new HttpsError('not-found', 'Payment record not found.')
    const result = inspectCheckout(checkout, { checkoutId: payment.get('paymongoCheckoutId'), userId, permitId, paymentId,
      amountCentavos: payment.get('amountCentavos'), referenceNumber: payment.get('referenceNumber'), livemode: payment.get('livemode') ?? liveMode() })
    if (payment.get('status') === 'paid') return { status: 'paid', checkoutUrl: null }
    if (result.status === 'paid') {
      const paidAt = result.paidAt && Number.isFinite(result.paidAt) && result.paidAt > 0 ? Timestamp.fromMillis(result.paidAt * 1000) : Timestamp.now()
      tx.update(paymentRef, { status: 'paid', paymongoPaymentId: result.paymentId, channel: result.channel, paidAt, updatedAt: FieldValue.serverTimestamp() })
      tx.update(permitRef, { status: 'paid', updatedAt: FieldValue.serverTimestamp() })
    } else if (result.status === 'expired') {
      tx.update(paymentRef, { status: 'expired', updatedAt: FieldValue.serverTimestamp() })
      tx.update(permitRef, { status: 'expired', updatedAt: FieldValue.serverTimestamp() })
    } else if (result.checkoutUrl) {
      tx.update(paymentRef, { checkoutUrl: result.checkoutUrl, updatedAt: FieldValue.serverTimestamp() })
    }
    return { status: result.status, checkoutUrl: result.checkoutUrl }
  })
}

export const refreshPermitPayment = onCall(options, async (request) => {
  const userId = await verifiedUser(request), permitId = identifier(request.data?.permitId)
  const db = getFirestore(), permit = await db.doc(`users/${userId}/permits/${permitId}`).get()
  if (!permit.exists) throw new HttpsError('not-found', 'Payment record not found.')
  const paymentId = identifier(permit.get('paymentId'))
  const payment = await db.doc(`users/${userId}/payments/${paymentId}`).get()
  if (!payment.exists || payment.get('permitId') !== permitId) throw new HttpsError('not-found', 'Payment record not found.')
  if (payment.get('status') === 'paid') return { status: 'paid', checkoutUrl: null }
  const checkoutId = identifier(payment.get('paymongoCheckoutId'))
  const checkout = await providerRequest(`/v1/checkout_sessions/${checkoutId}`)
  try { return await reconcile(userId, permitId, paymentId, checkout) } catch (error) {
    if (error instanceof HttpsError) throw error
    throw new HttpsError('failed-precondition', error instanceof Error ? error.message : 'Payment details require review.')
  }
})

export function verifyPaymongoSignature(header: string, body: Buffer, secret: string, mode: boolean) {
  const parts: Record<string, string> = {}
  for (const part of header.split(',')) { const index = part.indexOf('='); if (index > 0) parts[part.slice(0, index).trim()] = part.slice(index + 1).trim() }
  const signature = mode ? parts.li : parts.te
  if (!/^\d+$/.test(parts.t || '') || !/^[a-fA-F0-9]{64}$/.test(signature || '')) return false
  const expected = createHmac('sha256', secret).update(`${parts.t}.${body.toString('utf8')}`).digest()
  return timingSafeEqual(expected, Buffer.from(signature, 'hex'))
}

export const paymongoWebhook = onRequest(options, async (req, res) => {
  if (req.method !== 'POST') { res.status(405).send('Method Not Allowed'); return }
  const header = req.get('Paymongo-Signature')
  if (!header || !req.rawBody) { res.status(400).send('Missing signature or body'); return }
  let mode: boolean
  try {
    const secret = process.env.PAYMONGO_WEBHOOK_SECRET
    if (!secret) throw Error('Webhook secret unavailable')
    mode = liveMode()
    if (!verifyPaymongoSignature(header, req.rawBody, secret, mode)) { res.status(401).send('Invalid signature'); return }
  } catch { res.status(500).send('Webhook not configured'); return }
  try {
    const event = JSON.parse(req.rawBody.toString('utf8')) as { data?: { attributes?: { type?: string; livemode?: boolean; data?: ProviderCheckout } } }
    if (event.data?.attributes?.type !== 'checkout_session.payment.paid') { res.status(200).send('Ignored'); return }
    const checkout = event.data.attributes.data
    if (!checkout || event.data.attributes.livemode !== mode) { res.status(400).send('Invalid payment environment'); return }
    const metadata = checkout.attributes?.metadata || {}
    await reconcile(identifier(metadata.userId), identifier(metadata.permitId), identifier(metadata.paymentId), checkout)
    res.status(200).send('OK')
  } catch (error) {
    console.error('Payment confirmation could not be matched', error instanceof Error ? error.message : 'Invalid event')
    res.status(error instanceof HttpsError && error.code === 'not-found' ? 404 : 400).send('Payment confirmation requires review')
  }
})
