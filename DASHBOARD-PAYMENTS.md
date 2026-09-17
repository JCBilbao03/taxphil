# Dashboard and assistance payments

The dashboard now defaults to quarter-to-date and offers month-to-date, year-to-date, and all-time filters. Amounts use the actual transaction dates, exclude future-dated entries, and sum in centavos. Overdue obligations, obligations due in the current quarter, and total pending records are separate counts. Loading or failed data is shown as unavailable rather than zero. These are personal tracker figures; links open the separate UBB Accounting company books and compliance workspace.

Tax synchronization clears the previous account's arrays, waits for both transaction and deadline snapshots or errors, preserves errors by source, and ignores callbacks after cleanup. Permit/payment synchronization also clears previous account records before loading.

## Payment purpose

The existing PayMongo integration receives funds in the configured TaxPhil merchant account. It does not remit LGU taxes, issue government permits, or produce an official LGU receipt. The form and records now describe TaxPhil permit assistance services consistently. Customers enter the agreed assistance fee and the TaxPhil service/quote reference and acknowledge the recipient. This reference is customer-entered; a separate server-maintained quotation catalogue and service-fulfillment workflow have not been implemented.

## Functional changes

- The form validates required names/reference, year bounds, precise two-decimal amounts, and merchant acknowledgment. It can be used even when automatic business-profile loading fails.
- Repeating the same unchanged request reuses stable local record IDs and a PayMongo idempotency key. The caller retains the request ID across a failed attempt. Starting another request no longer silently expires unrelated pending records.
- New payment records save the hosted checkout link and test/live mode. Pending records can resume the same checkout. Failed or expired requests can prefill a replacement form for review.
- `refreshPermitPayment({permitId})` retrieves the owning user's PayMongo session and reconciles provider status. Browser success/cancel return parameters never establish payment status.
- The webhook and refresh flow validate the checkout ID, owner/order metadata, reference, environment, actual paid payment amount and currency, then atomically update the payment and assistance record. A duplicate paid webhook leaves the confirmed record unchanged.
- A pending record no longer says money was received. Test-mode confirmations explicitly say no real funds were transferred. Records can be printed, and always distinguish TaxPhil assistance payment records from LGU receipts.

`createPermitCheckout`, `refreshPermitPayment`, `paymongoWebhook` and the frontend must be deployed together. Existing `PAYMONGO_SECRET_KEY`, `PAYMONGO_WEBHOOK_SECRET`, and HTTPS `APP_ORIGIN` settings must be configured for the intended environment. The webhook must subscribe to `checkout_session.payment.paid`. No payments, checkouts, or external messages were created while implementing or testing these changes. No deployment was performed.

## Verification and remaining integration checks

Eighteen focused tests cover dashboard periods/counts, tax-stream readiness/account isolation, checkout validation, hosted-link safety, exact provider matching, request idempotency, current auth, provider failures, signed webhook tampering and duplicate delivery. Provider requests use a local fetch double; no live gateway calls occur. Frontend/backend TypeScript checks pass. Firebase Rules emulator checks and a controlled PayMongo test-mode end-to-end checkout remain deployment prerequisites. Historical records missing test/live metadata display that limitation. Refund and chargeback reconciliation are not added in this bounded change.

Official provider references checked during implementation: [Checkout Session resource](https://docs.paymongo.com/reference/checkout-session-resource), [Hosted Checkout](https://docs.paymongo.com/docs/payment-channels-hosted-checkout), [webhook signatures](https://docs.paymongo.com/docs/developer-tools-webhook-setup-management), and [idempotency guidance](https://docs.paymongo.com/docs/developer-tools-best-practices-1). PayMongo documents that the cancel URL only returns the customer to the merchant and does not cancel records. Session status is active/expired; successful payment must be read from its payment records or webhook.
