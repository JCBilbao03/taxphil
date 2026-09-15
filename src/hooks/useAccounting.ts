import { useEffect, useState } from 'react'
import { emptyBooks, parseBooks, type Books } from '@/lib/accounting'

export function useAccounting(uid: string) {
  const key = `ubb-accounting-v1:${uid}`
  const [books, setBooks] = useState<Books>(emptyBooks)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  useEffect(() => {
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
  }, [key])
  async function save(change: (current: Books) => Books, restore = false) {
    if (!navigator.locks) throw Error('Use a current browser with secure local storage support.')
    await navigator.locks.request(key, () => {
      const raw = localStorage.getItem(key)
      const current = restore ? emptyBooks() : raw ? parseBooks(raw) : emptyBooks()
      const next = change(current)
      localStorage.setItem(key, JSON.stringify(next))
      setBooks(next); setError(''); setReady(true)
    })
  }
  return { books, error, ready, save, rawBackup: () => localStorage.getItem(key) ?? JSON.stringify(books) }
}
