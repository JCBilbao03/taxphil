# Philippine company setup and compliance review

This module supports Philippine company setup, a source-linked review checklist and invoice VAT arithmetic. It does **not** certify BIR, SEC or other regulatory compliance. Saving a profile does not register a taxpayer, approve an invoice series, obtain CAS registration, file a return or perform an audit. Every profile and checklist item explicitly retains accountant review as required.

## Implemented scope

- A typed company profile captures registration identifiers, legal entity, VAT status, proposed income-tax regime, year end, reporting framework, employees and withholding status, invoice series and CAS reference.
- Validation checks registration-field formats and obvious incompatible selections. It does not query BIR or SEC registration records. The TIN is nine digits; the branch code is a separate five-digit string. The internal company code is not a government identifier and must never grant access by itself.
- The checklist distinguishes corporations, OPCs, partnerships, foreign branches and sole proprietors. It selects employer review items when there are employees, and includes a self-employed contribution review for a sole proprietor without employees.
- The company profile is not sufficiently detailed to decide audit thresholds, special industry rules, exemptions, economic-zone incentives, general professional partnership treatment, public-accountability classification or the correct reporting framework. Those remain review tasks.
- `calculateInvoiceTax` supports a single treatment per calculation: 12% VAT, zero-rated, VAT-exempt or non-VAT. Values are non-negative safe integers in centavos. It rounds VAT to a centavo using integer arithmetic; positive half-cent ties round up. For inclusive amounts, VAT is rounded from `gross × 12 / 112` and net is the remaining amount. For exclusive amounts, VAT is rounded from `net × 12 / 100`. Invoice-level rounding is an application convention that must be reconciled with the approved invoice format and reporting workflow; this is not a tax-return rounding implementation.
- `validateInvoiceTaxTreatment` checks seller VAT registration against the proposed sale treatment. Call it before posting or issuing a sales invoice. It does not validate zero-rating or exemption eligibility. Mixed supplies require separate treatment totals and a reviewed aggregation policy; withholding, discounts, foreign exchange, refunds and credit notes are outside this calculator.

## Verified regulatory references

Sources were checked on **17 September 2026**. The date records research, not a guarantee that no later rule applies. Some SEC pages were available through indexed official content while direct retrieval returned an access error. Implementations of specific SEC thresholds or deadlines must retrieve the applicable current issuance before relying on them.

| Area | Source and product implication |
|---|---|
| EOPT invoices | [RR 7-2024](https://bir-cdn.bir.gov.ph/BIR/pdf/RR%20No.%207-%202024.pdf), [RR 11-2024](https://bir-cdn.bir.gov.ph/BIR/pdf/RR%2011-2024.pdf) and [RMC 77-2024](https://bir-cdn.bir.gov.ph/BIR/pdf/RMC%20No.%2077-2024.pdf): review registered invoice particulars, naming and numbering for goods and services. Collection/payment receipts remain distinct from the principal invoice. |
| CAS and computerized books | [RMC 5-2021](https://bir-cdn.bir.gov.ph/local/pdf/RMC%20No.%205-2021%20%281%29.pdf): covered systems follow registration and documentation requirements rather than assuming that installing software supplies a permit or registration. System standards, books and retention need separate review. |
| Electronic invoicing | [RR 11-2025](https://bir-cdn.bir.gov.ph/BIR/pdf/RR%2011-2025.pdf), as amended by [RR 26-2025](https://bir-cdn.bir.gov.ph/BIR/pdf/RR%20No.%2026-2025.pdf): assess taxpayer coverage, structured invoice capability, transition provisions and separate electronic sales-reporting requirements. The latter provides a 31 December 2026 compliance period for the covered groups it lists; this is not a universal filing deadline and is not embedded as a company due date. A printable invoice or PDF alone is not a compliant electronic-invoice integration. |
| Individual income-tax option | [BIR Form 2551Q guidance](https://efps.bir.gov.ph/efps-war/EFPSWeb_war/forms2018Version/2551Q/2551q_guidelines.html): the individual 8% option has eligibility and election conditions. The profile only rejects obvious VAT/entity mismatches. Current thresholds, election timing and exceptions remain unimplemented. |
| SEC | [Primary-license requirements](https://www.sec.gov.ph/reportorial-requirements/corporations-with-primary-licenses/) and [secondary-license requirements](https://www.sec.gov.ph/reportorial-requirements/corporations-with-secondary-licenses/): select reports by entity and license. OPC officer reporting and partnership review must not be treated as ordinary corporation GIS by default. [SEC accounting guidance](https://www.sec.gov.ph/wp-content/uploads/2022/11/2022CC_SEC-Main-Office-Citizens-Charter-2022-1st-Edition-1-compressed.pdf) identifies distinct PFRS, SME and small-entity frameworks. |
| Local permits | [DTI business registration guidance](https://ecommerce.dti.gov.ph/faqs/): business permits and additional requirements depend on the LGU and activity. The module does not calculate local taxes or assume a universal renewal date. |
| Employer obligations | [SSS](https://www.sss.gov.ph/employer-er/), [PhilHealth](https://www.philhealth.gov.ph/partners/employers/) and [Pag-IBIG Circular 275](https://www.pagibigfund.gov.ph/document/pdf/circulars/provident/HDMF%20Circular%20275%20-%20Implementing%20Guidelines%20on%20Employer%20Registration%20Contribution%20and%20Remittance.pdf): review registration, employee records, contributions and remittances. Current contribution calculations and actual submission are not implemented. |

## API

```ts
validateCompanyProfile(profile) // { valid, errors: { field, code, message }[], warnings: ...[] }
getComplianceChecklist(profile) // { id, agency, title, description, reviewRequired: true, sources }[]
validateInvoiceTaxTreatment(profile, treatment) // string[] errors
calculateInvoiceTax(amountCentavos, treatment, inclusive) // netCentavos, vatCentavos, grossCentavos, treatment, inclusive
```

`DEFAULT_COMPANY_PROFILE` is an incomplete starting form, not a production configuration. `PH_COMPLIANCE_SOURCES` includes official links and research dates. The checklist intentionally has no automatic compliant status, certification toggle or computed deadlines.

## Release boundaries

Before real statutory use, the accountant must review the actual company registration, tax treatments, ledger controls, invoice requirements and reporting outputs against current rules. Any required agency registration and authorization remain separate tasks. Entity- and transaction-specific regulations outside this review queue are not represented as covered. In particular, no direct eBIRForms/eFPS/eAFS/eFAST/HARBOR filing, BIR EIS transmission, payroll remittance, SEC audit certification, or complete tax-return generation is supplied by this module.

Run module verification with `node --experimental-strip-types --test tests/ph-compliance.test.ts`.
