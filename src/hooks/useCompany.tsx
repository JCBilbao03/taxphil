import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { collection, doc, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from '@/lib/firebase'
import { useAuthUser } from '@/store/useAuthStore'
import { emptyBooks, parseBooks, type Books } from '@/lib/accounting'
import type { CompanyProfile } from '@/lib/ph-compliance'

export type CompanyRole = 'admin' | 'manager' | 'accountant' | 'viewer'
export type CompanyMembership = { uid: string; email: string; displayName: string; companyId: string; companyCode: string; role: CompanyRole; active: boolean }
export type CompanyRecord = { companyCode: string; profile: CompanyProfile }
export type CompanyRow = Record<string, unknown> & { id: string }
export type CompanyContextValue = {
  membership: CompanyMembership | null; company: CompanyRecord | null; books: Books; revision: number
  members: CompanyMembership[]; approvals: CompanyRow[]; audit: CompanyRow[]
  loading: boolean; busy: boolean; error: string; booksReady: boolean
  invoke: <T = Record<string, unknown>>(name: string, data: Record<string, unknown>) => Promise<T>
  command: (command: Record<string, unknown>) => Promise<{ revision: number; status: string; pendingId?: string }>
}
export const CompanyContext = createContext<CompanyContextValue | null>(null)
export const useCompany = () => useContext(CompanyContext)
export const roleLabel = (role: CompanyRole) => ({ admin: 'Company Admin', manager: 'Accounting Manager', accountant: 'Accountant', viewer: 'Viewer / Auditor' })[role]

export function CompanyProvider({ children }: { children: ReactNode }) {
  const uid = useAuthUser()?.uid
  const [membership, setMembership] = useState<CompanyMembership | null>(null)
  const [company, setCompany] = useState<CompanyRecord | null>(null)
  const [books, setBooks] = useState<Books>(emptyBooks)
  const [revision, setRevision] = useState(0)
  const [members, setMembers] = useState<CompanyMembership[]>([])
  const [approvals, setApprovals] = useState<CompanyRow[]>([])
  const [audit, setAudit] = useState<CompanyRow[]>([])
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false)
  const [error, setError] = useState(''), [booksReady, setBooksReady] = useState(false)
  useEffect(() => {
    setMembership(null); setCompany(null); setBooks(emptyBooks()); setBooksReady(false); setError(''); setLoading(true)
    if (!uid) { setLoading(false); return }
    return onSnapshot(doc(db, 'companyMemberships', uid), snapshot => {
      setMembership(snapshot.exists() ? snapshot.data() as CompanyMembership : null)
      setLoading(false)
    }, () => { setError('Company access could not be loaded. Check your connection and that the company service and access rules have been deployed.'); setLoading(false) })
  }, [uid])
  useEffect(() => {
    setCompany(null); setBooks(emptyBooks()); setBooksReady(false); setMembers([]); setApprovals([]); setAudit([])
    if (!membership?.active) return
    const base = `companies/${membership.companyId}`
    const failed = () => { setError('Company records could not be loaded. Check your access and connection.'); setBooksReady(false) }
    let pendingRows: CompanyRow[] = [], recentRows: CompanyRow[] = []
    const mergeApprovals = () => setApprovals([...new Map([...recentRows, ...pendingRows].map(row => [row.id, row])).values()].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))))
    const unsubscribes = [
      onSnapshot(doc(db, base), snapshot => { if (snapshot.exists()) setCompany(snapshot.data() as CompanyRecord); else failed() }, failed),
      onSnapshot(doc(db, `${base}/accounting/books`), snapshot => {
        try {
          if (!snapshot.exists()) throw Error('Missing books')
          setBooks(parseBooks(JSON.stringify(snapshot.data().books))); setRevision(snapshot.data().revision); setBooksReady(true); setError('')
        } catch { setBooksReady(false); setError('The company books need review. No records have been overwritten.') }
      }, failed),
      onSnapshot(collection(db, `${base}/members`), snapshot => setMembers(snapshot.docs.map(row => row.data() as CompanyMembership)), failed),
      onSnapshot(query(collection(db, `${base}/approvals`), where('status', '==', 'pending')), snapshot => { pendingRows = snapshot.docs.map(row => ({ ...row.data(), id: row.id })); mergeApprovals() }, failed),
      onSnapshot(query(collection(db, `${base}/approvals`), orderBy('createdAt', 'desc'), limit(100)), snapshot => { recentRows = snapshot.docs.map(row => ({ ...row.data(), id: row.id })); mergeApprovals() }, failed),
      onSnapshot(query(collection(db, `${base}/audit`), orderBy('createdAt', 'desc'), limit(100)), snapshot => setAudit(snapshot.docs.map(row => ({ ...row.data(), id: row.id }))), failed),
    ]
    return () => unsubscribes.forEach(unsubscribe => unsubscribe())
  }, [membership?.companyId, membership?.active, membership?.role])
  async function invoke<T = Record<string, unknown>>(name: string, data: Record<string, unknown>): Promise<T> {
    setBusy(true)
    try { return (await httpsCallable<Record<string, unknown>, T>(functions, name)(data)).data }
    catch (cause) {
      const message = cause instanceof Error ? cause.message : 'The company service could not complete this request.'
      throw Error(/internal|not-found|Failed to fetch/i.test(message) ? 'The company service is unavailable. Check the backend deployment and your connection, then try again.' : message)
    } finally { setBusy(false) }
  }
  async function command(input: Record<string, unknown>) {
    if (!membership?.active || !booksReady) throw Error('Your company books are not ready.')
    const result = await invoke<{ revision: number; status: string; pendingId?: string }>('companyAccountingCommand', { command: input, expectedRevision: revision })
    return result
  }
  return <CompanyContext.Provider value={{ membership, company, books, revision, members, approvals, audit, loading, busy, error, booksReady, invoke, command }}>{children}</CompanyContext.Provider>
}
