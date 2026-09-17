# Connected accounting, tax and compliance

## Company source records

- `/accounting/vendors` and `/accounting/customers` maintain company-scoped registered names, required TINs, addresses and optional withholding ATCs. The server resolves a selected party when a bill or invoice is prepared. Posting preserves those details as a transaction snapshot. A pending document cannot be approved after its party's tax details change without being prepared again.
- `/accounting/employees` holds private employee registration and pay settings. Employee and payroll records, tax registers and return drafts require an active Admin, Manager or Accountant; Viewers cannot read those collections.
- `/accounting/payroll` prepares payroll, retains employee snapshots, requires a separate authorized approver, posts balanced expense/liability entries atomically, and creates compensation-withholding tax details. This release uses reviewed contribution and tax inputs. It does not calculate every statutory deduction automatically or transfer salaries/remittances.

## Accounting to BIR return preparation

1. Save the chart-of-accounts mapping at `/accounting/tax-mapping`.
2. Invoice VAT details flow from the books automatically. Add or correct entry-linked withholding, percentage-tax or other tax details at `/accounting/tax-details`. Vendors supply saved payee name/TIN/address. Approved payroll supplies compensation details.
3. Select a configured form and reporting dates at `/accounting/tax-returns`. The common income-tax, VAT, percentage-tax, expanded/final withholding and compensation returns have starter mappings. An Admin/Manager can configure another form and map any field to categories, selected accounts or tax registers. A direct `?form=...` link selects that form or requests configuration if it is unknown.
4. Each field retains account and entry references. Missing registers are shown as missing, unless there is a documented no-activity explanation. Legacy unclassified invoices can be supplemented by linked VAT tax details. Corrections and reversals retain their posting-period effect.
5. Saving a draft freezes the books, account mapping, return template, tax-register versions and company profile. An independent Admin/Manager must complete its review requirements; changed source versions or company tax settings invalidate review.
6. Export the working paper and supporting schedule, complete the official filing requirements, then record the agency acknowledgment and evidence in `/accounting/compliance-tracker`.

The architecture supports configuring **any return type**; it does not imply that every official BIR form has a pre-certified line mapping, tax calculation or electronic upload format. Starter fields are accounting support. Return-specific exemptions, final tax computations, credits, tax adjustments, carryovers, special schedules, official rounding and filing formats still need validation. There is no government submission API in this release.

Amounts remain integer centavos internally. General-ledger fields support period debit/credit movements and closing balances. Tax-register fields aggregate a selected classification without treating closing tax liabilities as the tax generated in the reporting period. Manual VAT details replace automatic invoice details for their source entry to avoid double-counting. Company capacity limits are enforced before writes.

## Regulatory library and obligations

- `/accounting/library` combines selected official references, company research records and the daily source feed. Records support source links, amendment notes and private PDF/image attachments.
- The scheduled service checks BIR RR/RMC/RMO current and preceding-year listings using the official website's public datasets. Its SEC scope is recent memorandum-circular announcements. It records source-specific failures and the last successful check; a blocked or changed page must never appear current.
- The daily schedule is 08:00 in Asia/Manila. New and changed listing records enter review. Discovering a publication does not establish its effective date or automatically change a company's tax treatment. Other agencies and issuance categories are not yet covered by automatic discovery.
- Company obligations retain period, owner, reviewed due date, status and filing evidence. Recording a filing requires the date, acknowledgment and evidence link/file, and Admin/Manager access. The tracker does not submit or verify an agency filing.

## Supplier bills, receipt and payment documents

Supplier bills support private PDF attachments, native text extraction and local scanned-page OCR. Recognized references, dates, supplier TIN matches, descriptions and PHP totals fill the form for review. Manual edits survive reading; unresolved values require correction. See `SUPPLIER-BILL-PDF.md` for limits and deployment requirements.

Customer receipts accept collection receipts, deposit slips and transfer confirmations. Supplier payments accept payment approvals, check copies, transfer confirmations and vendor collection receipts. Each settlement retains its own PDF/PNG/JPEG evidence (up to 10 documents of 10 MiB each), including partial payments. Admins and Managers can append evidence later without changing balances or replacing original documents. History and cash books retain the links after full settlement or reversal. Server validation checks company ownership, direction-specific document categories and actual stored object metadata.

Local browser checks verified text/scanned supplier extraction and a partial payment with PDF and PNG evidence. The subsequent deployment passed 151 Firestore/Storage Rules emulator assertions. Scoped signed-in production API checks subsequently verified partial supplier payment and customer receipt uploads, later evidence append without another journal, authorized downloads, and cross-company denial. Temporary test accounts, companies and files were removed. Full browser-path coverage remains separate from these API checks.

## Deployment and operational verification

Deploy the frontend, the new/changed Functions, Firestore/Realtime Database/Storage rules, and required indexes together. New callable exports include company-party, payroll, tax-workflow, consultation and payment-refresh services; `dailyRegulatorySync` is the scheduled export. Preserve existing unrelated Functions when choosing deployment scope.

The 17 September 2026 deployment completed Firebase authorization, Scheduler setup, attachment bucket provisioning, CORS configuration and Storage-to-Firestore membership lookup permissions. The user subsequently approved the 17 new callable services' transport-access policies; these are applied and verified, with unsigned requests rejected by application authentication. See `DEPLOYMENT.md` for the current status. Evidence files are immutable and company-scoped; removing a reference from an editor does not delete the retained storage object.

After deployment, verify with a test company: fresh verified login; second-company isolation; all four roles; directory TIN autofill; employee/payroll approval; accounting/tax reconciliation; source-version conflicts; real source sync and failure states; attachment access; consultation and support permissions; and PayMongo test-mode callback matching. Local transaction-double tests do not replace Firebase Rules emulator or deployed integration checks.

See `WORK-PLAN.md` for the next Asset Tracking module and remaining work, and `DEPLOYMENT.md` for independently verified production release details.

## Local validation — 17 September 2026

235 automated tests pass. Frontend and backend TypeScript checks, lint error checks, the production build and whitespace checks pass. The build retains a large-bundle warning. Browser checks covered a saved VAT draft, invoice-derived VAT amounts, vendor TIN/address autofill, private employee access, regulatory status display and a 390px mobile navigation/layout. Backend tests use service doubles; production access rules and external-service integration still require deployment verification.

## New connected schedules

Approved asset activity feeds ledger balances and a versioned asset book/tax schedule on saved return working papers. Changes to the asset register make an older draft stale for review. Book/tax differences remain review items and are not automatically deemed deductible. Payroll calculator evidence is recomputed by the service before save/approval; posted compensation still flows into the tax register. Payment approval alone posts nothing; actual release settles the supplier bill once and bank reconciliation supplies clearance without another cash posting.
