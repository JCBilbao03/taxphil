# Production deployment — 17 September 2026

## Published

- Website: https://taxphil.com and https://philtax.web.app, Firebase project `philtax`.
- All 26 Cloud Functions report `ACTIVE` on Node.js 22. The support database trigger runs in `us-central1`; the other functions run in `asia-southeast1`.
- Firestore, Realtime Database and Storage rules were released. The configured Firestore composite index reports `READY`.
- The default attachment bucket `philtax.firebasestorage.app` was provisioned in `ASIA-SOUTHEAST1`. Website origins are allowed for downloads, and the Firebase Storage service agent has the Firestore membership-lookup role required by the rules.
- Existing production settings were preserved through an ignored, permission-restricted `functions/.env.philtax`. No credentials are committed.

## Callable access restored

The 17 new browser-callable services initially returned HTTP 403 before requests reached Firebase authentication. The first build failed before the normal callable invocation policy was installed; a successful update did not restore that policy.

After the user's explicit approval on 17 September 2026, the repair added `allUsers` to `roles/run.invoker` only on these callable services, preserving existing IAM bindings. This is transport access, not permission to read company records: the handlers still require Firebase sign-in, verified identity and applicable company roles. Scheduled, event-triggered and auth-blocking service policies were excluded. Every affected service's policy was read back and verified.

Affected services: `companyCreate`, `companyJoin`, `companyInvite`, `companySetMemberRole`, `companyUpdateProfile`, `companyAccountingCommand`, `consultationCreate`, `consultationUpdate`, `companyPartySave`, `companyPayroll`, `refreshPermitPayment`, `companyWorkflowSave`, `companyTaxMappingSave`, `companyTaxTemplateSave`, `companyTaxRegisterSave`, `companyTaxDraftCreate`, `companyTaxDraftReview`.

Automatic approval review initially required explicit permission for this access change; the user approved it and the repair completed. Live checks now reach the callable handlers and reject unsigned requests with JSON `401 UNAUTHENTICATED` instead of the earlier transport-level HTML 403.

## Regulatory updates

`dailyRegulatorySync` is deployed and its Scheduler job is enabled for `0 8 * * *`, timezone `Asia/Manila`. The first production run successfully discovered 33 BIR Revenue Regulations, 206 Revenue Memorandum Circulars and 72 Revenue Memorandum Orders (311 total). SEC returned HTTP 403 and is recorded as failed, with manual source review required. A partial source failure does not erase successful BIR results and can make the overall scheduled execution report a failure.

## Payment configuration

Production `PAYMONGO_SECRET_KEY` and `PAYMONGO_WEBHOOK_SECRET` are empty. They were already empty before this deployment. Online payment creation, payment refresh and signed callback reconciliation cannot be validated or used until valid provider credentials are configured. The existing HTTPS `APP_ORIGIN` is preserved. No checkout, charge, email or customer transaction was created during release checks.

## Verification

- 235 application tests passed after installing the exact backend npm lockfile; frontend and backend builds passed.
- 151 isolated Firebase Emulator assertions passed against the deployed rule files: company isolation, four roles, private employee/payroll/tax records, denied direct writes, document permissions, immutable uploads and size/MIME limits. The reproducible suite is in `tests/security-rules`.
- Both public hostnames serve the expected frontend release. Live JavaScript and CSS SHA-256 hashes match the local build.
- Browser checks passed for the homepage, About, guides, videos and Help. A fresh `/accounting/library` visit redirects a signed-out visitor to `/login`.
- Live unsigned requests to company creation, accounting, party directory, payroll, tax draft, compliance workflow, consultation and payment-refresh callables all return JSON `401 UNAUTHENTICATED`. Website asset hashes, webhook GET rejection and attachment CORS were rechecked after the access repair.
- The hosted payment webhook rejects GET with HTTP 405. The document download CORS preflight succeeds.
- Scoped signed-in production checks passed using five synthetic verified users and two temporary companies: company creation/invitations, all four roles, cross-company isolation, vendor/customer TIN snapshots on invoices, partial receipt/payment uploads, append-only later evidence without a second ledger posting, authorized downloads and foreign-company rejection, employee privacy, independent payroll approval and TIN tax-register flow, mapped tax draft creation and independent review. All owned test users, company documents and evidence were removed afterward. These checks exercise deployed APIs and rules; they do not certify statutory calculations, payment-provider integration, every browser path or official BIR filing.

## Deployment fixes

Functions uploads now exclude competing pnpm lock/workspace files so Google builds use the tested `functions/package-lock.json`. The initial pnpm-selected cloud build failed; the npm-based retry successfully deployed all functions. Storage creates explicitly require `resource == null` to prevent evidence replacement regardless of create/update classification.

The deployment does not implement the paused Asset Tracking, bank-statement import/reconciliation or remaining statutory filing integrations. See `WORK-PLAN.md` and `CONNECTED-ACCOUNTING.md` for feature scope.

## Asset, bank, payments and statutory-payroll release — prepared 17 September 2026

Production deployment pending verification below. This release adds the companyAssets, companyBank and companyPayments callables, private bank/payment collections, immutable bank-statement storage, and updates accounting/payroll/tax services. It does not deploy Firebase Auth settings or change the existing authorized-domain configuration.

Local validation: 341 application tests passed, 382 Firebase Rules emulator assertions, frontend/backend TypeScript and the production build. Browser checks used isolated fictional-company fixtures: asset-to-GL reconciliation, saved tax asset snapshots, CSV reading/population/correction/save/matching, a check release that settles its bill while remaining outstanding at the bank, and full-month payroll contribution/withholding previews applied and saved with their review evidence. The file-picker automation timed out; CSV parsing was exercised through a DEV-only sample loader using the same reader, with live authenticated file upload to be tested separately.

See ASSET-TRACKING.md, BANK-RECONCILIATION.md, PAYMENT-APPROVALS.md and PAYROLL-STATUTORY.md for verified scope, official sources and current limits.
