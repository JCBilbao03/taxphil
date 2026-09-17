# Supplier payment approval and release

The supplier payment workspace connects a supplier bill, approval, actual transfer/check release, private documents, ledger settlement and bank reconciliation. Preparing or approving a request leaves both cash and the supplier balance unchanged.

## Supported workflow

1. An Admin, Manager or Accountant prepares a payment for one existing supplier bill, selecting an active company bank account, positive centavo amount, planned date, method, unique payment reference, purpose and optional supporting documents. Partial payments are allowed. Check requests also retain the check number, normalized for spaces and case. Requests snapshot the supplier, bill reference and linked bank account.
2. A different Admin or Manager approves the request. Pending/approved requests reserve their bill amount against other requests and direct supplier settlements. Approval does not create a journal entry.
3. An Admin or Manager records the actual completed bank transfer or actual check delivery to the supplier. Release requires an explicit method-specific confirmation, actual date no later than today, confirmation/delivery reference, a review note, and the corresponding transfer confirmation or check-copy attachment. A check image alone does not establish release; the reviewer must attest delivery in the confirmation and note.
4. Release rechecks bill availability, current books revision, open accounting periods, current bank account and bank-period locks. The existing settlement engine posts `debit Accounts Payable / credit bank` and creates the settlement exactly once in the same transaction as the released request. Retrying returns the original settlement/entry identifiers.
5. Append later vendor collection receipts or other verified supporting documents without another journal posting. The original request, action versions, review notes, actors and audit events remain available.
6. Bank clearance is derived from that settlement's exact cash line in **current approved** bank statements. Draft/prepared matches do not mark it cleared. Partial and split clearance links show the statement version and row. Reopening a reconciliation immediately makes its allocations outstanding again; clearance itself never posts cash.

Pending requests may be cancelled by their preparer or a reviewer; approved requests require an Admin or Manager to cancel. Rejection/cancellation frees the bill amount. Request details are immutable: cancel and prepare a corrected request. Check numbers remain reserved for that bank even after cancellation. Released requests cannot be cancelled or released again. Existing audited ledger reversal is used for a reversed payment; the clearance view detects that reversal and reports `reversed` rather than `cleared`.

## Documents and access

The existing immutable `companies/{companyId}/settlement-evidence/{fileId}` storage path is reused. Documents are private PDF/PNG/JPEG, up to 10 MiB each and 10 unique documents across a request and its release. Server validation verifies company path, permitted type/category, actual stored size and content type. Existing attachment metadata cannot be renamed or recategorized through the payment action.

Admins, Managers and Accountants can read company payment requests/history. Only the preparer can append to their pending request without reviewer permissions; approved/released evidence requires an Admin or Manager. All writes use the callable with current verified Auth identity and active mirrored company membership. Reservation and check-number control documents are server-only. A UUID v4 retry key protects preparation idempotency; record versions protect decisions, and the books revision protects posting.

## Boundaries

- One request settles one bill; a single batch transfer covering several bills is not yet modeled as one approved payment batch. No automatic bank transfer initiation, bank beneficiary setup, check printing, or bank-clearing API is included.
- Salary disbursement remains separate from supplier-bill payment approval; payroll accrual is not proof of salary payment.
- Requests permit at most 100 simultaneous reservations per bill and 100,000 bytes per request. Existing company books capacity remains 650,000 bytes / 2,000 entries / 500 accounts. Capacity failures leave the payment unposted.
- Only PHP bank accounts registered in Bank Reconciliation are selectable. Bank fees, tax deductions and foreign-exchange settlement differences must use their appropriate reviewed accounting workflows rather than silently changing an approved amount.
- This records completed actions and their evidence; it does not prove an attachment's business authenticity or guarantee that a bank executed a payment.

## Verification

`functions/tests/company-payments.test.cjs`: **16 passing tests** for current roles/membership, company isolation, immutable snapshots, preparation retries, reservation conflicts and direct-settle protection, independent approval without posting, check uniqueness, required completed-release evidence, exact-once settlement, closed/stale/locked books, private-file validation, appended evidence, current approved clearance and reopening, reversal detection, UUID/object-key validation and multiline notes. Firestore test doubles reject reads after transaction writes; browser/server contracts are mirror-checked.

```sh
node node_modules/typescript/bin/tsc --project functions/tsconfig.json
node --test functions/tests/company-payments.test.cjs
```

Run the independent Firestore/Storage emulator suite in `tests/security-rules` before release. Local tests do not establish deployment status; consult the release record for the exact deployed revision and live verification.
