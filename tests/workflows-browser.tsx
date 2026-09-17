import {useState} from 'react'
import {createRoot} from 'react-dom/client'
import {HashRouter,Routes,Route} from 'react-router-dom'
import {AccountingWorkspace} from '../src/pages/AccountingPage'
import {AccountingShell} from '../src/components/accounting/AccountingShell'
import {CompanyContext,type CompanyContextValue,type CompanyRole} from '../src/hooks/useCompany'
import {CompanyRecordsPreview} from '../src/hooks/useCompanyRecords'
import {DEFAULT_COMPANY_PROFILE} from '../src/lib/ph-compliance'
import {emptyBooks,addInvoice,post,settle,appendSettlementDocuments} from '../src/lib/accounting'
import {suggestedMapping,validateMappings} from '../src/lib/tax-mapping'
import {defaultReturnTemplates,buildReturnWorkingPaper,validateTemplate,validateRegister} from '../src/lib/tax-returns'
import {validateParty} from '../src/lib/parties'
import {validateEmployee} from '../src/lib/payroll'
import '../src/index.css'
if(!import.meta.env.DEV)throw Error('Development fixture only')
const profile={...DEFAULT_COMPANY_PROFILE,registeredName:'Mabuhay Trading, Inc.',tin:'123-456-789',registeredAddress:'Sample address, Makati',vatStatus:'vat' as const,hasEmployees:true,withholdingAgent:true}
let initialBooks=post(emptyBooks(),{date:'2026-01-01',reference:'OPEN',description:'Sample capital',source:'journal',lines:[{account:'1000',debit:5000000,credit:0},{account:'3000',debit:0,credit:5000000}]})
initialBooks=addInvoice(initialBooks,{kind:'receivable',party:'Northstar Retail',partyTin:'987-654-321-00000',partyAddress:'Sample client address',partyId:'customer1',reference:'DEMO-INV-001',date:'2026-09-02',due:'2026-09-30',amount:1120000,account:'4000',taxTreatment:'VAT12'})
initialBooks=addInvoice(initialBooks,{kind:'payable',party:'Metro Office Supply',partyTin:'321-654-987-00000',partyAddress:'Sample supplier address',partyId:'vendor1',reference:'DEMO-BILL-001',date:'2026-09-04',due:'2026-09-30',amount:224000,account:'5000',taxTreatment:'VAT12'})
const employee=validateEmployee({code:'EMP-001',fullName:'Sample Employee',tin:'123456780',sssNumber:'',philhealthNumber:'',pagibigNumber:'',address:'Sample address',compensationAtc:'WC010',jobTitle:'Accountant',department:'Finance',startDate:'2026-01-01',endDate:'',active:true,payFrequency:'monthly',basicPay:3000000,notes:'Fictional preview record'},'employee1',1)
function App(){
 const [books,setBooks]=useState(initialBooks)
 const [role,setRole]=useState<CompanyRole>('admin')
 const [records,setRecords]=useState<Record<string,any[]>>({taxMappings:[{id:'default',version:1,mappings:books.accounts.map(a=>({account:a.code,category:suggestedMapping(a)||'other_expenses',note:'Reviewed sample'}))}],taxRegisters:[{id:'default',version:1,records:[]}],taxTemplates:[],taxDrafts:[],employees:[{id:'default',revision:1,employees:[employee]}],payrollRuns:[],regulations:[],complianceTasks:[],parties:[{id:'vendor1',version:1,...validateParty({kind:'vendor',registeredName:'Metro Office Supply',tin:'321654987',address:'Sample supplier address',email:'vendor@example.test',defaultAtc:'',notes:'Fictional record',active:true})},{id:'customer1',version:1,...validateParty({kind:'customer',registeredName:'Northstar Retail',tin:'987654321',address:'Sample client address',email:'customer@example.test',defaultAtc:'',notes:'Fictional record',active:true})}]})
 const membership={uid:`demo-${role}`,email:`${role}@example.test`,displayName:`Sample ${role}`,companyId:'isolated-workflows',companyCode:'PH-DEMO002',role,active:true}
 const save=(name:string,id:string,value:unknown)=>setRecords(old=>({...old,[name]:[...old[name]?.filter(r=>r.id!==id)||[],{...(value as object),id}]}))
 const invoke:CompanyContextValue['invoke']=async(name,data)=>{
  if(role==='viewer')throw Error('Viewer access is read-only.')
  if(name==='companyTaxMappingSave'){const version=Number(data.expectedVersion)+1,mappings=validateMappings(data.mappings,books.accounts);save('taxMappings','default',{version,mappings});return {version} as any}
  if(name==='companyTaxTemplateSave'){const template=validateTemplate(data.template,books),version=Number(data.expectedVersion)+1;save('taxTemplates',template.code,{template,version});return {version} as any}
  if(name==='companyTaxDraftCreate'){const template=records.taxTemplates.find(t=>t.template.code===data.form)?.template||defaultReturnTemplates.find(t=>t.code===data.form),id=crypto.randomUUID();const paper=buildReturnWorkingPaper(books,records.taxMappings[0].mappings,template,records.taxRegisters[0].records,String(data.from),String(data.to),[],data.nilReasons as any);const value={id,...paper,form:data.form,from:data.from,to:data.to,status:'draft',booksRevision:1,mappingVersion:records.taxMappings[0].version,templateVersion:0,registerVersion:records.taxRegisters[0].version,createdAt:new Date().toISOString(),createdBy:membership.uid,version:1};save('taxDrafts',id,value);return value as any}
  if(name==='companyTaxDraftReview'){const d=records.taxDrafts.find(r=>r.id===data.id);if(d.createdBy===membership.uid)throw Error('Another Admin or Manager must review this working paper.');if(d.blockers.length)throw Error('Resolve the missing details first.');save('taxDrafts',d.id,{...d,status:'reviewed',reviewNote:data.note});return {status:'reviewed'} as any}
  if(name==='companyPartySave'){const id=String(data.id||crypto.randomUUID()),value={...validateParty(data.value),version:Number(data.expectedVersion)+1};save('parties',id,value);return {id,version:value.version} as any}
  if(name==='companyTaxRegisterSave'){const r=validateRegister(data.record,books);r.id=String(data.id||crypto.randomUUID());save('taxRegisters','default',{version:Number(data.expectedVersion)+1,records:[...records.taxRegisters[0].records.filter((x:any)=>x.id!==r.id),r]});return {id:r.id} as any}
  if(name==='companyWorkflowSave'){const id=String(data.id||crypto.randomUUID());save(String(data.collection),id,{...data.value as object,version:Number(data.expectedVersion)+1,createdBy:membership.uid,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});return {id} as any}
  if(name==='companyPayroll'&&data.action==='saveEmployee'){const id=String(data.employeeId||crypto.randomUUID()),old=records.employees[0];const e=validateEmployee(data.input,id,1);save('employees','default',{revision:old.revision+1,employees:[...old.employees.filter((e:any)=>e.id!==id),e]});return {id} as any}
  throw Error('This isolated preview does not call production services. Handler behavior is checked separately.')
 }
 const value:CompanyContextValue={membership,company:{companyCode:membership.companyCode,profile},books,revision:1,members:['admin','manager','accountant','viewer'].map(r=>({...membership,uid:`demo-${r}`,role:r as CompanyRole,displayName:`Sample ${r}`})),approvals:[],audit:[],loading:false,busy:false,error:'',booksReady:true,invoke,command:async(command)=>{
  if(!['admin','manager'].includes(role))throw Error('Use an Admin or Manager for posting in this isolated preview. Production approval is validated by separate handler tests.')
  await new Promise(resolve=>setTimeout(resolve,1000))
  if(command.type==='addInvoice'){setBooks(current=>addInvoice(current,command.input as any));return {status:'posted'}}
  if(command.type==='attachSettlementDocuments'){const input=command.input as any;setBooks(current=>appendSettlementDocuments(current,input.settlementId,input.supportingDocuments));return {status:'posted'}}
  if(command.type==='settle'){const input=command.input as any;setBooks(current=>settle(current,input.invoiceId,input.amount,input.date,input.cash,input.reference,input.supportingDocuments));return {status:'posted'}}
  throw Error('This isolated preview does not call production services.')
 }}
 return <CompanyContext.Provider value={value}><CompanyRecordsPreview.Provider value={records}><div className="flex flex-wrap items-center gap-3 bg-amber-50 px-5 py-3 text-sm text-amber-900"><b>Connected workflows preview</b><span>Fictional records · local changes only · resets on refresh</span><label className="ml-auto">Preview role <select value={role} onChange={e=>setRole(e.target.value as CompanyRole)}>{['admin','manager','accountant','viewer'].map(r=><option key={r}>{r}</option>)}</select></label></div><HashRouter><AccountingShell userName={membership.displayName}><Routes><Route path="/accounting/:module" element={<AccountingWorkspace uid="isolated-workflows"/>}/><Route path="*" element={<AccountingWorkspace uid="isolated-workflows"/>}/></Routes></AccountingShell></HashRouter></CompanyRecordsPreview.Provider></CompanyContext.Provider>
}
const root=import.meta.hot?.data.root??createRoot(document.getElementById('test-root')!);if(import.meta.hot)import.meta.hot.data.root=root;root.render(<App/> )
