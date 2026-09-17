import { createContext, useContext, useEffect, useState } from 'react'
import { collection, onSnapshot, orderBy, query, limit } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useCompany } from '@/hooks/useCompany'

export type CompanyDocument<T> = T & {id:string;version:number}
export const CompanyRecordsPreview = createContext<Record<string,unknown[]>|null>(null)
/** Collections contain server-validated documents. A separate preview provider is used only by isolated test pages. */
export function useCompanyRecords<T>(name:string,enabled=true) {
  const company=useCompany(),preview=useContext(CompanyRecordsPreview)
  const id=company?.membership?.active?company.membership.companyId:''
  const [state,setState]=useState<{key:string;rows:CompanyDocument<T>[];loading:boolean;error:string}>({key:'',rows:[],loading:true,error:''})
  const key=`${id}/${name}/${enabled}`
  useEffect(()=>{
    if(preview||!id||!enabled)return
    const base=collection(db,`companies/${id}/${name}`)
    const source=name==='taxDrafts'?query(base,orderBy('createdAt','desc'),limit(100)):base
    return onSnapshot(source,s=>setState({key,rows:s.docs.map(d=>({...d.data(),id:d.id}) as CompanyDocument<T>),loading:false,error:''}),()=>setState({key,rows:[],loading:false,error:'Company records could not be loaded. Check your access, connection and service deployment.'}))
  },[id,name,enabled,key,preview])
  if(preview)return {rows:(preview[name]||[]) as CompanyDocument<T>[],loading:false,error:''}
  if(!id||!enabled)return {rows:[] as CompanyDocument<T>[],loading:false,error:''}
  return state.key===key?state:{rows:[] as CompanyDocument<T>[],loading:true,error:''}
}
