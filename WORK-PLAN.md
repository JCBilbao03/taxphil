# TaxPhil / UBB Accounting work list

Updated 17 September 2026. This is the implementation list, not a statement that the live website has been deployed or that every Philippine filing has been certified.

Current status: the website, 29 backend functions, database indexes and access rules have been deployed. The new public pages are live. The user explicitly approved transport access for the 17 new browser-callable services; the change was applied, verified, and live sign-in rejection checks pass. GitHub is connected. See `DEPLOYMENT.md` for evidence and limitations. Daily BIR discovery is active and its first production check found 311 issuances; SEC automated access returns HTTP 403 and is visibly flagged. The deployed release now implements Asset Tracking, populated Bank Reconciliation, payment approval/release/clearance, and reviewed statutory payroll suggestions. Its signed-in production checks passed and all temporary test records were removed; see DEPLOYMENT.md.

## Execution order after deployment access is completed

1. Completed scoped signed-in production checks for company access, vendor/customer TIN autofill, employee permissions, payroll/tax data flow and receipt/payment uploads and later attachments using temporary controlled test companies. Browser interaction coverage remains separate from these API checks.
2. Implemented Asset Tracking (item 11), reviewed accounting entries, book/tax schedules and ledger reconciliation. See ASSET-TRACKING.md for the supported methods and limits.
3. Implemented CSV/XLSX/PDF/OCR statement reading, populated rows, matching, independently reviewed adjustments/reconciliation, history and bank period locks. See BANK-RECONCILIATION.md.
4. Implemented independent payment approval, actual check release/completed transfer recording, evidence and bank-clearance status. See PAYMENT-APPROVALS.md.
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
11. **Deployed: Asset Tracking**, as requested. Asset register, acquisition cost and date, asset category, location, custodian, depreciation method/useful life/residual value, book versus tax treatment, transfers, impairment/disposal history, approvals, depreciation/disposal journal entries and tax schedule links. Include opening assets and reconciliation to the general ledger.
12. **Deployed: Bank Reconciliation**, within UBB Accounting. Maintain each company's bank accounts and link them to general-ledger accounts. Import bank statements with column mapping and duplicate detection; capture statement periods and opening/closing balances. Suggest transaction matches using amount, date and reference, with user confirmation, split/group matching and controls against matching a transaction twice. Track unmatched entries, deposits in transit and outstanding checks. Prepare reviewed adjustment entries for bank charges, interest and other differences. Produce reconciliation reports showing the bank balance, book balance, reconciling items and remaining difference. Require review before completing a reconciliation, retain an audit trail, and control reopening so subsequent changes cannot silently alter an approved reconciliation. Connect to customer collections, vendor payments and posted payroll payments without duplicating their accounting entries.
13. Complete appropriate calculation, access-control, company-isolation and workflow tests. Review the complete changes before GitHub release and website deployment.

## Bank statement upload and automatic population

Implemented behavior for the Bank Reconciliation module, within the documented file/layout and capacity limits:

1. Upload a bank statement against the selected company's bank account. Read CSV, XLSX and PDF statements, including local OCR for scanned PDFs; unreadable layouts remain for correction or CSV export.
2. Automatically read the statement and populate reconciliation rows with transaction date, description, reference/check number, money in, money out and running balance where supplied. Extract the bank/account identity, currency, statement period and opening/closing balances where available.
3. Display the extracted transactions in the Bank Reconciliation module, ready for matching to the accounting books. Retain the original statement and row/page references so every imported line can be traced to its source.
4. Show unclear dates, amounts, account identities and unreadable rows for correction. Missing fields remain visibly unresolved. Check the extracted totals against statement balances before completing reconciliation.
5. Detect repeated file uploads and flag overlapping transactions for review while preserving legitimate transactions that happen to share a date, description and amount. Apply the correct bank-account and company scope to every import and match.
6. Suggest matches to recorded receipts, payments and journal entries. Keep unmatched bank and book transactions visible, and route necessary adjustments through the accounting approval process.

Acceptance requirement: uploading a supported statement must produce populated reconciliation transactions and an import summary showing extracted, unresolved and potentially duplicate rows. An upload that cannot be read must show a clear processing error and a correction path. File storage alone does not complete the import feature.

## Release dependencies

- GitHub and Firebase sign-in are complete. The website, backend functions and rules are deployed. Explicit user approval was received for the 17 new callable transport policies, and the access repair and unsigned live-request checks passed.
- Daily regulation checks are enabled at 08:00 Asia/Manila. BIR checks succeeded; SEC source access remains blocked and requires manual review. Source coverage must remain visible.
- Storage rules, website CORS and membership-lookup permissions are deployed. Actual signed-in receipt/payment uploads, later attachments, private downloads and cross-company rejection passed with synthetic files.
- The prior live release passed signed-in production checks. The new module release passes 341 application tests and 382 Firebase Rules emulator assertions, plus browser checks of assets, tax snapshots, statement reading/matching, payment release and payroll calculators; its scoped signed-in live checks also pass, with all synthetic records removed.
- PayMongo credentials are empty in the existing production configuration. Payment-provider end-to-end validation requires those credentials and an appropriate test-mode setup.
- Reviewed ordinary-employee payroll suggestions are implemented with source snapshots and allocation safeguards; special cases, cutoff allocation, annualization and bank salary disbursement remain separate. Official BIR upload/submission formats and regulator integrations are not implemented. These working papers must not be presented as direct BIR filings.

## Supplier bill PDFs

Add supplier bill now supports selecting a company-private source PDF, reading text and scanned pages locally, matching the supplier against the saved vendor TIN, and filling recognized reference, dates, description and gross amount. Unclear values remain for review. Preserve manual edits, require source review before submission, and retain the original PDF with the pending/posted bill. Attachments need Storage rules, callable updates and website deployment together. See SUPPLIER-BILL-PDF.md for capabilities and validation.

## Receipt and payment supporting documents

The implemented bank reconciliation and expanded settlement workflow keep references distinct: linked sales/supplier invoice, internal collection/payment voucher, bank transaction or check number, and supporting collection receipt. A customer collection receipt is issued by the company to its customer; a supplier's collection receipt supports the company's payment to that supplier. Track payment approval, check release and bank clearance separately; approval or an unreleased written check alone must not mark a payable as settled. Match statement lines to existing receipts/payments before proposing another posting. Allow multiple supporting documents without counting the same cash movement twice. Receipt/payment file selection, private storage, later append-only attachments, and links in settlement history and cash books are implemented; signed-in production checks passed for those features in the prior release. The existing settlement form records an already completed payment or receipt. The new Payment Approvals screen adds separate preparation, independent authorization, actual release and bank clearance without duplicating that settlement. Its release validation is recorded in DEPLOYMENT.md.

## Remaining work and external dependencies

- Full government-form computations, certified electronic schedules and actual BIR submission need verified current schemas and the appropriate official service access. Configurable return working papers already pull accounting data; they are not official submission files.
- SEC automated source access still returns HTTP 403. Retain the visible failed-source status and official manual review path; daily BIR discovery continues. Broader regulator coverage remains to be verified.
- PayMongo provider testing is blocked by missing production configuration; credentials must be configured privately by the merchant. No payment was initiated during validation.
- Advanced payroll cases (year-end annualization, special coverage, wage/holiday rules, partial-month/cutoff allocation) remain reviewed manual inputs. The optional calculator is bound to its documented source-verification date.
- Asset methods beyond straight-line, partial disposal, account-reclassification transfers and independent asset attachments remain outside this release. Existing acquisition sources retain their supplier PDFs.
- Bank statement limits: PHP only, 400 rows, 10 MB, up to 10 PDF pages; empty statements and ambiguous layouts require a reviewed alternative. One request settles one supplier bill; check printing and initiating bank transfers are not included.
