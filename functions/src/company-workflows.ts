import { getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { companyIdentity, companyContext, companyRequireRole, companyAudit } from './company-accounting.js'
import { validateComplianceTask, validateRegulation } from './compliance-records.js'
import { validateMappings, type MappingBooks, type TaxAdjustment } from './tax-mapping.js'
import { buildReturnWorkingPaper, defaultReturnTemplates, validateRegister, validateTemplate, type TaxRegister } from './tax-returns.js'
const options={region:'asia-southeast1',timeoutSeconds:60,maxInstances:20}
const now=()=>new Date().toISOString()
function object(value:unknown):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value))throw new HttpsError('invalid-argument','A request is required.');return value as Record<string,unknown>}
function identifier(value:unknown){if(typeof value!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(value))throw new HttpsError('invalid-argument','Invalid record identifier.');return value}
function version(value:unknown){if(typeof value!=='number'||!Number.isSafeInteger(value)||value<0)throw new HttpsError('invalid-argument','A valid record version is required.');return value}
function validate<T>(fn:()=>T):T{try{return fn()}catch(e){throw new HttpsError('invalid-argument',e instanceof Error?e.message:'Invalid record.')}}

export const companyWorkflowSave=onCall(options,async request=>{
  const actor=await companyIdentity(request), data=object(request.data)
  if(!['regulations','complianceTasks'].includes(String(data.collection)))throw new HttpsError('invalid-argument','Unsupported record type.')
  const collectionName=String(data.collection),expected=version(data.expectedVersion),db=getFirestore()
  return db.runTransaction(async tx=>{
    const {member,companyRef}=await companyContext(tx,actor)
    companyRequireRole(member,collectionName==='regulations'?['admin','manager']:['admin','manager','accountant'])
    const collection=companyRef.collection(collectionName)
    const ref=data.id?collection.doc(identifier(data.id)):collection.doc()
    const previous=await tx.get(ref)
    if((previous.get('version')||0)!==expected)throw new HttpsError('aborted','This record changed. Reload before saving.')
    const clean=validate(()=>collectionName==='regulations'?validateRegulation(data.value,member.companyId):validateComplianceTask(data.value,member.companyId))
    if(member.role==='accountant'&&'assignedTo' in clean&&clean.assignedTo!==actor.uid)throw new HttpsError('permission-denied','Accountants can create or maintain their own assigned obligations. Ask an Admin or Manager to assign another owner.')
    if('assignedTo' in clean&&clean.assignedTo){const assigned=await tx.get(companyRef.collection('members').doc(identifier(clean.assignedTo)));if(!assigned.exists||assigned.get('active')!==true||assigned.get('role')==='viewer')throw new HttpsError('invalid-argument','Assign an active Admin, Manager or Accountant.')}
    if('status' in clean&&['filed','not_applicable'].includes(clean.status))companyRequireRole(member,['admin','manager'])
    if(member.role==='accountant'&&previous.exists&&previous.get('assignedTo')&&previous.get('assignedTo')!==actor.uid)throw new HttpsError('permission-denied','Only the assigned person or an Admin/Manager can update this task.')
    if(member.role==='accountant'&&previous.exists&&['filed','not_applicable'].includes(previous.get('status')))throw new HttpsError('permission-denied','An Admin or Manager must reopen a reviewed task.')
    const record={...clean,version:expected+1,createdAt:previous.get('createdAt')||now(),createdBy:previous.get('createdBy')||actor.uid,updatedAt:now(),updatedBy:actor.uid}
    if(previous.exists)tx.update(ref,record);else tx.create(ref,record)
    companyAudit(tx,companyRef,actor,`${collectionName}.save`,clean.title,{recordId:ref.id,recordVersion:record.version})
    return {id:ref.id,version:record.version}
  })
})
export const companyTaxMappingSave=onCall(options,async request=>{
  const actor=await companyIdentity(request),data=object(request.data),expected=version(data.expectedVersion)
  return getFirestore().runTransaction(async tx=>{
    const {member,companyRef}=await companyContext(tx,actor);companyRequireRole(member,['admin','manager'])
    const ref=companyRef.collection('taxMappings').doc('default'),[old,ledger]=await tx.getAll(ref,companyRef.collection('accounting').doc('books'))
    if((old.get('version')||0)!==expected)throw new HttpsError('aborted','Account mappings changed. Reload before saving.')
    if(!ledger.exists)throw new HttpsError('failed-precondition','Company books are unavailable.')
    const mappings=validate(()=>validateMappings(data.mappings,(ledger.get('books') as MappingBooks).accounts))
    const result={mappings,version:expected+1,updatedAt:now(),updatedBy:actor.uid}
    if(old.exists)tx.update(ref,result);else tx.create(ref,result)
    companyAudit(tx,companyRef,actor,'tax.mapping.save',`Updated ${mappings.length} account mappings.`,{mappingVersion:result.version})
    return result
  })
})
export const companyTaxTemplateSave=onCall(options,async request=>{
  const actor=await companyIdentity(request),data=object(request.data),expected=version(data.expectedVersion)
  return getFirestore().runTransaction(async tx=>{
    const {member,companyRef}=await companyContext(tx,actor);companyRequireRole(member,['admin','manager'])
    const ledger=await tx.get(companyRef.collection('accounting').doc('books'))
    if(!ledger.exists)throw new HttpsError('failed-precondition','Company books are unavailable.')
    const template=validate(()=>validateTemplate(data.template,ledger.get('books'))),ref=companyRef.collection('taxTemplates').doc(template.code),old=await tx.get(ref)
    if((old.get('version')||0)!==expected)throw new HttpsError('aborted','This return mapping changed. Reload before saving.')
    const result={template,version:expected+1,updatedAt:now(),updatedBy:actor.uid}
    tx.set(ref,result);companyAudit(tx,companyRef,actor,'tax.template.save',`Saved BIR ${template.code} field mapping.`,{templateVersion:result.version})
    return result
  })
})
export const companyTaxRegisterSave=onCall(options,async request=>{
  const actor=await companyIdentity(request),data=object(request.data),expected=version(data.expectedVersion)
  return getFirestore().runTransaction(async tx=>{
    const {member,companyRef}=await companyContext(tx,actor);companyRequireRole(member,['admin','manager','accountant'])
    const ref=companyRef.collection('taxRegisters').doc('default'),[old,ledger]=await tx.getAll(ref,companyRef.collection('accounting').doc('books'))
    if((old.get('version')||0)!==expected)throw new HttpsError('aborted','Tax details changed. Reload before saving.')
    if(!ledger.exists)throw new HttpsError('failed-precondition','Company books are unavailable.')
    const input=object(data.record)
    if(input.kind==='payroll'||String(data.id||'').startsWith('payroll-'))throw new HttpsError('failed-precondition','Payroll tax details come from approved payroll runs. Correct payroll through its review process.')
    if(input.partyId){
      const party=await tx.get(companyRef.collection('parties').doc(identifier(input.partyId)))
      if(!party.exists||!party.get('active'))throw new HttpsError('invalid-argument','Select an active vendor or customer from this company.')
      if(input.kind==='vat_sales'&&party.get('kind')!=='customer')throw new HttpsError('invalid-argument','VAT sales require a customer.')
      if(['vat_purchases','expanded_withholding','final_withholding'].includes(String(input.kind))&&party.get('kind')!=='vendor')throw new HttpsError('invalid-argument','Select a vendor for purchases and withholding.')
      input.partyName=party.get('registeredName');input.tin=party.get('tin');input.address=party.get('address');if(!input.atc)input.atc=party.get('defaultAtc')||''
    }else if(['expanded_withholding','final_withholding'].includes(String(input.kind)))throw new HttpsError('invalid-argument','Select the payee from the vendor database.')
    const record=validate(()=>validateRegister(input,ledger.get('books'))),records=(old.get('records')||[]) as TaxRegister[]
    record.id=data.id?identifier(data.id):companyRef.collection('taxDetails').doc().id
    if(data.id&&!records.some(r=>r.id===record.id))throw new HttpsError('not-found','Tax detail record not found.')
    const next=[...records.filter(r=>r.id!==record.id),record]
    if(record.active&&records.some(r=>r.id!==record.id&&r.active&&r.entryId===record.entryId&&r.kind===record.kind&&r.partyId===record.partyId&&r.classification===record.classification))throw new HttpsError('already-exists','This entry already has that tax classification for this party. Edit the existing detail instead.')
    if(next.length>1000||Buffer.byteLength(JSON.stringify(next),'utf8')>500000)throw new HttpsError('resource-exhausted','Tax details exceed the current company capacity. Export and review before adding more.')
    const result={records:next,version:expected+1,updatedAt:now(),updatedBy:actor.uid}
    tx.set(ref,result);companyAudit(tx,companyRef,actor,'tax.register.save',`Updated ${record.kind} detail for ${record.date}.`,{recordId:record.id,registerVersion:result.version})
    return {id:record.id,version:result.version}
  })
})
export const companyTaxDraftCreate=onCall(options,async request=>{
  const actor=await companyIdentity(request),data=object(request.data),form=identifier(data.form).toUpperCase()
  if(data.applicabilityConfirmed!==true)throw new HttpsError('invalid-argument','Confirm the applicable return and reporting period before preparing the draft.')
  return getFirestore().runTransaction(async tx=>{
    const {member,companyRef,company}=await companyContext(tx,actor);companyRequireRole(member,['admin','manager','accountant'])
    const profile=company.profile
    if(['1701','1701A','1701-MS','1701Q'].includes(form)&&profile.entityType!=='sole_proprietor')throw new HttpsError('failed-precondition','This is an individual return. Use a company with a sole-proprietor profile.')
    if(['1702-RT','1702-EX','1702-MX','1702Q'].includes(form)&&profile.entityType==='sole_proprietor')throw new HttpsError('failed-precondition','This return requires a non-individual company profile.')
    if(form==='1702-RT'&&profile.incomeTaxRegime!=='corporate')throw new HttpsError('failed-precondition','Review the company’s corporate tax registration before selecting 1702-RT.')
    if(form==='2550Q'&&profile.vatStatus!=='vat')throw new HttpsError('failed-precondition','Review the company’s VAT registration before preparing 2550Q.')
    const [ledger,mapping,savedTemplate,register]=await tx.getAll(companyRef.collection('accounting').doc('books'),companyRef.collection('taxMappings').doc('default'),companyRef.collection('taxTemplates').doc(form),companyRef.collection('taxRegisters').doc('default'))
    if(!ledger.exists||!mapping.exists)throw new HttpsError('failed-precondition','Save reviewed account mappings first.')
    if(ledger.get('revision')!==version(data.expectedBooksRevision)||mapping.get('version')!==version(data.expectedMappingVersion))throw new HttpsError('aborted','The books or mappings changed. Review the refreshed figures before saving.')
    if((savedTemplate.get('version')||0)!==version(data.expectedTemplateVersion)||(register.get('version')||0)!==version(data.expectedRegisterVersion))throw new HttpsError('aborted','Return fields or tax details changed. Review the refreshed data before saving.')
    const template=savedTemplate.get('template')||defaultReturnTemplates.find(t=>t.code===form)
    if(!template)throw new HttpsError('failed-precondition','Configure this return’s account and tax-detail fields first.')
    const from=String(data.from),to=String(data.to)
    const paper=validate(()=>buildReturnWorkingPaper(ledger.get('books'),mapping.get('mappings'),template,register.get('records')||[],from,to,(data.adjustments||[]) as TaxAdjustment[],data.nilReasons?object(data.nilReasons) as Record<string,string>:{}))
    const ref=companyRef.collection('taxDrafts').doc(),record={form,from,to,...paper,booksRevision:ledger.get('revision'),mappingVersion:mapping.get('version'),templateVersion:savedTemplate.get('version')||0,registerVersion:register.get('version')||0,mappingSnapshot:mapping.get('mappings'),profileSnapshot:profile,status:'draft',createdAt:now(),createdBy:actor.uid,createdByEmail:actor.email,version:1,applicabilityConfirmed:true}
    if(Buffer.byteLength(JSON.stringify(record),'utf8')>650000)throw new HttpsError('resource-exhausted','The draft exceeds the supported size. Review the account history before continuing.')
    tx.create(ref,record);companyAudit(tx,companyRef,actor,'tax.draft.create',`Prepared BIR ${form} working paper for ${from} to ${to}.`,{draftId:ref.id,booksRevision:record.booksRevision})
    return {id:ref.id,...record}
  })
})
export const companyTaxDraftReview=onCall(options,async request=>{
  const actor=await companyIdentity(request),data=object(request.data),draftId=identifier(data.id)
  if(typeof data.note!=='string'||!data.note.trim()||data.note.length>2000)throw new HttpsError('invalid-argument','Add a review note describing the checks completed and outstanding filing inputs.')
  const note=data.note.trim()
  return getFirestore().runTransaction(async tx=>{
    const {member,companyRef,company}=await companyContext(tx,actor);companyRequireRole(member,['admin','manager'])
    const ref=companyRef.collection('taxDrafts').doc(draftId),[draft,ledger,mapping,register]=await tx.getAll(ref,companyRef.collection('accounting').doc('books'),companyRef.collection('taxMappings').doc('default'),companyRef.collection('taxRegisters').doc('default'))
    if(!draft.exists)throw new HttpsError('not-found','The draft does not exist.')
    if(draft.get('status')!=='draft')throw new HttpsError('failed-precondition','This working paper is already reviewed.')
    const profileKeys=[...new Set([...Object.keys(company.profile),...Object.keys(draft.get('profileSnapshot')||{})])]
    if(profileKeys.some(key=>(company.profile as Record<string,unknown>)[key]!==draft.get('profileSnapshot')?.[key]))throw new HttpsError('aborted','Company registration or tax settings changed. Prepare a new draft using the current company profile.')
    if(draft.get('createdBy')===actor.uid)throw new HttpsError('permission-denied','Another Admin or Manager must review this working paper.')
    if(draft.get('blockers').length)throw new HttpsError('failed-precondition','Resolve missing accounting and tax details, then generate a new draft.')
    const template=await tx.get(companyRef.collection('taxTemplates').doc(draft.get('form')))
    if((register.get('version')||0)!==draft.get('registerVersion')||(template.get('version')||0)!==draft.get('templateVersion'))throw new HttpsError('aborted','Tax details or return fields changed. Prepare a new draft.')
    const required=draft.get('template').requirements as string[]
    if(!Array.isArray(data.confirmedRequirements)||required.some(r=>!(data.confirmedRequirements as unknown[]).includes(r)))throw new HttpsError('failed-precondition','Confirm every return review requirement.')
    if(draft.get('booksRevision')!==ledger.get('revision')||draft.get('mappingVersion')!==mapping.get('version'))throw new HttpsError('aborted','Books or mapping changed. Prepare a new draft from the current records.')
    tx.update(ref,{status:'reviewed',reviewedAt:now(),reviewedBy:actor.uid,reviewNote:note,confirmedRequirements:required,version:draft.get('version')+1})
    companyAudit(tx,companyRef,actor,'tax.draft.review',`Reviewed BIR ${draft.get('form')} accounting working paper.`,{draftId})
    return {status:'reviewed'}
  })
})
