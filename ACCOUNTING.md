# UBB Accounting — Philippine company workspace

The accounting workspace is part of TaxPhil at `/accounting`, behind the existing verified Firebase login. The interface uses blue primary navigation and separate Business, Accounting, Reports, Compliance and Company areas.

## What is implemented

- A customer company has a generated code and multiple individually authenticated members. Each user belongs to one company. The code identifies the company; an email-bound, expiring invitation is also required to join.
- Company Admins manage profiles, invitations and membership. Accounting Managers manage accounting and review submissions. Accountants prepare journals, bills and invoices for another authorized reviewer. Viewers can read but cannot change books. Managers/Admins can post directly; independent approval is not mandatory for every creator.
- Company books are read from Firestore. Writes go through verified server functions that check current membership, role, revision, balanced entries, duplicate references, date locks and document balances. Browser clients cannot write company records directly.
- Journals, chart of accounts, customer invoices, supplier bills, partial payments, reversals, period locks, ledgers, cash books, aging, trial balance, income statement, balance sheet and CSV/JSON exports.
- PHP values use integer centavos. Accounting dates use Asia/Manila. VAT12 records separate VAT from net using exact VAT-first half-up rounding; zero-rated, VAT-exempt and non-VAT classifications remain distinct. Existing document totals are VAT-inclusive. Calculations must be reviewed against supporting invoices, particularly input-tax eligibility.
- Company profiles capture TIN, branch, RDO, registered address, legal entity, VAT registration, income-tax regime, fiscal year, reporting framework, invoicing series, CAS reference, withholding and employee status.
- Entity-sensitive compliance review prompts link to BIR, SEC, LGU, SSS, PhilHealth and Pag-IBIG sources. They are review aids, not evidence of filing or certification.
- Company activity and approval decisions append audit events. All pending submissions remain available alongside the most recent 100 submissions/events.

## Preview

Run the development server and open `/tests/company-browser.html`. This development-only fixture shows a fictional company and a role selector for checking Accountant, Manager, Admin and Viewer screens. Changes exist only until refresh. It does not send invitations, file returns, move money or write into live company records. The role selector is not part of the live application. The production build includes only the normal application entry point.

The older `/tests/accounting-browser.html` fixture still exercises isolated browser books.

## Existing records

Older personal books remain untouched under `ubb-accounting-v1:<Firebase UID>` in that browser. Onboarding and Books & Backups offer an export of the signed-in user's previous personal books. No automatic migration merges those records into a company. Shared books reject browser restore operations so posted records and period locks cannot be overwritten. Company data and TaxPhil's separate Income & Expenses tracker are not automatically synchronized.

## Release status and limits

The frontend, 26 Cloud Functions, database indexes and access rules were deployed on 17 September 2026. The 17 new browser-callable services still require explicit approval for their transport-access policy before company workflows can operate. See `DEPLOYMENT.md` for the current production status, payment configuration gap and verification limits.

The current atomic company-ledger storage is limited to 650,000 serialized bytes, 2,000 posted entries and 500 accounts, with 100 pending submissions. A partitioned ledger is necessary for larger customers. This is a bounded initial implementation, not full Xero feature parity or a completed Philippine statutory filing platform.

Configurable tax working papers and reviewed-input payroll are documented in `CONNECTED-ACCOUNTING.md`. Not implemented: official BIR return submission/output formats, fully automated statutory payroll contributions, alphalists/SAWT/SLSP output, BIR electronic sales transmission, registered invoice issuance/numbering, SEC filing/signatures, audited financial statements, automated bank feeds/reconciliation, inventory quantities, multi-currency and statutory filing calendar calculation. Government registration references are entered, not verified with an agency. Company-specific accountant/legal review and registration are still required before statutory use. See `PHILIPPINE-COMPLIANCE.md` for scope and official sources.

## Verification

From this directory, using a current Node runtime:

```sh
node --experimental-strip-types --test tests/*.test.ts tests/*.test.cjs functions/tests/*.test.cjs
node functions/node_modules/typescript/bin/tsc -p functions/tsconfig.json
node --test functions/tests/company-accounting.test.cjs
npm run build
```

The complete local suite has 235 passing tests. Backend tests use an in-memory transaction double. A separate suite in `tests/security-rules` passes 151 Firebase Emulator assertions for Firestore and Storage access rules; it does not replace signed-in production integration checks. Local browser checks cover preparing and approving a VAT invoice, ledger appearance, Viewer restrictions, source-linked compliance screens and mobile navigation without horizontal page overflow.

See `functions/COMPANY-ACCOUNTING.md` for API contracts, access rules and controlled deployment guidance. Keep its server engine and compliance snapshots synchronized with the browser modules; tests check equality.
