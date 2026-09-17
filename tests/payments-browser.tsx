import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { AccountingShell } from '../src/components/accounting/AccountingShell'
import { PaymentWorkspace } from '../src/components/accounting/PaymentWorkspace'
import { saveSettlementEvidence } from '../src/components/accounting/SettlementEvidence'
import { CompanyContext, type CompanyContextValue, type CompanyRole } from '../src/hooks/useCompany'
import { CompanyRecordsPreview } from '../src/hooks/useCompanyRecords'
import { DEFAULT_COMPANY_PROFILE } from '../src/lib/ph-compliance'
import { addInvoice, emptyBooks, outstanding, post, settle, type SettlementSupportingDocument } from '../src/lib/accounting'
import { type BankAccountRecord, type BankStatement } from '../src/lib/bank-workflow'
import { paymentClearance, type CompanyPaymentRequest, type PaymentRequest } from '../src/lib/payment-workflow'
import '../src/index.css'

if (!import.meta.env.DEV) throw Error('Development fixture only')
const stamp='2026-09-10T01:00:00Z',companyId='isolated-payments'
const bank:BankAccountRecord={id:'sample-bank',version:1,name:'Fictional operating account',bankName:'Sample Bank',accountSuffix:'1234',accountCode:'1010',currency:'PHP',active:true,createdBy:'sample-admin',createdAt:stamp,updatedBy:'sample-admin',updatedAt:stamp}
const evidence=await saveSettlementEvidence([{id:'fictional-check-image',kind:'check_copy',file:new File(['%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF'],'fictional-check.pdf',{type:'application/pdf'})}],companyId,true)
let initialBooks=post(emptyBooks(),{date:'2026-09-01',reference:'PAYMENT-DEMO-OPEN',description:'Fictional bank opening balance',source:'journal',lines:[{account:'1010',debit:5000000,credit:0},{account:'3000',debit:0,credit:5000000}]})
for(const [index,amount] of [112000,200000,300000].entries())initialBooks=addInvoice(initialBooks,{kind:'payable',party:`Fictional Supplier ${index+1}`,partyTin:'123456789',partyAddress:'Fictional sample address',reference:`DEMO-BILL-${index+1}`,date:'2026-09-01',due:'2026-09-30',amount,account:'5900',taxTreatment:'NON_VAT'})
const payments:PaymentRequest[]=initialBooks.invoices.map((bill,index)=>({id:`sample-payment-${index+1}`,version:index===0?1:index===1?2:3,status:index===0?'pending':index===1?'approved':'released',invoiceId:bill.id,bankId:bank.id,amount:bill.amount,plannedDate:'2026-09-10',method:index===0?'transfer':'check',checkNumber:index===0?'':`DEMO-CHECK-${index+1}`,reference:`DEMO-PAY-${index+1}`,notes:'Fictional supplier payment prepared for isolated interface verification.',supportingDocuments:index===0?[]:evidence,cashAccount:bank.accountCode,bankName:bank.bankName,accountSuffix:bank.accountSuffix,payee:bill.party,invoiceReference:bill.reference,createdBy:'sample-accountant',createdAt:stamp,updatedBy:index===0?'sample-accountant':'sample-manager',updatedAt:stamp,...(index>0?{approvedBy:'sample-manager',approvedAt:stamp,reviewNote:'Fictional independent review of the original bill and approved bank details.'}:{} )}))
initialBooks=settle(initialBooks,payments[2].invoiceId,payments[2].amount,'2026-09-10',bank.accountCode,payments[2].reference,evidence)
const releasedSettlement=initialBooks.settlements.at(-1)!,releasedEntry=initialBooks.entries.at(-1)!
payments[2]={...payments[2],releasedBy:'sample-admin',releasedAt:stamp,releaseDate:'2026-09-10',confirmationReference:'DEMO-CHECK-3-DELIVERED',settlementId:releasedSettlement.id,entryId:releasedEntry.id,cashLineId:`${releasedEntry.id}:${releasedEntry.lines.findIndex(line=>line.account===bank.accountCode)}`}
const statement:BankStatement={id:'sample-cleared-statement',bankId:bank.id,version:3,status:'approved',reference:'FICTIONAL-SEP-RECON',from:'2026-09-01',to:'2026-09-30',openingBalance:5000000,closingBalance:4700000,order:'ascending',openingReviewed:true,openingOutstandingLineIds:[],rows:[{id:'sample-cleared-row',date:'2026-09-11',description:'Fictional cleared check',reference:'DEMO-CHECK-3',amount:-300000,balance:4700000,source:{format:'csv',fileName:'fictional-cleared.csv',row:2},issues:[],raw:{amount:'-3000.00'}}],allocations:[{bankRowId:'sample-cleared-row',bookLineId:payments[2].cashLineId!,amount:300000}],file:{path:`companies/${companyId}/bank-statements/sample-cleared`,name:'fictional-cleared.csv',size:100,type:'text/csv',sha256:'c'.repeat(64)},importedRowIds:['sample-cleared-row'],createdBy:'sample-accountant',createdAt:stamp,updatedBy:'sample-manager',updatedAt:stamp,preparedBy:'sample-accountant',preparedAt:stamp,approvedBy:'sample-manager',approvedAt:stamp}
type History=PaymentRequest&{requestId:string;changeAction:string}
function App(){
 const [role,setRole]=useState<CompanyRole>('admin'),[books,setBooks]=useState(initialBooks),[revision,setRevision]=useState(5),[requests,setRequests]=useState(payments),[history,setHistory]=useState<History[]>(payments.map(row=>({...row,requestId:row.id,changeAction:'fictional_seed'}))),[bankApproved,setBankApproved]=useState(true)
 const statements=[{...statement,status:bankApproved?'approved' as const:'draft' as const}],membership={uid:`sample-${role}`,email:`${role}@example.test`,displayName:`Sample ${role}`,companyId,companyCode:'PH-PAY-DEMO',role,active:true}
 const save=(payment:PaymentRequest,action:string)=>{setRequests(old=>[...old.filter(row=>row.id!==payment.id),payment]);setHistory(old=>[...old,{...payment,requestId:payment.id,changeAction:action}])}
 const union=(before:SettlementSupportingDocument[],after:SettlementSupportingDocument[])=>{const result=[...new Map([...before,...after].map(row=>[row.path,row])).values()];if(result.length>10)throw Error('Maximum 10 documents.');return result}
 const invoke:CompanyContextValue['invoke']=async(name,data)=>{
  if(name!=='companyPayments'||role==='viewer')throw Error('This fictional page only enables authorized payment-interface actions.')
  const request=data as CompanyPaymentRequest,isManager=['admin','manager'].includes(role)
  if(request.action==='prepare'){
   const prior=requests.find(row=>row.id===request.requestId);if(prior)return {id:prior.id} as never
   const bill=books.invoices.find(row=>row.id===request.input.invoiceId),reserved=requests.filter(row=>row.invoiceId===bill?.id&&['pending','approved'].includes(row.status)).reduce((sum,row)=>sum+row.amount,0)
   if(!bill||request.input.amount>outstanding(books,bill)-reserved)throw Error('Insufficient unreserved supplier balance.')
   const value:PaymentRequest={...request.input,id:request.requestId,version:1,status:'pending',cashAccount:bank.accountCode,bankName:bank.bankName,accountSuffix:bank.accountSuffix,payee:bill.party,invoiceReference:bill.reference,createdBy:membership.uid,createdAt:new Date().toISOString(),updatedBy:membership.uid,updatedAt:new Date().toISOString()};save(value,'prepare');return {id:value.id} as never
  }
  const current=requests.find(row=>row.id===request.id);if(!current)throw Error('Payment preview missing.')
  if(request.action==='getClearance')return paymentClearance(current,books,statements) as never
  if(request.expectedVersion!==current.version)throw Error('The fictional request changed. Reopen the action.')
  let value:PaymentRequest={...current,version:current.version+1,updatedBy:membership.uid,updatedAt:new Date().toISOString(),reviewNote:request.note}
  if(request.action==='approve'){if(!isManager||current.createdBy===membership.uid)throw Error('Use a different Admin or Manager for independent approval.');value={...value,status:'approved',approvedBy:membership.uid,approvedAt:new Date().toISOString()}}
  else if(request.action==='cancel'||request.action==='reject'){if(!isManager&&!(request.action==='cancel'&&current.status==='pending'&&current.createdBy===membership.uid))throw Error('Reviewer access is required.');value.status=request.action==='cancel'?'cancelled':'rejected'}
  else if(request.action==='release'){
   if(!isManager||current.status!=='approved'||request.expectedBooksRevision!==revision)throw Error('Load the current independently approved payment and books.')
   const documents=union(current.supportingDocuments,request.supportingDocuments);if(!documents.some(row=>row.kind===(current.method==='check'?'check_copy':'transfer_confirmation')))throw Error('Attach the required release evidence.')
   const next=settle(books,current.invoiceId,current.amount,request.releaseDate,current.cashAccount,current.reference,documents),entry=next.entries.at(-1)!,settlement=next.settlements.at(-1)!
   setBooks(next);setRevision(revision+1);value={...value,status:'released',supportingDocuments:documents,releasedBy:membership.uid,releasedAt:new Date().toISOString(),releaseDate:request.releaseDate,confirmationReference:request.confirmationReference,entryId:entry.id,settlementId:settlement.id,cashLineId:`${entry.id}:${entry.lines.findIndex(line=>line.account===current.cashAccount)}`}
  }else if(request.action==='attachDocuments')value.supportingDocuments=union(current.supportingDocuments,request.supportingDocuments)
  save(value,request.action);return {id:value.id,status:value.status,version:value.version} as never
 }
 const context:CompanyContextValue={membership,company:{companyCode:membership.companyCode,profile:{...DEFAULT_COMPANY_PROFILE,registeredName:'Fictional Payment Preview Company'}},books,revision,members:[],approvals:[],audit:[],loading:false,busy:false,error:'',booksReady:true,invoke,command:async()=>{throw Error('Use the isolated payment flow. No production posting occurs.')}}
 return <CompanyContext.Provider value={context}><CompanyRecordsPreview.Provider value={{paymentRequests:requests,paymentRequestVersions:history,bankAccounts:[bank],bankStatements:statements}}><div className="flex flex-wrap items-center gap-3 bg-amber-50 px-5 py-3 text-sm text-amber-900"><b>Payment interface preview</b><span>Fictional local state · no production calls · backend behavior tested separately</span><label><input type="checkbox" checked={bankApproved} onChange={event=>setBankApproved(event.target.checked)}/> Fictional bank reconciliation approved</label><label className="ml-auto">Preview role <select aria-label="Preview role" value={role} onChange={event=>setRole(event.target.value as CompanyRole)}>{(['admin','manager','accountant','viewer'] as const).map(value=><option key={value}>{value}</option>)}</select></label></div><HashRouter><AccountingShell userName={membership.displayName}><PaymentWorkspace/></AccountingShell></HashRouter></CompanyRecordsPreview.Provider></CompanyContext.Provider>
}
const root=import.meta.hot?.data.root??createRoot(document.getElementById('test-root')!);if(import.meta.hot)import.meta.hot.data.root=root;root.render(<App/> )
