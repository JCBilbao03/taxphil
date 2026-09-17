# TaxPhil / UBB Accounting work list

Updated 17 September 2026. This is the implementation list, not a statement that the live website has been deployed or that every Philippine filing has been certified.

Current status: the website, 26 backend functions, database indexes and access rules have been deployed. The new public pages are live. The 17 new browser-callable services still need explicit approval for their transport-access policies before the connected accounting workflows can operate. GitHub is connected and the deployment fixes are saved. See `DEPLOYMENT.md` for evidence and limitations. Daily BIR discovery is active and its first production check found 311 issuances; SEC automated access returns HTTP 403 and is visibly flagged. Asset Tracking and Bank Reconciliation remain unimplemented. The user has asked to continue this checklist after completing deployment.

## Execution order after deployment access is completed

1. Verify signed-in company access, vendor/customer TIN autofill, employee permissions, tax data flow and the remaining receipt/payment attachment paths using a controlled test company.
2. Implement Asset Tracking (item 11), including reviewed accounting entries and ledger reconciliation.
3. Implement statement reading and Bank Reconciliation (item 12), with actual populated rows and reviewed matching rather than upload-only storage.
4. Complete the payment approval/check-release/bank-clearance workflow described below.
5. Extend verified statutory payroll calculations, return-specific official formats and regulatory coverage. Do not substitute guessed calculations or unsupported government submission claims for the required integrations.
6. Repeat the relevant calculation, access, workflow and live integration checks; commit, push and deploy each completed release with its remaining limits documented.

1. Complete the TaxPhil public pages, About Us, settings, dashboard, support, consultations and existing transaction/deadline/payment workflows using the UBB visual design.
2. Maintain one company per customer with company-specific books, membership, access roles, approvals and audit records.
3. Add a company vendor database with required TIN, registered name and address; use its saved details on bills and withholding records.
4. Add a company customer database with required TIN, registered name and address; use its saved details on invoices and tax schedules.
5. Add employee records inside accounting, including TIN, government membership details, employment status and pay settings.
6. Map the chart of accounts and transaction-level tax details to return categories and fields. Support configurable mappings for all BIR return types, rather than restricting the architecture to Forms 1701 and 1702.
7. Prepare return working papers from the selected company's books and reporting period, with source references, missing-data checks, versioned snapshots, independent review and exports. Validate government-specific computations, official electronic output formats and submission integrations before describing any return as ready to file directly.
8. Build the Regulatory Library with official source links, documents, amendment/review information and daily automated source checks. Show source failures and last successful checks; never treat an inaccessible source as up to date or automatically apply a new issuance to every company.
9. Build the Compliance Tracker with assigned owners, periods, reviewed deadlines, filing references and supporting evidence.
10. Build Payroll after the employee/accounting foundation: earnings, deductions, contributions, payroll review, payslips, balanced postings and payroll-to-tax schedules. Clearly identify any contribution or withholding figures that still require reviewed input rather than an automated statutory calculation.
11. **Next: Asset Tracking**, as requested. Asset register, acquisition cost and date, asset category, location, custodian, depreciation method/useful life/residual value, book versus tax treatment, transfers, impairment/disposal history, approvals, depreciation/disposal journal entries and tax schedule links. Include opening assets and reconciliation to the general ledger.
12. **Bank Reconciliation**, within UBB Accounting. Maintain each company's bank accounts and link them to general-ledger accounts. Import bank statements with column mapping and duplicate detection; capture statement periods and opening/closing balances. Suggest transaction matches using amount, date and reference, with user confirmation, split/group matching and controls against matching a transaction twice. Track unmatched entries, deposits in transit and outstanding checks. Prepare reviewed adjustment entries for bank charges, interest and other differences. Produce reconciliation reports showing the bank balance, book balance, reconciling items and remaining difference. Require review before completing a reconciliation, retain an audit trail, and control reopening so subsequent changes cannot silently alter an approved reconciliation. Connect to customer collections, vendor payments and posted payroll payments without duplicating their accounting entries.
13. Complete appropriate calculation, access-control, company-isolation and workflow tests. Review the complete changes before GitHub release and website deployment.

## Bank statement upload and automatic population

Required behavior for the planned Bank Reconciliation module:

1. Upload a bank statement against the selected company's bank account. Plan support for CSV, Excel and PDF statements, including OCR for scanned PDFs.
2. Automatically read the statement and populate reconciliation rows with transaction date, description, reference/check number, money in, money out and running balance where supplied. Extract the bank/account identity, currency, statement period and opening/closing balances where available.
3. Display the extracted transactions in the Bank Reconciliation module, ready for matching to the accounting books. Retain the original statement and row/page references so every imported line can be traced to its source.
4. Show unclear dates, amounts, account identities and unreadable rows for correction. Missing fields remain visibly unresolved. Check the extracted totals against statement balances before completing reconciliation.
5. Detect repeated file uploads and flag overlapping transactions for review while preserving legitimate transactions that happen to share a date, description and amount. Apply the correct bank-account and company scope to every import and match.
6. Suggest matches to recorded receipts, payments and journal entries. Keep unmatched bank and book transactions visible, and route necessary adjustments through the accounting approval process.

Acceptance requirement: uploading a supported statement must produce populated reconciliation transactions and an import summary showing extracted, unresolved and potentially duplicate rows. An upload that cannot be read must show a clear processing error and a correction path. File storage alone does not complete the import feature.

## Release dependencies

- GitHub and Firebase sign-in are complete. The website, backend functions and rules are deployed; explicit approval remains pending for the 17 new callable transport policies after automatic approval review blocked the access change.
- Daily regulation checks are enabled at 08:00 Asia/Manila. BIR checks succeeded; SEC source access remains blocked and requires manual review. Source coverage must remain visible.
- Storage rules, website CORS and membership-lookup permissions are deployed. Actual signed-in evidence upload/download checks remain to be completed.
- 235 application tests and 151 Firebase Rules emulator assertions pass. Full live integration checks remain separate from these automated checks.
- PayMongo credentials are empty in the existing production configuration. Payment-provider end-to-end validation requires those credentials and an appropriate test-mode setup.
- Full statutory payroll automation, official BIR upload/submission formats, bank salary disbursement, asset tracking and bank reconciliation need their own verified implementation before being advertised as available.

## Supplier bill PDFs

Add supplier bill now supports selecting a company-private source PDF, reading text and scanned pages locally, matching the supplier against the saved vendor TIN, and filling recognized reference, dates, description and gross amount. Unclear values remain for review. Preserve manual edits, require source review before submission, and retain the original PDF with the pending/posted bill. Attachments need Storage rules, callable updates and website deployment together. See SUPPLIER-BILL-PDF.md for capabilities and validation.

## Receipt and payment supporting documents

For the planned bank reconciliation and expanded settlement workflow, keep references distinct: linked sales/supplier invoice, internal collection/payment voucher, bank transaction or check number, and supporting collection receipt. A customer collection receipt is issued by the company to its customer; a supplier's collection receipt supports the company's payment to that supplier. Track payment approval, check release and bank clearance separately; approval or an unreleased written check alone must not mark a payable as settled. Match statement lines to existing receipts/payments before proposing another posting. Allow multiple supporting documents without counting the same cash movement twice. Receipt/payment file selection, private storage, later append-only attachments, and links in settlement history and cash books are implemented locally. Final browser checks for later attachments and receipt-side uploads were paused. The current settlement form records an already completed payment or receipt; the full approval/check-release/bank-clearance status workflow remains planned.
