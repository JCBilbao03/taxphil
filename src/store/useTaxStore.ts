import { create } from 'zustand'

export type TransactionType = 'income' | 'expense'

export interface Transaction {
  id: string
  type: TransactionType
  description: string
  amount: number
  date: string
  category: string
  reference?: string
}

export type BirFormType = string

export interface TaxDeadline {
  id: string
  formType: BirFormType
  title: string
  dueDate: string
  amountDue: number
  status: 'upcoming' | 'due_soon' | 'overdue' | 'filed'
  taxPeriod?: string
  sourceUrl?: string
  notes?: string
  filingDate?: string
  filingReference?: string
  filingNotes?: string
  evidenceUrl?: string
}

interface TaxState {
  income: Transaction[]
  expenses: Transaction[]
  deadlines: TaxDeadline[]
  loading: boolean
  error: string | null
  totalIncome: () => number
  totalExpenses: () => number
  netIncome: () => number
  nextDeadline: () => TaxDeadline | undefined
  setIncome: (income: Transaction[]) => void
  setExpenses: (expenses: Transaction[]) => void
  setDeadlines: (deadlines: TaxDeadline[]) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
}

export const useTaxStore = create<TaxState>((set, get) => ({
  income: [],
  expenses: [],
  deadlines: [],
  loading: false,
  error: null,

  totalIncome: () =>
    get().income.reduce((sum, item) => sum + Math.round(item.amount * 100), 0) / 100,

  totalExpenses: () =>
    get().expenses.reduce((sum, item) => sum + Math.round(item.amount * 100), 0) / 100,

  netIncome: () => Math.round((get().totalIncome() - get().totalExpenses()) * 100) / 100,

  nextDeadline: () => {
    const pending = get()
      .deadlines.filter((d) => d.status !== 'filed')
      .sort(
        (a, b) =>
          a.dueDate.localeCompare(b.dueDate),
      )
    return pending[0]
  },

  setIncome: (income) => set({ income }),
  setExpenses: (expenses) => set({ expenses }),
  setDeadlines: (deadlines) => set({ deadlines }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}))
