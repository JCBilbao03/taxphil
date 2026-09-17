# Reviewed Philippine payroll calculation helpers

Verification date: **17 September 2026**. Implementation snapshot: `ph-reviewed-2026-09-17-v1`.

`src/lib/payroll-statutory.ts` and `functions/src/payroll-statutory.ts` contain identical, pure helpers. They produce optional working-paper suggestions from bases a payroll reviewer has already classified. The payroll editor now previews and explicitly applies them to drafts. Calculators do not themselves post, file, remit, determine employment coverage or certify compliance. Existing independent payroll approval controls remain necessary.

## Sources and verified scope

| Calculation | Official source | Effective schedule and basis |
| --- | --- | --- |
| SSS, ordinary business employees | [SSS Circular 2024-006, first page](https://www.sss.gov.ph/wp-content/uploads/2024/12/2025-SSS-Contribution-Table-rev.pdf); [current circular index](https://www.sss.gov.ph/sss-circulars/) | January 2025 onward. Salary-credit bands start at ₱5,000 and end at ₱35,000. Employee 5%, employer 10%. Regular SS uses up to ₱20,000 MSC; excess MSC goes to mandatory provident savings. EC is employer-only: ₱10 through ₱14,500 MSC, ₱30 from ₱15,000 MSC. |
| PhilHealth | [Advisory 2025-0002](https://www.philhealth.gov.ph/advisories/2025/PA2025-0002.pdf); [official PIA report, 14 May 2026, of PhilHealth’s 6 May 2026 announcement](https://pia.gov.ph/news/philhealth-sets-5-premium-contribution-rate-for-2026/) | The 2026 announcement confirms 5% continues, with ₱10,000 floor and ₱100,000 ceiling, shared equally. Use fixed monthly basic salary before reductions for absence, tardiness, undertime or unpaid leave. Exclude commissions, overtime, allowances, 13th-month pay, bonuses and gratuities from this basis. |
| Pag-IBIG | [DOLE Workers Statutory Monetary Benefits Handbook 2024, printed page 63 (PDF page 73)](https://nwpc.dole.gov.ph/wp-content/uploads/2024/11/Workers-Statutory-Monetary-Benefits-Handbook-2024-Edition.pdf); [DBM Circular Letter 2024-2](https://www.dbm.gov.ph/wp-content/uploads/Issuances/2024/Circular-Letter/CIRCULAR-LETTER-NO-2024-2-DATED-FEBRUARY-01-2024.pdf) | Both cite Pag-IBIG Circular 460 dated 15 January 2024; the ₱10,000 maximum fund salary starts February 2024. Employee: 1% when monthly fund salary is at most ₱1,500, otherwise 2%. Employer: 2%. Fund salary includes basic pay and other allowances; classification must be reviewed separately from the PhilHealth basis. |
| BIR compensation withholding | [RR 11-2018 Annex E](https://bir-cdn.bir.gov.ph/local/pdf/Annex%20E%20RR%2011-2018.pdf) | Explicitly effective 1 January 2023 and onwards. Literal monthly, semi-monthly, weekly and daily thresholds and fixed amounts are used; no conversion from the annual table. Input is reviewed taxable compensation for the selected pay period. |

The SSS table and BIR Annex E were visually checked against the official PDFs. The SSS circular index displayed no later business-employee contribution schedule when checked. The current PhilHealth employer-table PDF ends at 2025; 2026 continuation is supported by the government PIA report quoting the agency, rather than pretending the older PDF itself names 2026. Pag-IBIG’s direct document site presented a browser challenge; DOLE’s official reproduction and DBM’s effectivity confirmation were used. No superseding ordinary-employee contribution schedule was identified in the official sources searched; this is not a guarantee that every issuance is indexed.

## API and safe integration

- `suggestMonthlyContributions({ contributionMonth, scope: 'ordinary_private_employee_full_month', basesReviewed: true, reviewNote, sssMonthlyCompensation, philhealthMonthlyBasicSalary, pagibigMonthlyFundSalary })` returns `monthlyAmounts`, detailed SSS/MPF/EC, PhilHealth and Pag-IBIG amounts, source links and warnings. All money inputs/outputs are whole centavos. Require a positive, separately reviewed basis for each agency.
- `suggestCompensationWithholding({ payDate, frequency, scope: 'regular_single_employer_period', basesReviewed: true, reviewNote, taxableCompensation })` returns `withholdingTax` plus the selected bracket, threshold, fixed tax, rate, excess and evidence. `frequency` is monthly, semi_monthly, weekly or daily.
- Every output is labelled `reviewRequired: true`. Each applied row retains its `basis`, `version`, `verifiedOn`, review note, warnings and sources in `statutoryEvidence`. The editor presents suggested changes and requires an explicit apply action before replacing editable draft values.
- Monthly contribution totals must **not** be inserted into each semi-monthly/weekly/daily cutoff. Reconcile already-deducted amounts and choose a reviewed allocation separately. The pure statutory helpers do not inspect prior payrolls. The integrated payroll application checks previous posted runs on save and approval; it blocks full-month application if another employee run covers or was paid within that month. This is deliberately conservative when a prior month was paid late; reconcile and use reviewed manual amounts in that case.
- The snapshot supports 2026 contribution months through September and actual pay dates through 17 September 2026. Later dates and other years stop for a new source review. The month limit does not mean a month is complete: the caller must establish ordinary full-month scope and final monthly bases before applying suggestions.

Integer arithmetic rounds positive amounts to the nearest centavo, half up. PhilHealth’s equal shares are rounded individually. The result exposes both their sum and the separately rounded whole premium; if these differ by one centavo, a specific warning requires reconciliation with the agency assessment. This is an explicit implementation convention, not a claim that an official circular prescribes that rounding order.

## Cases deliberately left for manual calculation

The monthly scope excludes household workers, government employees, self-employed/voluntary members, OFWs, concurrent employers, partial months, zero-pay months and other special coverage classes. Voluntary savings, MP2, loans, arrears and penalties are outside the helper. Coverage eligibility, gross-to-base classification and cutoff allocation remain reviewed inputs.

The withholding scope excludes minimum-wage exemptions, special tax classes, supplementary or irregular compensation, multiple/prior employers, final pay and year-end annualization. It does not infer benefit exemptions, de minimis ceilings, minimum wages, overtime rates, holiday rules, taxable/non-taxable status or carry-forward adjustments.

**Daily top bracket is blocked:** the official Annex E literally prints an ambiguous fixed amount (`6,034.00.30`) for daily taxable pay of ₱21,918 or above. The helper refuses this range rather than silently correcting the document. Obtain an unambiguous BIR confirmation or corrected official table before enabling it. Lower daily brackets and the other three schedules are clear.

The code uses each published bracket’s lower threshold in centavos up to the next lower threshold. It preserves printed fixed amounts even where table rounding produces small differences between adjacent brackets. This is ordinary period withholding only; annual adjustment is separate.

## Validation

`functions/tests/payroll-statutory.test.cjs` checks mirror identity, source metadata, salary-band endpoints, caps, EC transition, regular/MPF decomposition, independent agency bases, PhilHealth rounding warnings, Pag-IBIG rate boundary, all supported BIR brackets, centavo rounding, input limits, unsupported scenarios and ambiguous daily amounts. Tests assert calculations remain suggestions and do not generate a payroll or post anything.

## Integrated application controls

`PayrollWorkspace.tsx` offers two independent previews. Monthly application requires a monthly run exactly spanning a calendar month, employment for the whole month, an explicit assertion of no previous allocation/deduction/remittance (including external payroll), and a separate PhilHealth rounding confirmation when applicable. Partial cutoffs retain manual contribution entry. Withholding application replaces only the separately reviewed taxable-compensation basis and its period tax.

The shared `payroll.ts` helpers snapshot earnings, employee version, payroll dates/frequency and mandatory deductions relevant to tax. Editing earnings, employee context, bases or deductions requires recalculation or explicit removal of the attached evidence for manual review. Applying monthly contributions removes previous withholding evidence and resets preparer review, prompting the preparer to reassess taxable compensation. Existing withholding numbers are retained as editable manual amounts until replaced. The calculator also clears previews and review confirmations when payroll amounts change.

On both draft save and approval, `company-payroll.ts` recomputes canonical suggestions from their saved inputs and compares all applied amounts. Supplied totals, source URLs and other calculated metadata are never authoritative. Approval persists the canonical evidence. Allocation checks run inside the transaction before writes, and independent approval, immutable posted payroll, balanced accruals, compensation-tax records and idempotent retry behavior remain in place. No browser can directly write payroll records.

The run retains its existing 500 KB limit, so large batches with extensive calculation evidence may need smaller employee groups. No evidence is required for an explicitly reviewed manual payroll. The evidence-removal action retains numbers, resets preparer review, and requires the normal calculation notes and independent approval.

`functions/tests/payroll-application.test.cjs` additionally covers canonical evidence reconstruction, amount/context tampering, stale earnings/deductions, PhilHealth rounding approval, full-month/employee eligibility, prior monthly allocations, competing drafts, separate semi-monthly withholding, atomic ledger/tax posting, retries and deliberate manual overrides.
