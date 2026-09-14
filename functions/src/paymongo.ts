import { createHmac, timingSafeEqual } from 'node:crypto'

import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore'
import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https'

const CALLABLE_REGION = 'asia-southeast1'
const MIN_AMOUNT_PHP = 20
const MIN_YEAR = 2020
const MAX_YEAR = 2035

interface CreatePermitCheckoutInput {
  businessName?: string
  lgu: string
  permitType: 'new' | 'renewal'
  year: number
  amount: number
}

interface PayMongoCheckoutResponse {
  data: {
    id: string
    attributes: {
      checkout_url: string
    }
  }
}

interface PayMongoWebhookEvent {
  data: {
    id: string
    attributes: {
      type: string
      data: {
        id: string
        attributes: {
          reference_number?: string
          metadata?: Record<string, string>
          payments?: Array<{
            id: string
            attributes?: {
              source?: {
                type?: string
              }
            }
          }>
        }
      }
    }
  }
}

function getAppOrigin(): string {
  return process.env.APP_ORIGIN ?? 'https://philtax.web.app'
}

function getPayMongoSecretKey(): string {
  const key = process.env.PAYMONGO_SECRET_KEY
  if (!key) {
    throw new HttpsError(
      'failed-precondition',
      'PayMongo is not configured. Add PAYMONGO_SECRET_KEY (sk_test_…) to functions/.env and redeploy functions.',
    )
  }
  return key
}

function getWebhookSecret(): string {
  const secret = process.env.PAYMONGO_WEBHOOK_SECRET
  if (!secret) {
    throw new Error('PAYMONGO_WEBHOOK_SECRET is not configured.')
  }
  return secret
}

function assertVerifiedUser(auth: {
  uid: string
  token: Record<string, unknown>
}): string {
  if (!auth.uid) {
    throw new HttpsError('unauthenticated', 'Sign in to continue.')
  }

  if (auth.token.email_verified !== true) {
    throw new HttpsError(
      'permission-denied',
      'Verify your email before paying permit fees.',
    )
  }

  return auth.uid
}

function validateCheckoutInput(data: unknown): CreatePermitCheckoutInput {
  if (!data || typeof data !== 'object') {
    throw new HttpsError('invalid-argument', 'Invalid request payload.')
  }

  const payload = data as Record<string, unknown>

  const lgu = typeof payload.lgu === 'string' ? payload.lgu.trim() : ''
  const permitType = payload.permitType
  const year = payload.year
  const amount = payload.amount
  const businessName =
    typeof payload.businessName === 'string'
      ? payload.businessName.trim()
      : undefined

  if (!lgu || lgu.length > 120) {
    throw new HttpsError(
      'invalid-argument',
      'City or municipality is required (max 120 characters).',
    )
  }

  if (permitType !== 'new' && permitType !== 'renewal') {
    throw new HttpsError('invalid-argument', 'Permit type must be new or renewal.')
  }

  if (typeof year !== 'number' || !Number.isInteger(year)) {
    throw new HttpsError('invalid-argument', 'Permit year must be a whole number.')
  }

  if (year < MIN_YEAR || year > MAX_YEAR) {
    throw new HttpsError(
      'invalid-argument',
      `Permit year must be between ${MIN_YEAR} and ${MAX_YEAR}.`,
    )
  }

  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    throw new HttpsError('invalid-argument', 'Amount must be a valid number.')
  }

  if (amount < MIN_AMOUNT_PHP) {
    throw new HttpsError(
      'invalid-argument',
      `Minimum permit fee is ₱${MIN_AMOUNT_PHP}.`,
    )
  }

  if (businessName && businessName.length > 200) {
    throw new HttpsError(
      'invalid-argument',
      'Business name must be 200 characters or fewer.',
    )
  }

  return {
    businessName,
    lgu,
    permitType,
    year,
    amount: Math.round(amount * 100) / 100,
  }
}

function generateReferenceNumber(userId: string): string {
  const suffix = userId.slice(0, 6).toUpperCase()
  const stamp = Date.now().toString(36).toUpperCase()
  return `TP-PERM-${suffix}-${stamp}`
}

function verifyPaymongoSignature(
  signatureHeader: string,
  rawBody: Buffer,
  webhookSecret: string,
): boolean {
  const parts = signatureHeader.split(',')
  const parsed: Record<string, string> = {}

  for (const part of parts) {
    const [key, value] = part.split('=')
    if (key && value) {
      parsed[key.trim()] = value.trim()
    }
  }

  const timestamp = parsed.t
  const liveSignature = parsed.li
  const testSignature = parsed.te
  const signature = liveSignature ?? testSignature

  if (!timestamp || !signature) {
    return false
  }

  const payload = `${timestamp}.${rawBody.toString('utf8')}`
  const expected = createHmac('sha256', webhookSecret)
    .update(payload)
    .digest('hex')

  try {
    const expectedBuffer = Buffer.from(expected, 'hex')
    const signatureBuffer = Buffer.from(signature, 'hex')

    if (expectedBuffer.length !== signatureBuffer.length) {
      return false
    }

    return timingSafeEqual(expectedBuffer, signatureBuffer)
  } catch {
    return false
  }
}

async function createPayMongoCheckoutSession(params: {
  amountCentavos: number
  lineItemName: string
  referenceNumber: string
  successUrl: string
  cancelUrl: string
  metadata: Record<string, string>
}): Promise<{ checkoutId: string; checkoutUrl: string }> {
  const secretKey = getPayMongoSecretKey()
  const authHeader = Buffer.from(`${secretKey}:`).toString('base64')

  const response = await fetch('https://api.paymongo.com/v2/checkout_sessions', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${authHeader}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      data: {
        attributes: {
          line_items: [
            {
              amount: params.amountCentavos,
              currency: 'PHP',
              name: params.lineItemName,
              quantity: 1,
            },
          ],
          payment_method_types: ['card', 'gcash', 'paymaya'],
          success_url: params.successUrl,
          cancel_url: params.cancelUrl,
          reference_number: params.referenceNumber,
          metadata: params.metadata,
        },
      },
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    console.error('PayMongo checkout failed', response.status, errorBody)
    throw new HttpsError(
      'internal',
      'Could not start checkout. Try again in a moment.',
    )
  }

  const body = (await response.json()) as PayMongoCheckoutResponse

  return {
    checkoutId: body.data.id,
    checkoutUrl: body.data.attributes.checkout_url,
  }
}

async function supersedePendingPermits(
  userId: string,
  lgu: string,
  year: number,
  permitType: 'new' | 'renewal',
): Promise<void> {
  const db = getFirestore()
  const permitsRef = db.collection(`users/${userId}/permits`)
  const pendingSnapshot = await permitsRef
    .where('lgu', '==', lgu)
    .where('year', '==', year)
    .where('permitType', '==', permitType)
    .where('status', '==', 'pending')
    .get()

  if (pendingSnapshot.empty) return

  const batch = db.batch()
  const now = FieldValue.serverTimestamp()

  for (const permitDoc of pendingSnapshot.docs) {
    const permitData = permitDoc.data()
    const paymentId =
      typeof permitData.paymentId === 'string' ? permitData.paymentId : null

    batch.update(permitDoc.ref, {
      status: 'expired',
      updatedAt: now,
    })

    if (paymentId) {
      const paymentRef = db.doc(`users/${userId}/payments/${paymentId}`)
      batch.update(paymentRef, {
        status: 'superseded',
        updatedAt: now,
      })
    }
  }

  await batch.commit()
}

export const createPermitCheckout = onCall(
  { region: CALLABLE_REGION, cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Sign in to continue.')
    }

    const userId = assertVerifiedUser(request.auth)
    const input = validateCheckoutInput(request.data)

    const db = getFirestore()
    const userDoc = await db.doc(`users/${userId}`).get()
    const profile = userDoc.data()

    const businessName =
      input.businessName ||
      (typeof profile?.businessName === 'string'
        ? profile.businessName.trim()
        : '') ||
      (typeof profile?.fullName === 'string' ? profile.fullName.trim() : '') ||
      (typeof profile?.displayName === 'string'
        ? profile.displayName.trim()
        : '')

    if (!businessName) {
      throw new HttpsError(
        'invalid-argument',
        'Business name is required. Add it in Settings or the permit form.',
      )
    }

    await supersedePendingPermits(
      userId,
      input.lgu,
      input.year,
      input.permitType,
    )

    const amountCentavos = Math.round(input.amount * 100)
    const referenceNumber = generateReferenceNumber(userId)
    const permitRef = db.collection(`users/${userId}/permits`).doc()
    const paymentRef = db.collection(`users/${userId}/payments`).doc()
    const now = FieldValue.serverTimestamp()

    const lineItemName = `Mayor's Permit ${input.year} — ${input.lgu}`
    const appOrigin = getAppOrigin()
    const successUrl = `${appOrigin}/permits/${permitRef.id}/receipt`
    const cancelUrl = `${appOrigin}/permits?checkout=cancelled`

    const checkout = await createPayMongoCheckoutSession({
      amountCentavos,
      lineItemName,
      referenceNumber,
      successUrl,
      cancelUrl,
      metadata: {
        userId,
        permitId: permitRef.id,
        paymentId: paymentRef.id,
      },
    })

    const batch = db.batch()

    batch.set(permitRef, {
      businessName,
      lgu: input.lgu,
      permitType: input.permitType,
      year: input.year,
      amount: input.amount,
      status: 'pending',
      paymentId: paymentRef.id,
      createdAt: now,
      updatedAt: now,
    })

    batch.set(paymentRef, {
      permitId: permitRef.id,
      amount: input.amount,
      amountCentavos,
      currency: 'PHP',
      status: 'pending',
      paymongoCheckoutId: checkout.checkoutId,
      referenceNumber,
      createdAt: now,
      updatedAt: now,
    })

    await batch.commit()

    return {
      checkoutUrl: checkout.checkoutUrl,
      permitId: permitRef.id,
      paymentId: paymentRef.id,
    }
  },
)

export const paymongoWebhook = onRequest(
  { region: CALLABLE_REGION },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed')
      return
    }

    const signatureHeader = req.get('Paymongo-Signature')
    const rawBody = req.rawBody

    if (!signatureHeader || !rawBody) {
      res.status(400).send('Missing signature or body')
      return
    }

    let webhookSecret: string
    try {
      webhookSecret = getWebhookSecret()
    } catch (error) {
      console.error('Webhook secret missing', error)
      res.status(500).send('Webhook not configured')
      return
    }

    if (!verifyPaymongoSignature(signatureHeader, rawBody, webhookSecret)) {
      res.status(401).send('Invalid signature')
      return
    }

    let event: PayMongoWebhookEvent
    try {
      event = JSON.parse(rawBody.toString('utf8')) as PayMongoWebhookEvent
    } catch {
      res.status(400).send('Invalid JSON')
      return
    }

    const eventType = event.data?.attributes?.type
    if (eventType !== 'checkout_session.payment.paid') {
      res.status(200).send('Ignored')
      return
    }

    const checkoutData = event.data.attributes.data
    const metadata = checkoutData.attributes.metadata ?? {}
    const userId = metadata.userId
    const permitId = metadata.permitId
    const paymentId = metadata.paymentId

    if (!userId || !permitId || !paymentId) {
      console.error('Webhook missing metadata', metadata)
      res.status(400).send('Missing metadata')
      return
    }

    const db = getFirestore()
    const paymentRef = db.doc(`users/${userId}/payments/${paymentId}`)
    const permitRef = db.doc(`users/${userId}/permits/${permitId}`)

    const paymentSnap = await paymentRef.get()
    if (!paymentSnap.exists) {
      console.error('Payment not found', paymentId)
      res.status(404).send('Payment not found')
      return
    }

    const paymentData = paymentSnap.data()
    if (paymentData?.status === 'paid') {
      res.status(200).send('Already processed')
      return
    }

    const payments = checkoutData.attributes.payments ?? []
    const paymongoPaymentId = payments[0]?.id
    const channel = payments[0]?.attributes?.source?.type

    const now = Timestamp.now()

    const batch = db.batch()

    batch.update(paymentRef, {
      status: 'paid',
      paymongoPaymentId: paymongoPaymentId ?? null,
      channel: channel ?? null,
      paidAt: now,
      updatedAt: FieldValue.serverTimestamp(),
    })

    batch.update(permitRef, {
      status: 'paid',
      updatedAt: FieldValue.serverTimestamp(),
    })

    await batch.commit()

    res.status(200).send('OK')
  },
)
