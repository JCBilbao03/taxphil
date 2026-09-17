export interface AssistanceCheckoutInput {
  businessName: string; lgu: string; permitType: 'new' | 'renewal'; year: number; amount: number
  assistanceReference: string; acknowledgedMerchant: boolean; requestId: string
}
export function validateAssistanceCheckout(input: unknown, currentYear = Number(new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'Asia/Manila' }).format(new Date()))): AssistanceCheckoutInput {
  if (!input || typeof input !== 'object') throw new Error('Payment details are required.')
  const value = input as Record<string, unknown>
  const string = (key: string, label: string, max: number) => {
    if (typeof value[key] !== 'string' || !value[key].trim() || value[key].length > max) throw new Error(`${label} is required (maximum ${max} characters).`)
    return value[key].trim()
  }
  if (value.permitType !== 'new' && value.permitType !== 'renewal') throw new Error('Choose a new permit or renewal assistance request.')
  if (typeof value.year !== 'number' || !Number.isInteger(value.year) || value.year < 2020 || value.year > currentYear + 2) throw new Error(`Enter a permit year between 2020 and ${currentYear + 2}.`)
  const amount = value.amount
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 20 || amount > 1_000_000 || Math.abs(amount * 100 - Math.round(amount * 100)) > 0.00001) throw new Error('Enter an agreed assistance fee between ₱20 and ₱1,000,000, with at most two decimal places.')
  if (value.acknowledgedMerchant !== true) throw new Error('Confirm that this payment is for TaxPhil assistance services.')
  if (typeof value.requestId !== 'string' || !/^[a-zA-Z0-9-]{16,64}$/.test(value.requestId)) throw new Error('A valid payment request reference is required.')
  return { businessName: string('businessName', 'Business name', 200), lgu: string('lgu', 'City or municipality', 120), permitType: value.permitType, year: value.year,
    amount: Math.round(amount * 100) / 100, assistanceReference: string('assistanceReference', 'TaxPhil quote or service reference', 100), acknowledgedMerchant: true, requestId: value.requestId }
}

export function paymongoCheckoutUrl(value: unknown): string {
  let url: URL
  try { url = new URL(typeof value === 'string' ? value : '') } catch { throw new Error('The payment provider returned an invalid checkout link.') }
  if (url.protocol !== 'https:' || url.hostname !== 'checkout.paymongo.com' || url.username || url.password || url.port || url.pathname.length < 2) throw new Error('The payment provider returned an invalid checkout link.')
  return url.href
}

export interface ProviderCheckout {
  id: string
  attributes: {
    checkout_url?: string; status?: string; livemode?: boolean; reference_number?: string
    metadata?: Record<string, string>
    payments?: Array<{ id: string; attributes?: { status?: string; amount?: number; currency?: string; livemode?: boolean; paid_at?: number; source?: { type?: string } } }>
  }
}

export function inspectCheckout(checkout: ProviderCheckout, expected: { checkoutId: string; userId: string; permitId: string; paymentId: string; amountCentavos: number; referenceNumber: string; livemode: boolean }) {
  if (!checkout?.attributes || checkout.id !== expected.checkoutId) throw new Error('Checkout reference does not match this payment.')
  const details = checkout.attributes, metadata = details.metadata || {}
  if (metadata.userId !== expected.userId || metadata.permitId !== expected.permitId || metadata.paymentId !== expected.paymentId || details.reference_number !== expected.referenceNumber) throw new Error('Checkout ownership or order reference does not match.')
  if (details.livemode !== expected.livemode) throw new Error('The payment environment does not match this order.')
  const paid = (details.payments || []).filter((payment) => payment.attributes?.status === 'paid')
  if (paid.length) {
    const valid = paid.find((payment) => payment.id && payment.attributes?.amount === expected.amountCentavos && payment.attributes.currency === 'PHP' && (payment.attributes.livemode === undefined || payment.attributes.livemode === expected.livemode))
    if (!valid) throw new Error('The confirmed payment amount or currency does not match this order.')
    return { status: 'paid' as const, paymentId: valid.id, channel: valid.attributes?.source?.type || '', paidAt: valid.attributes?.paid_at || null, checkoutUrl: null }
  }
  if (details.status === 'expired') return { status: 'expired' as const, checkoutUrl: null }
  return { status: 'pending' as const, checkoutUrl: details.checkout_url ? paymongoCheckoutUrl(details.checkout_url) : null }
}
