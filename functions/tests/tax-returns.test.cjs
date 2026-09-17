const {test}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs'),path=require('node:path')
const {emptyBooks,addInvoice,reverse,post}=require('../lib/accounting-engine.js')
const {buildTaxWorksheet,suggestedMapping,validateMappings,wholePesos,taxAmount}=require('../lib/tax-mapping.js')
const {defaultReturnTemplates,buildReturnWorkingPaper,effectiveTaxRegisters,validateTemplate,validateRegister}=require('../lib/tax-returns.js')
const map=books=>books.accounts.map(a=>({account:a.code,category:suggestedMapping(a)|| (a.type==='Expense'?'other_expenses':'excluded'),note:'Reviewed test mapping'}))
const invoice=(books,extra={})=>addInvoice(books,{kind:'receivable',party:'Test Customer',partyTin:'123-456-789-00000',partyAddress:'Makati',reference:'INV-01',date:'2026-01-10',due:'2026-01-30',amount:11200,account:'4000',taxTreatment:'VAT12',...extra})
const get=c=>structuredClone(defaultReturnTemplates.find(t=>t.code===c))
test('all built-in return families use the same accounting bridge; custom returns accept selected accounts',()=>{
 const b=invoice(emptyBooks()),m=map(b)
 for(const t of defaultReturnTemplates){const p=buildReturnWorkingPaper(b,m,t,[],'2026-01-01',t.frequency==='monthly'?'2026-01-31':t.frequency==='quarterly'?'2026-03-31':'2026-12-31');assert.equal(p.template.code,t.code);assert.ok(p.fields.length)}
 const t=get('1701');t.code='2000-OT';t.family='other';t.name='Reviewed additional return';t.fields=[{...t.fields[0],source:'accounts',accounts:['4000'],basis:'net_credit'}]
 const p=buildReturnWorkingPaper(b,m,t,[],'2026-01-01','2026-01-31');assert.equal(p.fields[0].amount,10000);assert.deepEqual(p.fields[0].entryIds,[b.entries[0].id])
})
test('book period, normal signs and closing balances include the correct source references',()=>{
 let b=post(emptyBooks(),{date:'2025-12-01',reference:'OPEN',description:'Opening',source:'journal',lines:[{account:'1000',debit:10000,credit:0},{account:'3000',debit:0,credit:10000}]})
 b=invoice(b);const w=buildTaxWorksheet(b,map(b),'2026-01-01','2026-01-31')
 assert.equal(w.totals.sales,10000);assert.equal(w.totals.output_vat,1200)
 const cash=w.sources.find(s=>s.account==='1000');assert.equal(cash.amount,10000);assert.deepEqual(cash.entryIds,[b.entries[0].id]);assert.equal(cash.periodEntryIds.length,0)
})
test('VAT is taken from invoices automatically; explicit detail replaces a matching source rather than duplicating',()=>{
 const b=invoice(emptyBooks()),i=b.invoices[0],m=map(b),t=get('2550Q')
 const p=buildReturnWorkingPaper(b,m,t,[],'2026-01-01','2026-03-31');assert.equal(p.fields.find(f=>f.id==='vat_sales_taxAmount_VAT12').amount,1200)
 const manual={...p.registerRows[0],id:'manual',taxBase:9000,taxAmount:1080}
 const overridden=buildReturnWorkingPaper(b,m,t,[manual],'2026-01-01','2026-03-31')
 assert.equal(overridden.registerRows.length,1);assert.equal(overridden.registerRows[0].entryId,i.entryId);assert.equal(overridden.fields.find(f=>f.id==='vat_sales_taxAmount_VAT12').amount,1080)
})
test('reversal tax details follow their posting period and preserve signed corrections',()=>{
 let b=invoice(emptyBooks());b=reverse(b,b.entries[0].id,'2026-02-01')
 const january=buildReturnWorkingPaper(b,map(b),get('2550Q'),[],'2026-01-01','2026-01-31')
 const february=buildReturnWorkingPaper(b,map(b),get('2550Q'),[],'2026-02-01','2026-02-28')
 const quarter=buildReturnWorkingPaper(b,map(b),get('2550Q'),[],'2026-01-01','2026-03-31')
 assert.equal(january.fields[0].amount,10000);assert.equal(february.fields[0].amount,-10000);assert.equal(quarter.fields[0].amount,0)
 assert.equal(effectiveTaxRegisters(b,[]).length,2)
})
test('missing registers are null, not silently zero; no-activity reasons and absent TINs remain explicit',()=>{
 const b=emptyBooks(),t=get('1601-EQ')
 const missing=buildReturnWorkingPaper(b,map(b),t,[],'2026-01-01','2026-03-31');assert.equal(missing.fields[0].amount,null);assert.ok(missing.blockers.length)
 const nil=buildReturnWorkingPaper(b,map(b),t,[],'2026-01-01','2026-03-31',[],{expanded_withholding:'No payments subject to withholding during this quarter.'});assert.equal(nil.fields[0].amount,0);assert.equal(nil.blockers.length,0)
 const b2=invoice(b,{partyTin:''});assert.ok(buildReturnWorkingPaper(b2,map(b2),get('2550Q'),[],'2026-01-01','2026-03-31').blockers.some(x=>x.includes('TIN')))
})
test('account mappings reject duplicates, wrong account types and unexplained exclusions',()=>{
 const b=invoice(emptyBooks())
 assert.throws(()=>validateMappings([{account:'4000',category:'assets',note:''}],b.accounts))
 assert.throws(()=>validateMappings([{account:'4000',category:'excluded',note:''}],b.accounts))
 assert.throws(()=>validateMappings([map(b)[0],map(b)[0]],b.accounts))
 const p=buildReturnWorkingPaper(b,[],get('1702-RT'),[],'2026-01-01','2026-12-31');assert.ok(p.blockers.some(x=>x.includes('4000')))
})
test('templates and register records cannot select foreign accounts, arbitrary URLs or unposted entries',()=>{
 const b=invoice(emptyBooks()),t=get('1701');t.sourceUrl='javascript:alert(1)';assert.throws(()=>validateTemplate(t,b))
 t.sourceUrl='https://www.bir.gov.ph/bir-forms';t.fields[0].source='accounts';t.fields[0].accounts=['FOREIGN'];assert.throws(()=>validateTemplate(t,b))
 const r={...effectiveTaxRegisters(b,[])[0],entryId:'missing'};assert.throws(()=>validateRegister(r,b))
 r.entryId=b.entries[0].id;r.date='2026-02-01';assert.throws(()=>validateRegister(r,b))
})
test('dates, unsafe values, tax adjustments and whole-peso half-up rounding are checked',()=>{
 const b=invoice(emptyBooks()),m=map(b)
 assert.throws(()=>buildTaxWorksheet(b,m,'2026-02-30','2026-12-31'))
 assert.throws(()=>buildTaxWorksheet(b,m,'2026-01-01','2026-12-31',[{label:'',amount:100}]))
 assert.equal(wholePesos(149),1);assert.equal(wholePesos(150),2);assert.equal(wholePesos(-150),-2)
 const w=buildTaxWorksheet(b,m,'2026-01-01','2026-12-31',[{label:'Reviewed adjustment',amount:-1000}]);assert.equal(w.adjustmentTotal,-1000)
 assert.throws(()=>buildReturnWorkingPaper(b,m,get('1701'),[],'2026-01-01','2026-12-31',[],{bad:'unsafe'}))
})
test('shared tax and compliance definitions are identical between browser and server',()=>{
 for(const file of ['tax-mapping.ts','tax-returns.ts','compliance-records.ts'])assert.equal(fs.readFileSync(path.join(__dirname,'../../src/lib',file),'utf8'),fs.readFileSync(path.join(__dirname,'../src',file),'utf8'))
})

test('tax amount inputs allow zero and signed corrections without floating-point rounding',()=>{assert.equal(taxAmount('0'),0);assert.equal(taxAmount('-0.50'),-50);assert.equal(taxAmount('100.10'),10010);assert.throws(()=>taxAmount('1.005'));assert.throws(()=>taxAmount('1e6'))})

test('legacy invoices can clear VAT classification using linked tax details; duplicate requirements and overlong periods fail',()=>{const b=invoice(emptyBooks()),record=effectiveTaxRegisters(b,[])[0];delete b.invoices[0].taxTreatment;const p=buildReturnWorkingPaper(b,map(b),get('2550Q'),[{...record,id:'manual'}],'2026-01-01','2026-03-31');assert.ok(!p.blockers.some(s=>s.includes('classify')));const t=get('1701');t.requirements.push(t.requirements[0]);assert.throws(()=>validateTemplate(t,b));assert.throws(()=>buildReturnWorkingPaper(b,map(b),get('2550Q'),[],'2026-01-01','2026-12-31'));assert.throws(()=>buildReturnWorkingPaper(b,map(b),get('1601-C'),[],'2026-01-01','2026-02-15'))})

test('recorded filing acknowledgments cannot be dated in the future',()=>{const {validateComplianceTask}=require('../lib/compliance-records.js');const task={title:'Test filing',agency:'BIR',period:'2026',sourceUrl:'',assignedTo:'',dueDate:'',status:'filed',notes:'',filingDate:'2999-12-31',filingReference:'ACK-1',evidenceUrl:'https://example.test/ack',attachments:[]};assert.throws(()=>validateComplianceTask(task,'company'),/future/);assert.equal(validateComplianceTask({...task,filingDate:'2026-01-01'},'company').status,'filed')})
