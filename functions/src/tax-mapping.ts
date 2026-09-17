/** Account-to-return bridge. Values are integer centavos; this prepares working papers, not a filed return. */
export type MappingAccount = { code: string; name: string; type: 'Asset'|'Liability'|'Equity'|'Revenue'|'Expense'; cash: boolean }
export type MappingBooks = { accounts: MappingAccount[]; entries: {id:string;date:string;reference:string;reversalOf?:string;lines:{account:string;debit:number;credit:number}[]}[]; invoices?: {id:string;kind:'payable'|'receivable';party:string;partyTin?:string;partyAddress?:string;reference:string;date:string;entryId:string;amount:number;netAmount?:number;vatAmount?:number;taxTreatment?:string}[] }
export const taxCategories = [
  ['sales','Sales / revenues / receipts','Revenue','period','credit'],
  ['sales_returns','Sales returns, allowances and discounts','Revenue,Expense','period','debit'],
  ['cost_sales','Cost of sales / services','Expense','period','debit'],
  ['other_income','Other taxable income','Revenue','period','credit'],
  ['non_taxable_income','Income requiring exempt / final-tax review','Revenue','period','credit'],
  ['salaries','Salaries, wages and benefits','Expense','period','debit'],
  ['rent','Rental expense','Expense','period','debit'],
  ['utilities','Utilities and communication','Expense','period','debit'],
  ['depreciation','Depreciation and amortization','Expense','period','debit'],
  ['interest','Interest expense','Expense','period','debit'],
  ['professional_fees','Professional and management fees','Expense','period','debit'],
  ['taxes_licenses','Taxes and licenses, excluding income tax','Expense','period','debit'],
  ['insurance','Insurance expense','Expense','period','debit'],
  ['repairs','Repairs and maintenance','Expense','period','debit'],
  ['other_expenses','Other operating expenses','Expense','period','debit'],
  ['non_deductible','Expenses requiring tax add-back','Expense','period','debit'],
  ['income_tax','Income tax expense','Expense','period','debit'],
  ['assets','Assets / balance-sheet support','Asset','closing','debit'],
  ['liabilities','Liabilities / balance-sheet support','Liability','closing','credit'],
  ['equity','Equity / balance-sheet support','Equity','closing','credit'],
  ['input_vat','Input VAT / reconciliation support','Asset','closing','debit'],
  ['output_vat','Output VAT / reconciliation support','Liability','closing','credit'],
  ['creditable_tax','Creditable tax recorded in the period','Asset','period','debit'],
  ['excluded','Excluded from return mapping — review reason','Asset,Liability,Equity,Revenue,Expense','period','debit'],
] as const
export type TaxCategory = typeof taxCategories[number][0]
export type AccountTaxMapping = { account: string; category: TaxCategory; note: string }
export type TaxAdjustment = { label: string; amount: number }
export const TAX_FORM_SOURCES = {
  '1701': 'https://bir-cdn.bir.gov.ph/local/pdf/1701%20Jan%202018%20final%20with%20rates.pdf',
  '1702-RT': 'https://bir-cdn.bir.gov.ph/local/pdf/1702-RT%20Jan%202018%20ENCS%20Final%20v3.pdf',
}
export function validTaxDate(value: string) { return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value+'T00:00:00Z').toISOString().slice(0,10) === value }
export function suggestedMapping(account: MappingAccount): TaxCategory | '' {
  const name = account.name.toLowerCase()
  if (account.type === 'Asset' && /input.*vat|vat.*input/.test(name)) return 'input_vat'
  if (account.type === 'Liability' && /output.*vat|vat.*output/.test(name)) return 'output_vat'
  if (account.type === 'Asset') return /withheld|creditable/.test(name) ? 'creditable_tax' : 'assets'
  if (account.type === 'Liability') return 'liabilities'
  if (account.type === 'Equity') return 'equity'
  if (account.type === 'Revenue') return /return|discount|allowance/.test(name) ? 'sales_returns' : /other|interest/.test(name) ? 'other_income' : 'sales'
  if (/cost of|costs of/.test(name)) return 'cost_sales'
  if (/salary|salaries|wages|benefit/.test(name)) return 'salaries'
  if (/rent/.test(name)) return 'rent'
  if (/utilities|electric|water|internet|telephone/.test(name)) return 'utilities'
  if (/depreciation|amortization/.test(name)) return 'depreciation'
  if (/income tax/.test(name)) return 'income_tax'
  if (/interest/.test(name)) return 'interest'
  if (/professional|legal|accounting fee/.test(name)) return 'professional_fees'
  if (/insurance/.test(name)) return 'insurance'
  if (/repairs|maintenance/.test(name)) return 'repairs'
  return ''
}
export function validateMappings(value: unknown, accounts: MappingAccount[]): AccountTaxMapping[] {
  if (!Array.isArray(value) || value.length > 500) throw Error('Provide at most 500 account mappings.')
  const seen = new Set<string>()
  return value.map(raw => {
    if (!raw || typeof raw !== 'object') throw Error('Invalid account mapping.')
    const account = accounts.find(a => a.code === raw.account), category = taxCategories.find(c => c[0] === raw.category)
    if (!account || !category || !category[2].split(',').includes(account.type)) throw Error(`Invalid tax category for account ${String(raw.account)}.`)
    if (seen.has(account.code)) throw Error('An account cannot be mapped twice. Split transactions into separate accounts when treatments differ.')
    const note = typeof raw.note === 'string' ? raw.note.trim() : ''
    if (note.length > 500 || (category[0] === 'excluded' && !note)) throw Error('Excluded accounts need a review reason (up to 500 characters).')
    seen.add(account.code); return {account:account.code,category:category[0],note}
  })
}
export function buildTaxWorksheet(books: MappingBooks, mapping: AccountTaxMapping[], from: string, to: string, adjustments: TaxAdjustment[] = []) {
  if (!validTaxDate(from) || !validTaxDate(to) || from > to || Number(to.slice(0,4))-Number(from.slice(0,4)) > 1) throw Error('Choose a valid reporting period of no more than two calendar years.')
  const mappings = validateMappings(mapping, books.accounts)
  if (!Array.isArray(adjustments) || adjustments.length > 50 || adjustments.some(a => !a.label?.trim() || a.label.length>200 || !Number.isSafeInteger(a.amount) || Math.abs(a.amount)>1e12)) throw Error('Every tax adjustment needs a description and a valid amount in centavos.')
  const totals: Record<string,number> = Object.fromEntries(taxCategories.map(c => [c[0],0]))
  const sources = books.accounts.map(account => {
    let periodDebit=0,periodCredit=0,closingDebit=0,closingCredit=0
    const refs: string[]=[],closingRefs:string[]=[]
    for (const entry of books.entries) {
      if (entry.date > to) continue
      for (const line of entry.lines.filter(l => l.account===account.code)) {
        closingDebit+=line.debit; closingCredit+=line.credit;closingRefs.push(entry.id)
        if (entry.date >= from) {periodDebit+=line.debit;periodCredit+=line.credit;refs.push(entry.id)}
      }
    }
    const mapped = mappings.find(m => m.account===account.code), category = taxCategories.find(c => c[0]===mapped?.category)
    const debit=category?.[3]==='closing'?closingDebit:periodDebit,credit=category?.[3]==='closing'?closingCredit:periodCredit
    const value=category?.[4]==='credit'?credit-debit:debit-credit
    if (category) totals[category[0]]+=value
    return {account:account.code,name:account.name,type:account.type,category:mapped?.category||'',note:mapped?.note||'',basis:category?.[3]||'period',amount:value,periodDebit,periodCredit,closingBalance:closingDebit-closingCredit,periodEntryIds:[...new Set(refs)],closingEntryIds:[...new Set(closingRefs)],entryIds:[...new Set(category?.[3]==='closing'?closingRefs:refs)]}
  })
  if (sources.some(s => [s.amount,s.periodDebit,s.periodCredit,s.closingBalance].some(v => !Number.isSafeInteger(v)))) throw Error('An amount exceeds the supported safe range.')
  const expenseKeys=['salaries','rent','utilities','depreciation','interest','professional_fees','taxes_licenses','insurance','repairs','other_expenses']
  const operatingExpenses=expenseKeys.reduce((sum,key)=>sum+totals[key],0)
  const netSales=totals.sales-totals.sales_returns,grossIncome=netSales-totals.cost_sales+totals.other_income
  const bookProfit=sources.filter(s=>s.type==='Revenue').reduce((sum,s)=>sum+s.periodCredit-s.periodDebit,0)-sources.filter(s=>s.type==='Expense').reduce((sum,s)=>sum+s.periodDebit-s.periodCredit,0)
  const adjustmentTotal=adjustments.reduce((sum,a)=>sum+a.amount,0)
  const unmapped=sources.filter(s=>!s.category&&(s.periodDebit||s.periodCredit||s.closingBalance)).map(s=>s.account)
  const excluded=sources.filter(s=>s.category==='excluded'&&(s.periodDebit||s.periodCredit)).map(s=>s.account)
  return {from,to,totals,sources,netSales,grossProfit:netSales-totals.cost_sales,grossIncome,operatingExpenses,bookProfit,adjustments,adjustmentTotal,adjustedBusinessIncome:grossIncome-operatingExpenses+adjustmentTotal,unmapped,excluded,
    warnings:[...(unmapped.length?['Map every account with activity or a closing balance before review.']:[]),...(excluded.length?['Excluded accounts have activity; review the recorded reasons.']:[]),'Amounts are working-paper figures. Confirm deductibility, tax basis, adjustments, credits and the correct form version.','Creditable tax in the books is supporting data; validate certificates and period allocation before claiming it.']}
}
export function wholePesos(centavos: number) { return Math.sign(centavos) * Math.floor((Math.abs(centavos)+50)/100) }
export function taxAmount(value:string) {
  const raw=value.trim()
  if(!/^-?\d+(\.\d{1,2})?$/.test(raw))throw Error('Enter an amount with at most two decimal places.')
  const [whole,fraction='']=raw.replace('-','').split('.')
  const amount=BigInt(whole)*100n+BigInt(fraction.padEnd(2,'0'))
  if(amount>1000000000000n)throw Error('The amount exceeds the supported limit.')
  return Number(raw.startsWith('-')?-amount:amount)
}
