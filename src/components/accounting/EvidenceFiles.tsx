import { useState } from 'react'
import { getBlob, ref, uploadBytes } from 'firebase/storage'
import { storage } from '@/lib/firebase'
import { useCompany } from '@/hooks/useCompany'
import { validateEvidence, type EvidenceFile } from '@/lib/compliance-records'
import { Button } from '@/components/ui/button'

export function EvidenceFiles({value,onChange,disabled=false,onBusy}:{value:EvidenceFile[];onChange?:(files:EvidenceFile[])=>void;disabled?:boolean;onBusy?:(busy:boolean)=>void}){
  const company=useCompany(),[busy,setBusy]=useState(false),[error,setError]=useState('')
  const companyId=company?.membership?.companyId
  async function upload(file:File){if(!companyId||!onChange)return;setBusy(true);onBusy?.(true);setError('');try{
    const record={path:`companies/${companyId}/evidence/${crypto.randomUUID()}`,name:file.name,size:file.size,type:file.type}
    validateEvidence([...value,record],companyId)
    await uploadBytes(ref(storage,record.path),file,{contentType:file.type,customMetadata:{companyId}})
    onChange([...value,record])
  }catch(e){setError(`File upload failed. ${(e as Error).message}`)}finally{setBusy(false);onBusy?.(false)}}
  async function download(file:EvidenceFile){if(!companyId)return;setError('');try{
    validateEvidence([file],companyId)
    const blob=await getBlob(ref(storage,file.path),10*1024*1024),url=URL.createObjectURL(blob)
    const link=document.createElement('a');link.href=url;link.download=file.name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
  }catch{setError('This file could not be downloaded. Check company access and the storage service configuration.')}}
  return <div className="space-y-3"><div className="space-y-2">{value.map(f=><div key={f.path} className="flex flex-wrap items-center gap-2 rounded-md border p-3 text-sm"><button type="button" onClick={()=>void download(f)} className="text-primary underline">{f.name}</button><span className="text-xs text-muted-foreground">{Math.ceil(f.size/1024)} KB</span>{onChange&&<Button type="button" size="sm" variant="ghost" disabled={disabled||busy} onClick={()=>onChange(value.filter(x=>x.path!==f.path))}>Remove from record</Button>}</div>)}</div>{onChange&&<label className="block text-sm font-medium">Add supporting file<input disabled={disabled||busy||value.length>=10} type="file" accept="application/pdf,image/png,image/jpeg" className="mt-2 block w-full text-sm" onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)void upload(file)}}/><span className="mt-1 block text-xs font-normal text-muted-foreground">PDF, PNG or JPG · Up to 10 MB each · Company access required</span></label>}{busy&&<p role="status" className="text-sm">Uploading supporting file…</p>}{error&&<p role="alert" className="text-sm text-red-700">{error}</p>}</div>
}
