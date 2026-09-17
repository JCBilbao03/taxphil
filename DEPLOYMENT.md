# Production deployment — 17 September 2026

## Published

- Website: https://taxphil.com and https://philtax.web.app, Firebase project `philtax`.
- All 26 Cloud Functions report `ACTIVE` on Node.js 22. The support database trigger runs in `us-central1`; the other functions run in `asia-southeast1`.
- Firestore, Realtime Database and Storage rules were released. The configured Firestore composite index reports `READY`.
- The default attachment bucket `philtax.firebasestorage.app` was provisioned in `ASIA-SOUTHEAST1`. Website origins are allowed for downloads, and the Firebase Storage service agent has the Firestore membership-lookup role required by the rules.
- Existing production settings were preserved through an ignored, permission-restricted `functions/.env.philtax`. No credentials are committed.

## Required access approval

The 17 new browser-callable services are deployed, but their Cloud Run transport currently returns HTTP 403 before requests reach Firebase authentication. The first build failed before the normal callable invocation policy was installed; a successful update did not restore that policy.

The prepared repair adds `allUsers` to `roles/run.invoker` only on these callable services, preserving existing IAM bindings. This is transport access, not permission to read company records: the handlers still require Firebase sign-in, verified identity and applicable company roles. Scheduled, event-triggered and auth-blocking service policies are excluded.

Affected services: `companyCreate`, `companyJoin`, `companyInvite`, `companySetMemberRole`, `companyUpdateProfile`, `companyAccountingCommand`, `consultationCreate`, `consultationUpdate`, `companyPartySave`, `companyPayroll`, `refreshPermitPayment`, `companyWorkflowSave`, `companyTaxMappingSave`, `companyTaxTemplateSave`, `companyTaxRegisterSave`, `companyTaxDraftCreate`, `companyTaxDraftReview`.

Automatic approval review rejected this IAM change as broader public access than deployment alone authorized. Explicit user approval is pending. The public website is live; the affected workflows are not operational until this is resolved.

## Regulatory updates

`dailyRegulatorySync` is deployed and its Scheduler job is enabled for `0 8 * * *`, timezone `Asia/Manila`. The first production run successfully discovered 33 BIR Revenue Regulations, 206 Revenue Memorandum Circulars and 72 Revenue Memorandum Orders (311 total). SEC returned HTTP 403 and is recorded as failed, with manual source review required. A partial source failure does not erase successful BIR results and can make the overall scheduled execution report a failure.

## Payment configuration

Production `PAYMONGO_SECRET_KEY` and `PAYMONGO_WEBHOOK_SECRET` are empty. They were already empty before this deployment. Online payment creation, payment refresh and signed callback reconciliation cannot be validated or used until valid provider credentials are configured. The existing HTTPS `APP_ORIGIN` is preserved. No checkout, charge, email or customer transaction was created during release checks.

## Verification

- 235 application tests passed after installing the exact backend npm lockfile; frontend and backend builds passed.
- 151 isolated Firebase Emulator assertions passed against the deployed rule files: company isolation, four roles, private employee/payroll/tax records, denied direct writes, document permissions, immutable uploads and size/MIME limits. The reproducible suite is in `tests/security-rules`.
- Both public hostnames serve the expected frontend release. Live JavaScript and CSS SHA-256 hashes match the local build.
- Browser checks passed for the homepage, About, guides, videos and Help. A fresh `/accounting/library` visit redirects a signed-out visitor to `/login`.
- The existing payment callable returns JSON `401 UNAUTHENTICATED` without credentials. The new callable checks currently stop at the transport-access issue described above.
- The hosted payment webhook rejects GET with HTTP 405. The document download CORS preflight succeeds.
- Full signed-in, multi-account production workflows and actual document uploads were not exercised. Emulator tests and unauthenticated smoke checks do not establish end-to-end production correctness.

## Deployment fixes

Functions uploads now exclude competing pnpm lock/workspace files so Google builds use the tested `functions/package-lock.json`. The initial pnpm-selected cloud build failed; the npm-based retry successfully deployed all functions. Storage creates explicitly require `resource == null` to prevent evidence replacement regardless of create/update classification.

The deployment does not implement the paused Asset Tracking, bank-statement import/reconciliation or remaining statutory filing integrations. See `WORK-PLAN.md` and `CONNECTED-ACCOUNTING.md` for feature scope.
