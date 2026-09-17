/** Philippine company setup and review prompts; this module does not certify or file compliance. */
export type EntityType = 'sole_proprietor' | 'corporation' | 'opc' | 'partnership' | 'nonstock' | 'foreign_branch'
export type VatStatus = 'vat' | 'non_vat'
export type IncomeTaxRegime = 'graduated' | 'eight_percent' | 'corporate'
export type ReportingFramework = 'pfrs' | 'pfrs_smes' | 'pfrs_small'
export type TaxTreatment = 'VAT12' | 'VAT_ZERO' | 'VAT_EXEMPT' | 'NON_VAT'

export interface CompanyProfile {
  registeredName: string
  code?: string
  tin: string
  branchCode: string
  rdo: string
  registeredAddress: string
  entityType: EntityType
  vatStatus: VatStatus
  incomeTaxRegime: IncomeTaxRegime
  /** Recurring month and day, for example 12-31. */
  fiscalYearEnd: string
  reportingFramework: ReportingFramework
  withholdingAgent: boolean
  hasEmployees: boolean
  casRegistrationReference: string
  invoiceSeries: string
  secRegistrationNumber: string
  businessNature: string
  /** Remains true: saving this profile is not an accountant's certification. */
  accountantReviewRequired: true
}

export const DEFAULT_COMPANY_PROFILE: Readonly<CompanyProfile> = Object.freeze({
  registeredName: '', tin: '', branchCode: '00000', rdo: '', registeredAddress: '',
  entityType: 'corporation', vatStatus: 'non_vat', incomeTaxRegime: 'corporate',
  fiscalYearEnd: '12-31', reportingFramework: 'pfrs_small', withholdingAgent: false,
  hasEmployees: false, casRegistrationReference: '', invoiceSeries: '',
  secRegistrationNumber: '', businessNature: '', accountantReviewRequired: true,
})

export interface ComplianceSource { title: string; url: string; checkedOn: string }
const source = (title: string, url: string): ComplianceSource => ({ title, url, checkedOn: '2026-09-17' })

export const PH_COMPLIANCE_SOURCES = {
  invoicing: source('BIR RR 7-2024 — registration and invoicing', 'https://bir-cdn.bir.gov.ph/BIR/pdf/RR%20No.%207-%202024.pdf'),
  invoiceTransition: source('BIR RR 11-2024 — amended invoicing transition', 'https://bir-cdn.bir.gov.ph/BIR/pdf/RR%2011-2024.pdf'),
  invoiceClarification: source('BIR RMC 77-2024 — invoice clarification', 'https://bir-cdn.bir.gov.ph/BIR/pdf/RMC%20No.%2077-2024.pdf'),
  electronicInvoices: source('BIR RR 11-2025 — electronic invoices', 'https://bir-cdn.bir.gov.ph/BIR/pdf/RR%2011-2025.pdf'),
  electronicInvoiceTransition: source('BIR RR 26-2025 — amended electronic invoice transition', 'https://bir-cdn.bir.gov.ph/BIR/pdf/RR%20No.%2026-2025.pdf'),
  cas: source('BIR RMC 5-2021 — CAS and computerized books registration', 'https://bir-cdn.bir.gov.ph/local/pdf/RMC%20No.%205-2021%20%281%29.pdf'),
  percentageTax: source('BIR 2551Q guidance — percentage tax and individual 8% option', 'https://efps.bir.gov.ph/efps-war/EFPSWeb_war/forms2018Version/2551Q/2551q_guidelines.html'),
  birServices: source('BIR — official services and tax issuances', 'https://www.bir.gov.ph/'),
  secReporting: source('SEC — primary-license reporting requirements', 'https://www.sec.gov.ph/reportorial-requirements/corporations-with-primary-licenses/'),
  secSpecialReporting: source('SEC — secondary-license reporting requirements', 'https://www.sec.gov.ph/reportorial-requirements/corporations-with-secondary-licenses/'),
  reportingFrameworks: source('SEC — accounting frameworks and interpretations', 'https://www.sec.gov.ph/wp-content/uploads/2022/11/2022CC_SEC-Main-Office-Citizens-Charter-2022-1st-Edition-1-compressed.pdf'),
  businessPermits: source('DTI — business permits and agency registration guidance', 'https://ecommerce.dti.gov.ph/faqs/'),
  sss: source('SSS — employer responsibilities', 'https://www.sss.gov.ph/employer-er/'),
  sssIndividual: source('SSS — contributions and self-employed coverage', 'https://www.sss.gov.ph/pay-contribution/'),
  philhealth: source('PhilHealth — employer registration and reporting', 'https://www.philhealth.gov.ph/partners/employers/'),
  pagibig: source('Pag-IBIG Circular 275 — employer registration and remittance', 'https://www.pagibigfund.gov.ph/document/pdf/circulars/provident/HDMF%20Circular%20275%20-%20Implementing%20Guidelines%20on%20Employer%20Registration%20Contribution%20and%20Remittance.pdf'),
} satisfies Record<string, ComplianceSource>

export interface ProfileIssue { field: keyof CompanyProfile; code: string; message: string }
export interface CompanyProfileValidation { valid: boolean; errors: ProfileIssue[]; warnings: ProfileIssue[] }

const entityTypes: readonly EntityType[] = ['sole_proprietor', 'corporation', 'opc', 'partnership', 'nonstock', 'foreign_branch']
const taxTreatments: readonly TaxTreatment[] = ['VAT12', 'VAT_ZERO', 'VAT_EXEMPT', 'NON_VAT']
const textValue = (value: unknown) => typeof value === 'string' ? value.trim() : ''

/** Checks format and obvious inconsistent choices, not legal eligibility or official registration. */
export function validateCompanyProfile(profile: CompanyProfile): CompanyProfileValidation {
  const errors: ProfileIssue[] = []
  const warnings: ProfileIssue[] = []
  const error = (field: keyof CompanyProfile, code: string, message: string) => errors.push({ field, code, message })
  const warn = (field: keyof CompanyProfile, code: string, message: string) => warnings.push({ field, code, message })
  if (!profile || typeof profile !== 'object') {
    error('registeredName', 'profile_required', 'Enter a company profile.')
    return { valid: false, errors, warnings }
  }
  for (const [field, label, max] of [
    ['registeredName', 'Registered name', 200], ['registeredAddress', 'Registered address', 500],
    ['businessNature', 'Business activity', 300], ['invoiceSeries', 'Invoice series', 80],
  ] as const) {
    const value = textValue(profile[field])
    if (!value) error(field, 'required', `${label} is required.`)
    else if (value.length > max) error(field, 'too_long', `${label} must be ${max} characters or fewer.`)
  }
  const tin = textValue(profile.tin)
  if (!/^(?:\d{9}|\d{3}-\d{3}-\d{3})$/.test(tin) || /^0+$/.test(tin.replaceAll('-', ''))) {
    error('tin', 'invalid_tin', 'Enter the nine-digit TIN separately from the branch code.')
  }
  if (!/^\d{5}$/.test(textValue(profile.branchCode))) error('branchCode', 'invalid_branch_code', 'Enter the five-digit BIR branch code, including leading zeros.')
  if (!/^\d{1,3}[A-Za-z]?$/.test(textValue(profile.rdo))) error('rdo', 'invalid_rdo', 'Enter the RDO code from the BIR registration, such as 044 or 25A.')
  if (profile.code !== undefined && !/^[A-Za-z0-9][A-Za-z0-9_-]{2,31}$/.test(textValue(profile.code))) error('code', 'invalid_company_code', 'Company code must contain 3–32 letters, numbers, hyphens or underscores.')
  if (!entityTypes.includes(profile.entityType)) error('entityType', 'invalid_entity_type', 'Select a supported legal entity type.')
  if (!['vat', 'non_vat'].includes(profile.vatStatus)) error('vatStatus', 'invalid_vat_status', 'Select the VAT status shown in the BIR registration.')
  if (!['graduated', 'eight_percent', 'corporate'].includes(profile.incomeTaxRegime)) error('incomeTaxRegime', 'invalid_income_tax_regime', 'Select an income tax regime for accountant review.')
  if (!['pfrs', 'pfrs_smes', 'pfrs_small'].includes(profile.reportingFramework)) error('reportingFramework', 'invalid_reporting_framework', 'Select a reporting framework for accountant review.')
  if (typeof profile.withholdingAgent !== 'boolean') error('withholdingAgent', 'invalid_boolean', 'Specify whether the company is a withholding agent.')
  if (typeof profile.hasEmployees !== 'boolean') error('hasEmployees', 'invalid_boolean', 'Specify whether the company has employees.')
  if (profile.accountantReviewRequired !== true) error('accountantReviewRequired', 'review_required', 'Accountant review must remain required; profile validation does not certify compliance.')

  const date = /^(\d{2})-(\d{2})$/.exec(textValue(profile.fiscalYearEnd))
  const month = date ? Number(date[1]) : 0
  const day = date ? Number(date[2]) : 0
  const maxDay = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ?? 0
  if (!date || month < 1 || month > 12 || day < 1 || day > maxDay) error('fiscalYearEnd', 'invalid_fiscal_year_end', 'Enter a valid fiscal year end as MM-DD, such as 12-31.')

  if (profile.incomeTaxRegime === 'eight_percent') {
    if (profile.entityType !== 'sole_proprietor') error('incomeTaxRegime', 'eight_percent_individual_only', 'The individual 8% option cannot be selected for this entity type.')
    if (profile.vatStatus !== 'non_vat') error('incomeTaxRegime', 'eight_percent_non_vat_only', 'The individual 8% option requires non-VAT status.')
    warn('incomeTaxRegime', 'eight_percent_eligibility_review', 'Confirm current eligibility, income threshold, election and other income with the accountant; this selection does not make the election.')
  }
  if (profile.entityType === 'sole_proprietor' && profile.incomeTaxRegime === 'corporate') error('incomeTaxRegime', 'sole_proprietor_corporate_tax', 'A sole proprietor must use an individual income tax regime.')
  if (['corporation', 'opc', 'foreign_branch'].includes(profile.entityType) && profile.incomeTaxRegime === 'graduated') error('incomeTaxRegime', 'corporate_individual_tax', 'Graduated individual income tax is not a corporate income tax regime.')
  if (profile.entityType !== 'sole_proprietor' && entityTypes.includes(profile.entityType) && !textValue(profile.secRegistrationNumber)) error('secRegistrationNumber', 'sec_registration_required', 'Enter the SEC registration or license number for this entity.')
  if (textValue(profile.secRegistrationNumber).length > 100) error('secRegistrationNumber', 'too_long', 'SEC registration number must be 100 characters or fewer.')
  if (textValue(profile.casRegistrationReference).length > 200) error('casRegistrationReference', 'too_long', 'CAS registration reference must be 200 characters or fewer.')
  if (!textValue(profile.casRegistrationReference)) warn('casRegistrationReference', 'cas_registration_review', 'Confirm the CAS/CBA registration and system documentation with the registered RDO before production use.')
  if (profile.entityType === 'sole_proprietor' && profile.fiscalYearEnd !== '12-31') warn('fiscalYearEnd', 'individual_tax_year_review', 'Review the individual taxpayer calendar-year requirement before using this year end for tax returns.')
  if (['partnership', 'nonstock', 'foreign_branch'].includes(profile.entityType)) warn('incomeTaxRegime', 'entity_specific_tax_review', 'Confirm entity-specific tax treatment, exemptions and filing obligations; this profile does not determine tax exemption or partnership classification.')
  warn('reportingFramework', 'framework_review', 'An accountant must confirm the applicable reporting framework using entity size, public accountability and regulatory requirements.')
  warn('accountantReviewRequired', 'accountant_review_required', 'Accountant review of the company registration, tax treatments and reporting obligations is required.')
  return { valid: errors.length === 0, errors, warnings }
}

export interface ComplianceChecklistItem {
  id: string
  agency: 'BIR' | 'SEC' | 'LGU' | 'SSS' | 'PhilHealth' | 'Pag-IBIG'
  title: string
  description: string
  reviewRequired: true
  sources: ComplianceSource[]
}

/** A review queue, not a complete legal obligation list or a computed filing calendar. */
export function getComplianceChecklist(profile: CompanyProfile): ComplianceChecklistItem[] {
  const s = PH_COMPLIANCE_SOURCES
  const items: ComplianceChecklistItem[] = []
  const add = (id: string, agency: ComplianceChecklistItem['agency'], title: string, description: string, sources: ComplianceSource[]) => {
    items.push({ id, agency, title, description, reviewRequired: true, sources: sources.map(item => ({ ...item })) })
  }
  add('bir-registration', 'BIR', 'Review BIR registration', 'Reconcile legal name, TIN, branch, RDO, address and registered tax types to official records. The company code is an internal identifier.', [s.invoicing])
  add('bir-invoices', 'BIR', 'Review registered invoice format and series', 'Confirm mandatory invoice particulars, invoice naming, VAT labels and registered numbering. Payment receipts are supplementary documents; saved records are not automatically registered invoices.', [s.invoicing, s.invoiceTransition, s.invoiceClarification])
  add('bir-books-cas', 'BIR', 'Review books and CAS/CBA registration', 'Confirm system registration, required documentation, book registration, retention and audit access. A reference entered here is not BIR approval.', [s.cas, s.invoicing])
  add('bir-electronic-invoices', 'BIR', 'Assess electronic invoicing coverage', 'Review coverage under RR 11-2025 as amended by RR 26-2025, applicable transition dates, structured invoice data and separate sales-reporting requirements. A PDF alone does not establish electronic-invoice compliance.', [s.electronicInvoices, s.electronicInvoiceTransition])
  if (profile.vatStatus === 'vat') {
    add('bir-vat', 'BIR', 'Review VAT treatment and returns', 'Reconcile taxable, zero-rated and exempt sales and eligible input tax. Verify transaction-specific eligibility and current return requirements before filing.', [s.invoicing, s.birServices])
  } else {
    add('bir-non-vat', 'BIR', 'Review non-VAT and percentage-tax treatment', profile.incomeTaxRegime === 'eight_percent'
      ? 'Confirm eligibility and valid election for the individual 8% option, including its interaction with percentage tax. Do not add VAT to non-VAT invoices.'
      : 'Confirm which percentage taxes or exemptions apply to this taxpayer and activity. Non-VAT status alone does not determine every tax obligation.', [s.percentageTax, s.invoicing])
  }
  add('bir-income-tax', 'BIR', 'Review income-tax filings and attachments', 'Confirm the selected regime, applicable return, tax adjustments, credits and supporting financial statements. Determine filing dates from the current rules and the taxpayer registration.', [s.birServices, s.percentageTax])
  if (profile.withholdingAgent || profile.hasEmployees) add('bir-withholding', 'BIR', 'Review withholding and certificates', 'Assess compensation and supplier-payment withholding separately. Confirm payee classifications, current rates, returns, alphalists and applicable certificates with the accountant.', [s.birServices])
  add('lgu-business', 'LGU', 'Review local business permits and taxes', 'Confirm requirements, local taxes, permit renewal and any activity-specific clearances with the city or municipality where the business operates.', [s.businessPermits])

  if (profile.entityType === 'partnership') {
    add('sec-partnership', 'SEC', 'Review partnership registration and reporting', 'Confirm partnership-specific records and filing requirements. Corporate GIS and AFS rules must not automatically be assigned to a partnership.', [s.secReporting, s.businessPermits])
  } else if (profile.entityType !== 'sole_proprietor') {
    add('sec-financial-statements', 'SEC', 'Review SEC financial statements', 'Confirm the applicable financial reporting framework, current audit requirements, attachments, authorized signatories and filing channel for this entity and fiscal year.', [s.secReporting, s.reportingFrameworks])
    if (profile.entityType === 'opc') {
      add('sec-opc-officers', 'SEC', 'Review OPC officer reporting', 'Check the current OPC appointment-of-officers form and change-reporting obligations instead of assuming ordinary corporation GIS requirements.', [s.secReporting])
    } else {
      add('sec-gis', 'SEC', 'Review GIS and corporate information', 'Check the current entity-specific GIS form, ownership and officer information, meeting or license dates and any separate beneficial-ownership disclosure requirements.', [s.secReporting])
    }
    add('sec-special-scope', 'SEC', 'Check additional regulatory reporting', 'Assess secondary licenses, public accountability and industry-specific filings. The basic company profile cannot determine all special obligations.', [s.secSpecialReporting])
  }
  if (profile.hasEmployees) {
    add('sss-employer', 'SSS', 'Review SSS employer obligations', 'Confirm employer and employee registration, payroll contribution tables, remittance, reporting and payment evidence.', [s.sss])
    add('philhealth-employer', 'PhilHealth', 'Review PhilHealth employer obligations', 'Confirm employer and employee records, applicable premiums, employer shares, remittance and reporting.', [s.philhealth])
    add('pagibig-employer', 'Pag-IBIG', 'Review Pag-IBIG employer obligations', 'Confirm coverage, registration, current contributions, applicable loan deductions and remittance records.', [s.pagibig])
  } else if (profile.entityType === 'sole_proprietor') {
    add('sss-self-employed', 'SSS', 'Review self-employed social contributions', 'Assess the proprietor’s individual SSS, PhilHealth and Pag-IBIG coverage separately from employer payroll. Having no employees does not establish an individual exemption.', [s.sssIndividual, s.businessPermits])
  }
  return items
}

export interface InvoiceTaxBreakdown {
  netCentavos: number
  vatCentavos: number
  grossCentavos: number
  treatment: TaxTreatment
  inclusive: boolean
}

/** Validates seller registration against the proposed sales treatment, not exemption/zero-rate eligibility. */
export function validateInvoiceTaxTreatment(profile: Pick<CompanyProfile, 'vatStatus'>, treatment: TaxTreatment): string[] {
  if (!taxTreatments.includes(treatment)) return ['Select a supported invoice tax treatment.']
  if (!profile || !['vat', 'non_vat'].includes(profile.vatStatus)) return ['A valid company VAT status is required.']
  if (profile.vatStatus === 'non_vat' && treatment !== 'NON_VAT') return ['A non-VAT seller must use NON_VAT treatment; VAT invoice treatments require VAT registration.']
  if (profile.vatStatus === 'vat' && treatment === 'NON_VAT') return ['A VAT-registered seller must choose VAT12, VAT_ZERO or VAT_EXEMPT according to the transaction.']
  return []
}

/** Single-treatment invoice totals. Positive half-cent values round up; no floating-point tax arithmetic. */
export function calculateInvoiceTax(amountCentavos: number, treatment: TaxTreatment, inclusive: boolean): InvoiceTaxBreakdown {
  if (!Number.isSafeInteger(amountCentavos) || amountCentavos < 0) throw new RangeError('Invoice amount must be a non-negative safe integer in centavos.')
  if (!taxTreatments.includes(treatment)) throw new TypeError('Unsupported invoice tax treatment.')
  if (typeof inclusive !== 'boolean') throw new TypeError('Specify whether the invoice amount includes VAT.')
  const amount = BigInt(amountCentavos)
  const vat = treatment === 'VAT12' ? (inclusive ? (amount * 12n + 56n) / 112n : (amount * 12n + 50n) / 100n) : 0n
  const net = inclusive ? amount - vat : amount
  const gross = net + vat
  if (gross > BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError('Invoice total exceeds the safe centavo limit.')
  return { netCentavos: Number(net), vatCentavos: Number(vat), grossCentavos: Number(gross), treatment, inclusive }
}
