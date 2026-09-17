import { buildTaxWorksheet, TAX_FORM_SOURCES, taxCategories, validTaxDate, type MappingBooks, type AccountTaxMapping, type TaxAdjustment } from './tax-mapping.js'

export const registerKinds = ['vat_sales','vat_purchases','percentage','expanded_withholding','final_withholding','payroll','other'] as const
export type RegisterKind = typeof registerKinds[number]
export const registerLabels: Record<RegisterKind,string> = {vat_sales:'VAT sales',vat_purchases:'VAT purchases',percentage:'Percentage tax',expanded_withholding:'Expanded withholding',final_withholding:'Final withholding',payroll:'Payroll / compensation',other:'Other tax transaction'}
export type TaxRegister = {id:string;entryId:string;date:string;kind:RegisterKind;partyId:string;partyName:string;tin:string;address:string;atc:string;classification:string;taxBase:number;taxAmount:number;notes:string;active:boolean}
export type ReturnField = {id:string;label:string;reference:string;source:'category'|'accounts'|'register';category:string;accounts:string[];basis:'net_debit'|'net_credit'|'debits'|'credits'|'closing_debit'|'closing_credit';kind:RegisterKind;measure:'taxBase'|'taxAmount';classification:string}
export type ReturnTemplate = {code:string;name:string;family:'income'|'vat'|'percentage'|'withholding'|'payroll'|'other';frequency:'monthly'|'quarterly'|'annual'|'transaction';sourceUrl:string;edition:string;fields:ReturnField[];requirements:string[]}
export const BIR_FORMS_URL='https://www.bir.gov.ph/bir-forms'
const field = (id:string,label:string,source:ReturnField['source'],extra:Partial<ReturnField>={}):ReturnField => ({id,label,reference:'Accounting support — confirm current form line',source,category:id,accounts:[],basis:'net_debit',kind:'other',measure:'taxBase',classification:'',...extra})
const reg = (kind:RegisterKind,measure:'taxBase'|'taxAmount',classification='') => field(`${kind}_${measure}_${classification||'all'}`,`${registerLabels[kind]} · ${classification||'all classifications'} · ${measure==='taxBase'?'tax base':'recorded tax'}`,'register',{kind,measure,classification})
const incomeFields = ['sales','sales_returns','cost_sales','other_income','non_taxable_income','salaries','rent','utilities','depreciation','interest','professional_fees','taxes_licenses','insurance','repairs','other_expenses','non_deductible','income_tax','creditable_tax','assets','liabilities','equity'].map(key=>field(key,taxCategories.find(c=>c[0]===key)![1],'category'))
const incomeRequirements=['Confirm taxpayer type, tax regime, applicable form and edition.','Reconcile deductions, tax adjustments, exempt/final-tax income and any special schedules.','Validate certificates, prior payments, carryovers, tax rates and final tax computation.','Include compensation, spouse, partner and other non-book information where applicable.']
const commonRequirements=['Confirm the reporting period, tax basis, ATCs and applicable rates against the current BIR form.','Reconcile remittances, credits, adjustments, prior returns and the final amount payable.','Complete and validate all required schedules and attachments in the official filing channel.']
const make=(code:string,name:string,family:ReturnTemplate['family'],frequency:ReturnTemplate['frequency'],fields:ReturnField[]):ReturnTemplate=>({code,name,family,frequency,sourceUrl:code==='1701'?TAX_FORM_SOURCES['1701']:code==='1702-RT'?TAX_FORM_SOURCES['1702-RT']:BIR_FORMS_URL,edition:'Accounting working paper; verify current BIR edition',fields,requirements:family==='income'?incomeRequirements:commonRequirements})
export const defaultReturnTemplates:ReturnTemplate[]=[
  ...[['1701','Individual annual income tax'],['1701A','Individual annual income tax — OSD / 8%'],['1701-MS','Micro / small individual annual income tax'],['1702-RT','Corporate annual income tax — regular'],['1702-EX','Exempt non-individual annual income tax'],['1702-MX','Mixed / special-rate annual income tax']].map(([code,name])=>make(code,name,'income','annual',incomeFields)),
  ...[['1701Q','Individual quarterly income tax'],['1702Q','Corporate quarterly income tax']].map(([code,name])=>make(code,name,'income','quarterly',incomeFields)),
  make('2550Q','Quarterly VAT','vat','quarterly',[...['VAT12','VAT_ZERO','VAT_EXEMPT'].flatMap(c=>[reg('vat_sales','taxBase',c),reg('vat_sales','taxAmount',c)]),reg('vat_purchases','taxBase'),reg('vat_purchases','taxAmount'),field('input_vat','Input VAT closing balance — reconciliation','category'),field('output_vat','Output VAT closing balance — reconciliation','category')]),
  make('2551Q','Quarterly percentage tax','percentage','quarterly',[field('sales','Recorded sales — reconciliation','category'),reg('percentage','taxBase'),reg('percentage','taxAmount')]),
  ...[['0619-E','Monthly expanded withholding remittance','monthly'],['1601-EQ','Quarterly expanded withholding return','quarterly'],['1604-E','Annual expanded withholding information','annual']].map(([c,n,f])=>make(c,n,'withholding',f as ReturnTemplate['frequency'],[reg('expanded_withholding','taxBase'),reg('expanded_withholding','taxAmount')])),
  ...[['0619-F','Monthly final withholding remittance','monthly'],['1601-FQ','Quarterly final withholding return','quarterly'],['1604-F','Annual final withholding information','annual']].map(([c,n,f])=>make(c,n,'withholding',f as ReturnTemplate['frequency'],[reg('final_withholding','taxBase'),reg('final_withholding','taxAmount')])),
  ...[['1601-C','Monthly compensation withholding','monthly'],['1604-C','Annual compensation withholding information','annual']].map(([c,n,f])=>make(c,n,'payroll',f as ReturnTemplate['frequency'],[field('salaries','Book payroll expense — reconciliation','category'),reg('payroll','taxBase'),reg('payroll','taxAmount')])),
]
export function validateTemplate(raw:unknown,books:MappingBooks):ReturnTemplate {
  const t=raw as ReturnTemplate
  if(!t||typeof t!=='object'||typeof t.code!=='string'||! /^[A-Za-z0-9_-]{2,30}$/.test(t.code)||!t.name?.trim()||t.name.length>180||!['income','vat','percentage','withholding','payroll','other'].includes(t.family)||!['monthly','quarterly','annual','transaction'].includes(t.frequency)||typeof t.edition!=='string'||!t.edition.trim()||t.edition.length>200)throw Error('Provide the return code, name, family, frequency and edition.')
  let url:URL;try{url=new URL(t.sourceUrl)}catch{throw Error('Link the official form or instructions using HTTPS.')}
  if(url.protocol!=='https:'||url.username||url.password||t.sourceUrl.length>2000)throw Error('Use a valid HTTPS source URL.')
  if(!Array.isArray(t.fields)||!t.fields.length||t.fields.length>100||!Array.isArray(t.requirements)||!t.requirements.length||t.requirements.length>20||t.requirements.some(s=>typeof s!=='string'||!s.trim()||s.length>500))throw Error('Provide 1–100 mapped fields and 1–20 review requirements.')
  if(new Set(t.requirements.map(s=>s.trim())).size!==t.requirements.length)throw Error('Each review requirement must be unique.')
  const seen=new Set<string>()
  const fields=t.fields.map(f=>{
    if(!f||typeof f.id!=='string'||! /^[A-Za-z0-9_-]{1,80}$/.test(f.id)||seen.has(f.id)||typeof f.label!=='string'||!f.label.trim()||f.label.length>200||typeof f.reference!=='string'||f.reference.length>200||!['category','accounts','register'].includes(f.source))throw Error('Each field needs a unique ID, label and valid source.')
    seen.add(f.id)
    if(!['net_debit','net_credit','debits','credits','closing_debit','closing_credit'].includes(f.basis)||!registerKinds.includes(f.kind)||!['taxBase','taxAmount'].includes(f.measure)||typeof f.classification!=='string'||f.classification.length>100)throw Error('Invalid field calculation.')
    if(f.source==='category'&&!taxCategories.some(c=>c[0]===f.category))throw Error('Select a valid accounting category.')
    if(!Array.isArray(f.accounts)||f.accounts.length>500||new Set(f.accounts).size!==f.accounts.length||f.accounts.some(c=>!books.accounts.some(a=>a.code===c))||(f.source==='accounts'&&!f.accounts.length))throw Error('Select existing accounts once per field.')
    return {id:f.id,label:f.label.trim(),reference:f.reference.trim(),source:f.source,category:f.category||'',accounts:f.accounts,basis:f.basis,kind:f.kind,measure:f.measure,classification:f.classification.trim()}
  })
  return {code:t.code.toUpperCase(),name:t.name.trim(),family:t.family,frequency:t.frequency,sourceUrl:url.href,edition:t.edition.trim(),fields,requirements:t.requirements.map(s=>s.trim())}
}
export function validateRegister(raw:unknown,books:MappingBooks):TaxRegister {
  const r=raw as TaxRegister
  if(!r||typeof r!=='object'||!registerKinds.includes(r.kind)||!validTaxDate(r.date))throw Error('Choose a tax register and a valid date.')
  const entry=books.entries.find(e=>e.id===r.entryId)
  if(!entry||entry.date!==r.date)throw Error('Link a posted journal entry with the same transaction date.')
  for(const key of ['partyId','partyName','tin','address','atc','classification','notes'] as const)if(typeof r[key]!=='string'||r[key].length>(key==='notes'?2000:500))throw Error('Invalid tax transaction details.')
  if(!r.classification.trim())throw Error('Enter the tax classification (for example VAT12 or the nature of payment).')
  if(['vat_sales','vat_purchases'].includes(r.kind)&&!['VAT12','VAT_ZERO','VAT_EXEMPT','NON_VAT'].includes(r.classification))throw Error('Use VAT12, VAT_ZERO, VAT_EXEMPT or NON_VAT for VAT records.')
  if((['expanded_withholding','final_withholding','payroll'].includes(r.kind))&&(!r.tin.replace(/\D/g,'')||!r.partyName.trim()||!r.atc.trim()))throw Error('Payee / employee name, TIN and ATC are required.')
  if(r.tin&&!/^(\d{9}|\d{12}|\d{14})$/.test(r.tin.replace(/[\s-]/g,'')))throw Error('Enter a valid 9-digit TIN, optionally including its branch code.')
  if([r.taxBase,r.taxAmount].some(v=>!Number.isSafeInteger(v)||Math.abs(v)>1e12))throw Error('Use valid tax amounts in centavos.')
  if((r.taxBase<0||r.taxAmount<0)&&!r.notes.trim())throw Error('Explain negative amounts or tax corrections.')
  if(typeof r.active!=='boolean')throw Error('Choose the record status.')
  return {id:typeof r.id==='string'?r.id:'',entryId:r.entryId,date:r.date,kind:r.kind,partyId:r.partyId,partyName:r.partyName.trim(),tin:r.tin.trim(),address:r.address.trim(),atc:r.atc.trim(),classification:r.classification.trim(),taxBase:r.taxBase,taxAmount:r.taxAmount,notes:r.notes.trim(),active:r.active}
}
/** Invoice records are already in the books. Manual VAT details replace, rather than duplicate, their source entry. Reversals carry signed values on the reversal date. */
export function effectiveTaxRegisters(books:MappingBooks,records:TaxRegister[]):TaxRegister[] {
  const active=records.filter(r=>r.active)
  const inferred:TaxRegister[]=[]
  for(const invoice of books.invoices||[]){
    const kind=invoice.kind==='receivable'?'vat_sales':'vat_purchases'
    if(active.some(r=>r.entryId===invoice.entryId&&r.kind===kind)||!invoice.taxTreatment)continue
    inferred.push({id:`invoice-${invoice.id}`,entryId:invoice.entryId,date:invoice.date,kind,partyId:'',partyName:invoice.party,tin:invoice.partyTin||'',address:invoice.partyAddress||'',atc:'',classification:invoice.taxTreatment,taxBase:invoice.netAmount??invoice.amount,taxAmount:invoice.vatAmount??0,notes:`From invoice ${invoice.reference}`,active:true})
  }
  const source=[...active,...inferred]
  const reversals=source.flatMap(r=>books.entries.filter(e=>e.reversalOf===r.entryId&&!active.some(a=>a.entryId===e.id&&a.kind===r.kind)).map(e=>({...r,id:`reversal-${e.id}-${r.id}`,entryId:e.id,date:e.date,taxBase:-r.taxBase,taxAmount:-r.taxAmount,notes:`Reversal of ${r.entryId}`})))
  return [...source,...reversals]
}
export function buildReturnWorkingPaper(books:MappingBooks,mappings:AccountTaxMapping[],template:ReturnTemplate,records:TaxRegister[],from:string,to:string,adjustments:TaxAdjustment[]=[],nilReasons:Record<string,string>={}) {
  if(!nilReasons||typeof nilReasons!=='object'||Array.isArray(nilReasons)||Object.keys(nilReasons).length>registerKinds.length||Object.entries(nilReasons).some(([key,value])=>!registerKinds.includes(key as RegisterKind)||typeof value!=='string'||value.length>1000))throw Error('Provide a short no-activity explanation for each relevant tax register.')
  const clean=validateTemplate(template,books),worksheet=buildTaxWorksheet(books,mappings,from,to,adjustments)
  if((Date.parse(to)-Date.parse(from))/86400000>366)throw Error('A return working paper can cover at most one tax year.')
  if(clean.frequency==='monthly'&&from.slice(0,7)!==to.slice(0,7))throw Error('A monthly return must cover dates within one reporting month.')
  if(clean.frequency==='quarterly'&&clean.family!=='income'&&(Date.parse(to)-Date.parse(from))/86400000>92)throw Error('A quarterly return must cover at most one reporting quarter. Income-tax working papers can use cumulative year-to-date figures.')
  const allRecords=effectiveTaxRegisters(books,records).filter(r=>r.date>=from&&r.date<=to)
  const relevantKinds=[...new Set(clean.fields.filter(f=>f.source==='register').map(f=>f.kind))]
  const registerRows=allRecords.filter(r=>relevantKinds.includes(r.kind))
  const blockers=worksheet.unmapped.map(a=>`Map account ${a}.`)
  for(const kind of relevantKinds)if(!registerRows.some(r=>r.kind===kind)&&!(typeof nilReasons[kind]==='string'&&nilReasons[kind].trim().length>=10&&nilReasons[kind].length<=1000))blockers.push(`Complete ${registerLabels[kind]} details, or document why there is no reportable activity.`)
  for(const r of registerRows)if(!r.partyName||!r.tin)blockers.push(`${r.notes||r.id}: payee / customer name and TIN need review.`)
  if(clean.family==='vat')for(const invoice of books.invoices||[])if(invoice.date>=from&&invoice.date<=to&&!invoice.taxTreatment&&!registerRows.some(r=>r.entryId===invoice.entryId&&r.kind===(invoice.kind==='receivable'?'vat_sales':'vat_purchases')))blockers.push(`Invoice ${invoice.reference}: classify its VAT treatment before review.`)
  const fields=clean.fields.map(f=>{
    const accounts=worksheet.sources.filter(s=>f.source==='category'?s.category===f.category:f.accounts.includes(s.account))
    const register=registerRows.filter(r=>r.kind===f.kind&&(!f.classification||r.classification===f.classification))
    const amount=f.source==='register'?register.reduce((n,r)=>n+r[f.measure],0):accounts.reduce((n,a)=>n+(f.source==='category'?a.amount:({net_debit:a.periodDebit-a.periodCredit,net_credit:a.periodCredit-a.periodDebit,debits:a.periodDebit,credits:a.periodCredit,closing_debit:a.closingBalance,closing_credit:-a.closingBalance}[f.basis])),0)
    if(!Number.isSafeInteger(amount))throw Error('A return total exceeds the supported amount range.')
    const missing=f.source==='register'&&!registerRows.some(r=>r.kind===f.kind)&&!(nilReasons[f.kind]?.trim().length>=10)
    return {...f,amount:missing?null:amount,accountCodes:f.source==='register'?[]:accounts.map(a=>a.account),entryIds:[...new Set(f.source==='register'?register.map(r=>r.entryId):accounts.flatMap(a=>f.source==='category'?a.entryIds:f.basis.startsWith('closing')?a.closingEntryIds:a.periodEntryIds))],registerIds:f.source==='register'?register.map(r=>r.id):[]}
  })
  return {worksheet,fields,registerRows,blockers:[...new Set(blockers)],nilReasons,template:clean,warnings:[...worksheet.warnings,'Tax bases and recorded taxes are accounting support, not an automatic determination of tax payable. Validate adjustments, credits, schedules and filing data.']}
}
