import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { inspectCheckout, paymongoCheckoutUrl, validateAssistanceCheckout, type ProviderCheckout } from '../src/lib/permit-payments.ts'
const input = { businessName: 'Example Trading', lgu: 'Makati', permitType: 'renewal', year: 2026, amount: 1000.15, assistanceReference: 'Q-001', acknowledgedMerchant: true, requestId: '12345678-1234-1234-1234-123456789012' }
const expected = { checkoutId: 'cs_test', userId: 'user1', permitId: 'permit1', paymentId: 'payment1', amountCentavos: 100015, referenceNumber: 'TP-ASST-1', livemode: false }
const checkout: ProviderCheckout = { id: 'cs_test', attributes: { status: 'active', livemode: false, checkout_url: 'https://checkout.paymongo.com/cs_test#public-key', reference_number: expected.referenceNumber, metadata: { userId: 'user1', permitId: 'permit1', paymentId: 'payment1' }, payments: [] } }

test('assistance checkout requires merchant acknowledgement, service reference and bounded precise amount', () => {
  assert.equal(validateAssistanceCheckout(input, 2026).amount, 1000.15)
  for (const patch of [{ acknowledgedMerchant: false }, { assistanceReference: '' }, { businessName: '' }, { amount: 19.99 }, { amount: 20.001 }, { amount: 1_000_001 }, { amount: NaN }, { year: 2029 }, { requestId: '../bad' }]) assert.throws(() => validateAssistanceCheckout({ ...input, ...patch }, 2026))
})

test('checkout links allow only the hosted PayMongo origin', () => {
  assert.equal(paymongoCheckoutUrl(checkout.attributes.checkout_url), checkout.attributes.checkout_url)
  for (const url of ['javascript:alert(1)', 'https://checkout.paymongo.com.evil.test/x', 'http://checkout.paymongo.com/x', 'https://user:pw@checkout.paymongo.com/x']) assert.throws(() => paymongoCheckoutUrl(url))
})

test('an active checkout or browser return is not payment confirmation', () => {
  assert.equal(inspectCheckout(checkout, expected).status, 'pending')
  assert.equal(inspectCheckout({ ...checkout, attributes: { ...checkout.attributes, status: 'expired' } }, expected).status, 'expired')
  assert.equal(inspectCheckout({ ...checkout, attributes: { ...checkout.attributes, payments: [{ id: 'failed', attributes: { status: 'failed', amount: 100015, currency: 'PHP' } }] } }, expected).status, 'pending')
})

test('confirmation requires matching order, owner, provider ID, environment, amount and currency', () => {
  const paid: ProviderCheckout = { ...checkout, attributes: { ...checkout.attributes, payments: [{ id: 'pay_1', attributes: { status: 'paid', amount: 100015, currency: 'PHP', livemode: false, source: { type: 'gcash' } } }] } }
  assert.equal(inspectCheckout(paid, expected).status, 'paid')
  for (const patch of [{ checkoutId: 'other' }, { userId: 'other' }, { permitId: 'other' }, { paymentId: 'other' }, { referenceNumber: 'other' }, { amountCentavos: 1 }, { livemode: true }]) assert.throws(() => inspectCheckout(paid, { ...expected, ...patch }))
  assert.throws(() => inspectCheckout({ ...paid, attributes: { ...paid.attributes, payments: [{ id: 'pay_1', attributes: { status: 'paid', amount: 100015, currency: 'USD' } }] } }, expected))
})

test('frontend and server share identical payment validation', () => {
  assert.equal(readFileSync(new URL('../src/lib/permit-payments.ts', import.meta.url), 'utf8'), readFileSync(new URL('../functions/src/permit-payments.ts', import.meta.url), 'utf8'))
})
