import test from 'node:test'
import assert from 'node:assert/strict'
import { addInvoice, emptyBooks, balances, parseBooks, reverse, settle, today } from '../src/lib/accounting.ts'
import { calculateInvoiceTax } from '../src/lib/ph-compliance.ts'
const sale = (amount:number) => ({kind:'receivable' as const,party:'Sample customer',reference:'VAT-001',date:'2026-01-02',due:'2026-02-02',amount,account:'4000',taxTreatment:'VAT12' as const})
test('VAT postings match exact inclusive tax calculator at half-cent boundaries', () => {
  for(const amount of [1,14,42,126,10010,112000,999999999999]) {
    const b=addInvoice(emptyBooks(),sale(amount)), invoice=b.invoices[0]
    const expected=calculateInvoiceTax(amount,'VAT12',true)
    assert.equal(invoice.netAmount,expected.netCentavos)
    assert.equal(invoice.vatAmount,expected.vatCentavos)
    assert.equal(invoice.amount,expected.grossCentavos)
    assert.equal(b.entries[0].lines.reduce((sum,line)=>sum+line.debit-line.credit,0),0)
    assert.deepEqual(parseBooks(JSON.stringify(b)),b)
  }
})
test('VAT goes to tax accounts and not profit; settlement and reversal preserve the trail',()=>{
  let b=addInvoice(emptyBooks(),sale(112000))
  assert.equal(balances(b).find(a=>a.code==='4000')!.net,-100000)
  assert.equal(balances(b).find(a=>a.code==='2110')!.net,-12000)
  b=settle(b,b.invoices[0].id,112000,'2026-01-03','1010','REC-1')
  b=reverse(b,b.settlements[0].entryId,'2026-01-04')
  b=reverse(b,b.invoices[0].entryId,'2026-01-04')
  assert.ok(balances(b).every(account=>account.net===0))
  assert.equal(b.entries.length,4)
})
test('VAT bill separates purchase expense from input VAT',()=>{
  const b=addInvoice(emptyBooks(),{...sale(112000),kind:'payable',account:'5900'})
  assert.equal(balances(b).find(a=>a.code==='5900')!.net,100000)
  assert.equal(balances(b).find(a=>a.code==='1400')!.net,12000)
  assert.equal(balances(b).find(a=>a.code==='2000')!.net,-112000)
})
test('tampered tax metadata cannot pass backup validation',()=>{
  const b=addInvoice(emptyBooks(),sale(112000))
  b.invoices[0].vatAmount=100
  assert.throws(()=>parseBooks(JSON.stringify(b)),/tax breakdown/)
})
test('Manila dates are used independently of server timezone',()=>{
  assert.equal(today(),new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()))
})
