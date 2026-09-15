# UBB Accounting System

Open `/accounting` while signed in to a verified TaxPhil account. The navigation link sits immediately below the BIR Tax Filing branding.

## First use

1. Review **Chart of Accounts** and add any business-specific accounts. Currency is PHP.
2. Post opening balances in **Journal Entry**. Each posting must balance, using up to 100 debit/credit lines. Amounts are stored as integer centavos.
3. Enter outstanding bills in **Accounts Payable** and invoices in **Accounts Receivable**, dated in their original accounting period. The control accounts cannot be used in manual journals.
4. Record payments or receipts against those documents. Partial payments are supported; payments cannot exceed the balance or precede the invoice.
5. Review the ledger, cash books, aging, trial balance, income statement, and balance sheet. Cash books include internal cash/bank transfers, so their gross totals are not operating cash flow.
6. Export a JSON backup from **Books & Backups** after each session. CSV exports are available for journals, ledgers, subledgers, cash books, and reports.

## Corrections and periods

Posted entries are retained. Use **Reverse** in Journal Entry, then post a replacement with a new reference. For a paid invoice or bill, reverse the settlement entries before reversing the document. Reversal dates cannot precede the original posting. A locked period rejects backdated postings and reversals; the lock can only advance. References are unique without regard to case.

Reports use posting dates. Income statements show activity in the selected range; balance sheets and trial balances show cumulative amounts through the selected end date. The balance sheet includes cumulative unclosed earnings in equity. The system does not generate year-end closing entries automatically.

## Storage and scope

This implementation runs locally. Records live in `localStorage` under a key scoped to the authenticated Firebase UID. Web Locks serialize writes across tabs; storage events refresh other open tabs. Corrupt data is not overwritten by ordinary saves. A recovery download and validated backup restore are available. Restoring replaces the current account's local books, including period locks, after confirmation.

Browser storage is not a shared database or an access-control boundary against someone using the same browser profile. Clearing site data removes these records. Sign-in still uses the existing Firebase service. The new accounting records do not write to Firebase and do not synchronize with TaxPhil's separate income/expense records. No production deployment is included.

This is basic bookkeeping: tax calculations, BIR submissions, payment processing, inventory quantities, bank reconciliation, multi-currency, and multi-user approval workflows are outside its scope. Customer/supplier names are recorded on documents; there is no separate contact directory.

## Validation

Run `npm run test:accounting` using Node 22.18+ or a newer supported Node version, followed by `npm run build`. The test suite covers monetary precision, balanced entries, control-account restrictions, partial settlements, date cutoffs, overpayments, reversals, period locks, and backup integrity. Browser checks should not post sample transactions into real user books.
