# Company accounting service

This service provides a company ledger, member roles, transaction approval, and an append-only application audit trail. It does not certify Philippine regulatory compliance, issue BIR-registered invoices, submit returns, transfer funds, or verify registration identifiers against agency records. Invoice actions record existing business documents for bookkeeping. Company tax setup and statutory use require separate accountant and registration review.

## Identity and data ownership

- One permanent `companyMemberships/{uid}` document links a user to one company, including after access is disabled. There is no browser action for replacing that membership or creating a second company.
- Every callable requires an authenticated, verified email and checks the current Firebase Auth user for disabled or changed-email status. Existing-member operations read active membership and company-member records inside their transaction.
- A random company code identifies the company. Joining also requires a 192-bit random invitation code bound to the verified email. Only the SHA-256 token hash is stored. Invitations expire after seven days and are consumed in the same transaction as membership creation.
- An Admin can invite, update the profile, and change another member's role/access. Self-demotion and self-deactivation are blocked. The company keeps at least one active Admin.
- Accountants prepare journals, supplier bills, and customer invoices. Managers and Admins can post directly and approve prepared records. A preparer cannot approve their own record after promotion. Only Managers and Admins can settle, reverse, add accounts, or close periods. Viewers read records only.
- Firestore rules permit active verified members to read only their own company. All company, membership, books, approvals and audit writes are denied to browser clients. Company codes and invitation hashes cannot be read by browser clients. Existing unrelated user/support rules are preserved.

## Stored documents

| Path | Data |
|---|---|
| `companyMemberships/{uid}` | `companyId`, `companyCode`, `uid`, `email`, `displayName`, `role`, `active`, `joinedAt`, `updatedAt` |
| `companyCodes/{companyCode}` | Server-only reservation containing `companyId` |
| `companies/{companyId}` | `profile`, `companyCode`, `code` alias, `name`, active `adminCount`, creator and timestamps |
| `companies/{companyId}/members/{uid}` | Company-readable membership copy |
| `companies/{companyId}/accounting/books` | `books`, integer `revision`, `pendingCount`, `updatedAt` |
| `companies/{companyId}/approvals/{id}` | Sanitized `command: {type,input}`, `status`, `preparedBy`, `createdBy` alias, `preparedByEmail`, `preparedAt`, `createdAt`, `summary`, and decision metadata when reviewed |
| `companies/{companyId}/audit/{id}` | Actor UID/email, action, summary, ISO timestamp, and relevant revision/entry IDs or changed profile/access values |
| `companies/{companyId}/invitations/{sha256}` | Email, role, expiry, status, inviter and acceptance metadata; server only |

All timestamps are ISO UTC strings. Accounting calendar dates use Asia/Manila. Monetary values are safe integer centavos. The company profile follows `src/lib/ph-compliance.ts`; `accountantReviewRequired` is always true. The server generates the company code and ignores caller-provided company IDs and role claims for selecting books.

## Callable API

All callables run in `asia-southeast1`.

- `companyCreate({profile})` returns `{companyId,companyCode,role:'admin',revision:0}`.
- `companyJoin({companyCode,inviteCode})` returns `{companyId,companyCode,role}`.
- `companyInvite({email,role})` returns `{companyCode,inviteCode,expiresAt}`. The interface must present the code for manual sharing; the service sends no email.
- `companySetMemberRole({uid,role,active})` returns `{uid,role,active}`.
- `companyUpdateProfile({profile})` returns `{profile}`.
- `companyAccountingCommand({command,expectedRevision})` returns `{revision,status,pendingId?}`.

Supported commands:

```ts
{ type: 'post', input: { date, reference, description, lines: [{account,debit,credit}], source?: 'journal' } }
{ type: 'addInvoice', input: { kind: 'payable'|'receivable', party, reference, date, due, amount, account, taxTreatment: 'VAT12'|'VAT_ZERO'|'VAT_EXEMPT'|'NON_VAT', partyTin?, partyAddress?, description? } }
{ type: 'settle', input: { invoiceId, amount, date, cash, reference } }
{ type: 'reverse', input: { entryId, date } }
{ type: 'addAccount', input: { code, name, type: 'Asset'|'Liability'|'Equity'|'Revenue'|'Expense', cash } }
{ type: 'closePeriod', date }
{ type: 'approve', pendingId }
{ type: 'reject', pendingId, reason? }
```

Flat payloads also work where their fields do not conflict with the command `type`; use nested `input` for account creation. `restore` is expressly rejected for shared books. Caller-supplied ledger source types, reversal links, calculated VAT amounts, record IDs and timestamps cannot bypass the specific command validation.

Each accepted accounting command increments `revision`, including preparation and rejection when ledger contents are unchanged. A stale revision returns `aborted`; refresh and let the user retry rather than blindly replaying. The transaction rechecks role and membership, validates against current books, and writes the new revision and audit together. Approval revalidates the original prepared command, so a closed period or intervening duplicate reference can prevent posting. No changes are committed when validation fails.

Invoice `amount` is always the gross total. For VAT12, VAT is rounded half-up from `gross * 12 / 112` using exact integer arithmetic, and net is the remainder. Client VAT/net values are ignored. Non-VAT companies cannot charge VAT or claim input VAT. Sales labels must match company VAT registration; supplier VAT eligibility still requires review. The service does not compute withholding, mixed-treatment invoices, tax returns, or regulatory filing deadlines.

## Capacity and release checks

This release intentionally stores a complete set of company books in one atomic document. It stops before exceeding **650,000 serialized bytes**, **2,000 ledger entries**, or **500 accounts**. At most **100 pending approvals** can be prepared at once. A partitioned ledger, migration path and corresponding integrity tests are required before raising these limits. This design is for a bounded first release and does not claim enterprise-scale capacity.

`accounting-engine.ts` and `ph-compliance.ts` are server snapshots of the pure browser modules. Update both copies together. The backend tests assert equality to prevent silent divergence.

From the repository root, after installing the Functions dependencies:

```sh
node functions/node_modules/typescript/bin/tsc -p functions/tsconfig.json
node --test functions/tests/company-accounting.test.cjs
```

The tests invoke real callable handlers with an in-memory Auth/Firestore transaction double. They check identity, one-company linkage, invitations, role and tenant isolation, posting/approval controls, revisions, locks, VAT arithmetic, and audit results. They do **not** replace Firebase Auth/Firestore emulator tests or integration checks against the deployment environment. Before release, validate rules against two companies and all roles, indexes/subscriptions, expired/deactivated sessions, concurrent transactions, and configured sign-in verification.

Nothing in this implementation deploys automatically. After environment-specific integration review, an operator can deploy the six `company*` functions and the reviewed Firestore rules with the existing Firebase deployment tooling. Do not deploy unrelated payment/support functions as part of an accounting-only release. A rollback plan must retain company data and audit records; replacing a browser backup is not a migration procedure.
