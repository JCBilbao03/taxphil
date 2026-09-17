import { useEffect, useState } from 'react'
import { emptyBooks, parseBooks, type Books } from '@/lib/accounting'
import { useCompany } from '@/hooks/useCompany'

export function useAccounting(uid: string) {
  const company = useCompany()
  const hasCompany = Boolean(company)
  const key = `ubb-accounting-v1:${uid}`
  const [books, setBooks] = useState<Books>(emptyBooks)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (hasCompany) return
    const read = () => {
      try {
        const raw = localStorage.getItem(key)
        setBooks(raw ? parseBooks(raw) : emptyBooks()); setError(''); setReady(true)
      } catch { setError('Saved accounting data could not be read. Export the recovery file before restoring a valid backup.'); setReady(false) }
    }
    read()
    const changed = (e: StorageEvent) => { if (e.key === key || e.key === null) read() }
    window.addEventListener('storage', changed)
    return () => window.removeEventListener('storage', changed)
  }, [key, hasCompany])
  async function save(change: (current: Books) => Books, restore = false, command?: Record<string, unknown>) {
    if (company) {
      if (restore) throw Error('Company books cannot be overwritten from a browser backup. Arrange a reviewed migration.')
      if (!command) throw Error('A supported company accounting command is required.')
      return company.command(command)
    }
    if (!navigator.locks) throw Error('Use a current browser with secure local storage support.')
    await navigator.locks.request(key, () => {
      const raw = localStorage.getItem(key)
      const current = restore ? emptyBooks() : raw ? parseBooks(raw) : emptyBooks()
      const next = change(current)
      localStorage.setItem(key, JSON.stringify(next))
      setBooks(next); setError(''); setReady(true)
    })
  }
  return { books: company ? company.books : books, error: company ? company.error : error, ready: company ? company.booksReady : ready, save, rawBackup: () => company ? JSON.stringify(company.books) : localStorage.getItem(key) ?? JSON.stringify(books) }
}
