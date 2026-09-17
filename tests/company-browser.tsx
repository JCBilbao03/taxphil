import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { AccountingWorkspace } from '../src/pages/AccountingPage'
import { AccountingShell } from '../src/components/accounting/AccountingShell'
import { CompanyGate } from '../src/components/accounting/CompanySetup'
import { CompanyContext, roleLabel, type CompanyRole, type CompanyContextValue, type CompanyMembership } from '../src/hooks/useCompany'
import { DEFAULT_COMPANY_PROFILE } from '../src/lib/ph-compliance'
import { addAccount, addInvoice, closePeriod, emptyBooks, post, reverse, settle, type Books, type Invoice } from '../src/lib/accounting'
import '../src/index.css'

if (!import.meta.env.DEV) throw Error('Development fixture only')
const profile = { ...DEFAULT_COMPANY_PROFILE, registeredName: 'Mabuhay Trading, Inc.', tin: '123-456-789', rdo: '047', registeredAddress: 'Sample address, Makati City, Philippines', businessNature: 'General trading', vatStatus: 'vat' as const, secRegistrationNumber: 'DEMO-SEC-2026', invoiceSeries: 'DEMO-INV', withholdingAgent: true, hasEmployees: true }
const people: CompanyMembership[] = [
  { uid:'demo-admin', displayName:'Alex Santos', email:'admin@example.test', companyId:'demo', companyCode:'PH-DEMO001', role:'admin', active:true },
  { uid:'demo-manager', displayName:'Jamie Reyes', email:'manager@example.test', companyId:'demo', companyCode:'PH-DEMO001', role:'manager', active:true },
  { uid:'demo-accountant', displayName:'Sam Cruz', email:'accountant@example.test', companyId:'demo', companyCode:'PH-DEMO001', role:'accountant', active:true },
  { uid:'demo-viewer', displayName:'Casey Lim', email:'viewer@example.test', companyId:'demo', companyCode:'PH-DEMO001', role:'viewer', active:true },
]
function seed() {
  let b = post(emptyBooks(), { date:'2026-04-01', reference:'OPEN-2026', description:'Sample opening capital', source:'journal', lines:[{account:'1010',debit:85000000,credit:0},{account:'3000',debit:0,credit:85000000}] })
  const income = [18200000,21600000,26400000,24500000,32700000,28900000]
  income.forEach((amount, index) => {
    const month = String(index + 4).padStart(2,'0'), date=`2026-${month}-02`
    b=addInvoice(b,{kind:'receivable',party:['Northstar Retail','Isla Digital','Harbor Supply'][index%3],reference:`DEMO-INV-00${index+1}`,date,due:`2026-${month}-15`,amount,account:'4000',taxTreatment:'VAT12',description:'Sample trading services',partyTin:'987-654-321',partyAddress:'Sample client address'})
    const invoice=b.invoices.at(-1)!
    if(index<5) b=settle(b,invoice.id,amount,`2026-${month}-12`,'1010',`DEMO-REC-00${index+1}`)
    b=addInvoice(b,{kind:'payable',party:['Metro Office Supply','Pacific Logistics'][index%2],reference:`DEMO-BILL-00${index+1}`,date,due:`2026-${month}-22`,amount:Math.round(amount*.59),account:'5000',taxTreatment:'VAT12'})
    const bill=b.invoices.at(-1)!
    if(index<5) b=settle(b,bill.id,bill.amount,`2026-${month}-20`,'1010',`DEMO-PAY-00${index+1}`)
  })
  return b
}
function apply(b:Books,c:Record<string,unknown>) {
  const i=(c.input || c) as any
  if(c.type==='post')return post(b,{...i,source:'journal'})
  if(c.type==='addInvoice')return addInvoice(b,i as Omit<Invoice,'id'|'entryId'>)
  if(c.type==='settle')return settle(b,i.invoiceId,i.amount,i.date,i.cash,i.reference)
  if(c.type==='reverse')return reverse(b,i.entryId,i.date)
  if(c.type==='addAccount')return addAccount(b,i)
  if(c.type==='closePeriod')return closePeriod(b,i.date)
  throw Error('Unsupported preview action')
}
function Preview() {
  const [role,setRole]=useState<CompanyRole>('admin'), [books,setBooks]=useState(seed), [company,setCompany]=useState({companyCode:'PH-DEMO001',profile}), [members,setMembers]=useState(people)
  const [revision,setRevision]=useState(0),[approvals,setApprovals]=useState<any[]>([]),[audit,setAudit]=useState<any[]>([{id:'sample-created',createdAt:'2026-09-17T01:30:00Z',action:'company_created',actorEmail:'admin@example.test',summary:'Sample company workspace created'}])
  const membership=members.find(m=>m.role===role) || people.find(m=>m.role===role)!
  function log(action:string,summary:string){setAudit(a=>[{id:crypto.randomUUID(),createdAt:new Date().toISOString(),action,actorEmail:membership.email,summary},...a])}
  const command:CompanyContextValue['command']=async c=>{
    if(role==='viewer')throw Error('Viewer access is read-only.')
    if(role==='accountant'&&!['post','addInvoice'].includes(String(c.type)))throw Error('An Accounting Manager or Admin must perform this action.')
    if(role==='accountant'){
      apply(books,c)
      const id=crypto.randomUUID();setApprovals(a=>[{id,command:c,status:'pending',createdAt:new Date().toISOString(),preparedBy:membership.uid,preparedByEmail:membership.email},...a]);setRevision(r=>r+1);log('prepared',`Prepared ${c.type}`)
      return {revision:revision+1,status:'pending',pendingId:id}
    }
    if(c.type==='approve'||c.type==='reject'){
      const pending=approvals.find(a=>a.id===c.pendingId && a.status==='pending')
      if(!pending)throw Error('Submission no longer pending.')
      if(pending.preparedBy===membership.uid)throw Error('Another authorized reviewer must review this submission.')
      if(c.type==='approve')setBooks(apply(books,pending.command))
      setApprovals(a=>a.map(item=>item.id===pending.id?{...item,status:c.type==='approve'?'approved':'rejected',reason:c.reason}:item))
    }else setBooks(apply(books,c))
    setRevision(r=>r+1);log(String(c.type),`Preview ${c.type} completed`)
    return {revision:revision+1,status:c.type==='approve'?'approved':c.type==='reject'?'rejected':'posted'}
  }
  const invoke:CompanyContextValue['invoke']=async(name,data)=>{
    if(role!=='admin')throw Error('Only Company Admins may manage the company.')
    if(name==='companyInvite'){log('invitation_created',`Preview invitation for ${data.email}`);return {companyCode:'PH-DEMO001',inviteCode:'DEMO-NOT-A-REAL-INVITATION',expiresAt:new Date(Date.now()+86400000).toISOString()} as any}
    if(name==='companySetMemberRole'){setMembers(m=>m.map(row=>row.uid===data.uid?{...row,role:data.role as CompanyRole,active:data.active as boolean}:row));log('member_updated','Preview membership updated');return {} as any}
    if(name==='companyUpdateProfile'){setCompany(c=>({...c,profile:data.profile as typeof profile}));log('profile_updated','Preview company profile updated');return {} as any}
    throw Error('This action is only available with the live company service.')
  }
  const value:CompanyContextValue={membership,company,books,revision,members,approvals,audit,loading:false,busy:false,error:'',booksReady:true,invoke,command}
  return <CompanyContext.Provider value={value}><div style={{padding:'9px 20px',background:'#fff3d4',color:'#715315',fontSize:13,display:'flex',gap:15,alignItems:'center',flexWrap:'wrap'}}><strong>Sample workspace</strong><span>Fictional data · changes last until refresh · no live filings or invitations</span><label style={{marginLeft:'auto'}}>Preview role <select aria-label="Preview role" value={role} onChange={e=>setRole(e.target.value as CompanyRole)} style={{marginLeft:8,border:'1px solid #dcc68f',borderRadius:4,padding:4}}>{(['admin','manager','accountant','viewer'] as CompanyRole[]).map(r=><option key={r} value={r}>{roleLabel(r)}</option>)}</select></label></div><HashRouter><AccountingShell userName={membership.displayName}><Routes><Route path="*" element={<AccountingWorkspace uid="isolated-company-preview" />} /><Route path="/accounting/:module" element={<AccountingWorkspace uid="isolated-company-preview" />} /><Route path="/setup" element={<CompanyContext.Provider value={{...value,membership:null,company:null}}><CompanyGate>Setup complete</CompanyGate></CompanyContext.Provider>} /></Routes></AccountingShell></HashRouter></CompanyContext.Provider>
}
const previewRoot = import.meta.hot?.data.root ?? createRoot(document.getElementById('test-root')!)
if (import.meta.hot) import.meta.hot.data.root = previewRoot
previewRoot.render(<Preview />)
