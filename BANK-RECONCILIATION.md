# Bank reconciliation

The company bank workspace is available at `/accounting/bank-reconciliation`. Admins, Managers and Accountants can review its private records; only Admins and Managers maintain bank accounts and approve reconciliations. Each PHP bank account has one unique cash Asset ledger account. The ledger link is immutable after creation.

## Supported workflow

1. Upload CSV, XLSX, or PDF. CSV delimiter/header row and date convention can be selected; XLSX worksheets and column mappings are explicit. Searchable PDFs use their text; scanned PDFs use the existing local OCR reader. Extraction retains original file, worksheet/page/row references and raw cell text. Spreadsheet formulas are flagged and never evaluated.
2. Review dates, signs, descriptions, references and running/opening/closing balances. Unclear fields and formula/duplicate candidates remain unresolved until reviewed. Initial rows are retained; later exclusions/corrections require a note and preserve immutable earlier versions. A checksum identifies repeat uploads for the same bank. The original private storage object is immutable and the server verifies its bytes and generation.
3. Match existing ledger cash lines by `entryId:lineIndex`. Suggested matches need confirmation. Single, grouped and split allocations are supported, including net deposits containing receipts and separately posted fees. Competing draft/prepared statements reserve matched amounts so another draft cannot consume the same cash line. Importing and matching never post cash.
4. Record missing customer receipts or supplier payments through their existing accounting workflows, then match the resulting cash lines. Missing bank fees/interest can be separately prepared and independently approved; this posts and matches one adjustment atomically. Its offset must be an Expense or Revenue account.
5. Prepare a balanced report, then obtain approval from a different Admin or Manager. Every statement row must be resolved and fully matched. The report checks `bank closing balance + deposits in transit - outstanding payments = book balance`, with zero difference. Approval rechecks the original file generation, ledger revision and bank-line fingerprint.
6. Approved periods lock changes to the related historical cash lines across general accounting, asset and payroll writers. A different reviewer can reopen the latest approved period with a reason; later periods must be reopened first. Prior reports remain in history. Reopening restores draft allocations without a new journal entry.

For the first statement, explicitly review the opening bank balance and identify complete pre-period ledger lines still outstanding. Other earlier lines become the reviewed cleared opening baseline. Later approved periods must start on the day after the preceding approved period and carry forward outstanding items automatically. A transfer between two bank accounts has two existing cash lines; reconcile each account's own line separately, with no extra transfer posting.

## Boundaries

- PHP only; up to 50 bank accounts, 400 saved rows and 1,000 allocations per statement, with a 650,000-byte statement limit. Each match group supports up to 100 allocations. Limits reject the import; they never truncate it.
- Files: 10 MiB maximum. PDFs: at most 10 pages with the existing bounded OCR reader. XLSX uses SheetJS CE 0.20.3 in a cancellable worker with a 60-second limit; the reader allows up to 10 sheets, 5,000 parsed rows, 64 columns and 200,000 cells, but saved statements remain capped at 400 rows.
- Legacy `.xls`, images uploaded without a PDF wrapper, and bank API feeds are not supported. Complex PDF layouts without detectable columns require a CSV/XLSX export or manual corrections. Wrapped OCR rows remain flagged; OCR never guarantees an accurate transcription.
- A no-activity statement containing zero transaction rows is not yet supported. Initial opening outstanding selection covers whole ledger lines, not partial opening allocations.
- One source checksum per bank creates one statement. Uploading a different worksheet from the same workbook for that bank returns the existing import, with an explicit notice. Export separate source files if separate statements are required.
- Similar rows are review candidates, never silently deleted. The initial row values are client-reviewed extraction; original bytes and raw/source fields remain available for independent comparison.
- The shared books document retains the existing 650,000-byte / 2,000-entry / 500-account capacity. This is not a bank connection and does not initiate transactions.

## Verification

Pure/parser suites: **29 passing tests** in `tests/bank-reconciliation.test.ts` and `tests/bank-statement-import.test.ts`. Backend suite: **17 passing tests** in `functions/tests/company-bank.test.cjs`, covering permissions, company-bound source files, checksum retries, duplicates, immutable source corrections, competing reservations, opening items, independent review, source changes, locks/reopening and single-post adjustments. Backend tests enforce Firestore reads before writes. Browser/server calculation mirrors are checked. Match candidate filtering also checks the first approved opening baseline so already-cleared opening entries are not offered again. Browser QA confirmed file parsing/population and saving, along with upload busy/unmount guards, renewed review after source edits, and explicit submit actions.

```sh
node --experimental-strip-types --test tests/bank-reconciliation.test.ts tests/bank-statement-import.test.ts
node node_modules/typescript/bin/tsc --project functions/tsconfig.json
node --test functions/tests/company-bank.test.cjs
```

Run the independent Firestore/Storage emulator suite in `tests/security-rules` before release. These local suites do not establish deployment status; consult the release record for the exact deployed revision and live verification.
