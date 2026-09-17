export const taskStatuses=['needs_review','in_progress','ready_for_review','filed','not_applicable'] as const
export type ComplianceTaskStatus=typeof taskStatuses[number]
export type EvidenceFile={path:string;name:string;size:number;type:string}
export type RegulationRecord={title:string;agency:string;number:string;year:string;kind:string;url:string;issuedOn:string;effectiveOn:string;reviewedOn:string;amends:string;notes:string;attachments:EvidenceFile[]}
export type ComplianceTask={title:string;agency:string;period:string;sourceUrl:string;assignedTo:string;dueDate:string;status:ComplianceTaskStatus;notes:string;filingDate:string;filingReference:string;evidenceUrl:string;attachments:EvidenceFile[]}
export function safeSourceUrl(value:string) { try { const u=new URL(value); return u.protocol==='https:'&&!u.username&&!u.password&&value.length<=2000 } catch {return false} }
export function actualDate(value:string) {return /^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value}
function clean(value:unknown,label:string,max=500,required=false) {if(typeof value!=='string'||value.trim().length>max||(required&&!value.trim()))throw Error(`${label} is ${required?'required and ':''}limited to ${max} characters.`);return value.trim()}
function date(value:unknown,label:string) {const v=clean(value,label,10);if(v&&!actualDate(v))throw Error(`Enter a valid ${label.toLowerCase()}.`);return v}
function url(value:unknown,label:string) {const v=clean(value,label,2000);if(v&&!safeSourceUrl(v))throw Error(`${label} must be a secure HTTPS link.`);return v}
export function validateEvidence(value:unknown,companyId:string):EvidenceFile[] {
  if(!Array.isArray(value)||value.length>10)throw Error('Attach at most ten supporting files.')
  return value.map(f=>{if(!f||typeof f!=='object'||typeof f.path!=='string'||!f.path.startsWith(`companies/${companyId}/evidence/`)||!/^companies\/[A-Za-z0-9_-]+\/evidence\/[A-Za-z0-9_-]+$/.test(f.path)||!Number.isInteger(f.size)||f.size<=0||f.size>10*1024*1024||!['application/pdf','image/png','image/jpeg'].includes(f.type))throw Error('Invalid supporting file. Use PDF, PNG or JPG, up to 10 MB.');return {path:f.path,name:clean(f.name,'File name',200,true),size:f.size,type:f.type}})
}
export function validateRegulation(value:unknown,companyId:string):RegulationRecord {
  if(!value||typeof value!=='object')throw Error('Enter a regulation record.');const v=value as Record<string,unknown>
  const result={title:clean(v.title,'Title',300,true),agency:clean(v.agency,'Agency',60,true),number:clean(v.number,'Issuance number',100),year:clean(v.year,'Year',4),kind:clean(v.kind,'Issuance type',40,true),url:url(v.url,'Official source URL'),issuedOn:date(v.issuedOn,'Issued date'),effectiveOn:date(v.effectiveOn,'Effective date'),reviewedOn:date(v.reviewedOn,'Review date'),amends:clean(v.amends,'Amendment reference',500),notes:clean(v.notes,'Notes',4000),attachments:validateEvidence(v.attachments,companyId)}
  if(result.year&&!/^\d{4}$/.test(result.year))throw Error('Year must contain four digits.')
  if(!result.url&&!result.attachments.length)throw Error('Add an official source URL or supporting document.')
  return result
}
export function validateComplianceTask(value:unknown,companyId:string):ComplianceTask {
  if(!value||typeof value!=='object')throw Error('Enter a compliance obligation.');const v=value as Record<string,unknown>
  if(!taskStatuses.includes(v.status as ComplianceTaskStatus))throw Error('Choose a valid review status.')
  const task={title:clean(v.title,'Obligation',300,true),agency:clean(v.agency,'Agency',60,true),period:clean(v.period,'Period',100),sourceUrl:url(v.sourceUrl,'Source URL'),assignedTo:clean(v.assignedTo,'Owner',128),dueDate:date(v.dueDate,'Due date'),status:v.status as ComplianceTaskStatus,notes:clean(v.notes,'Review notes',4000),filingDate:date(v.filingDate,'Filing date'),filingReference:clean(v.filingReference,'Filing acknowledgment',200),evidenceUrl:url(v.evidenceUrl,'Evidence URL'),attachments:validateEvidence(v.attachments,companyId)}
  if(task.status==='filed'&&(!task.filingDate||!task.filingReference||(!task.evidenceUrl&&!task.attachments.length)))throw Error('To record a filing, add its date, acknowledgment reference, and evidence link or file.')
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date())
  const today=['year','month','day'].map(type=>parts.find(p=>p.type===type)!.value).join('-')
  if(task.filingDate&&task.filingDate>today)throw Error('A recorded filing date cannot be in the future.')
  if(task.status==='not_applicable'&&!task.notes)throw Error('Explain why this obligation does not apply.')
  return task
}
