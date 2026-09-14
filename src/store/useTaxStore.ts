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

export type BirFormType = '1701Q' | '2551Q' | '0619-E' | '1601-C'

export interface TaxDeadline {
  id: string
  formType: BirFormType
  title: string
  dueDate: string
  amountDue: number
  status: 'upcoming' | 'due_soon' | 'overdue' | 'filed'
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
    get().income.reduce((sum, item) => sum + item.amount, 0),

  totalExpenses: () =>
    get().expenses.reduce((sum, item) => sum + item.amount, 0),

  netIncome: () => get().totalIncome() - get().totalExpenses(),

  nextDeadline: () => {
    const pending = get()
      .deadlines.filter((d) => d.status !== 'filed')
      .sort(
        (a, b) =>
          new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
      )
    return pending[0]
  },

  setIncome: (income) => set({ income }),
  setExpenses: (expenses) => set({ expenses }),
  setDeadlines: (deadlines) => set({ deadlines }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}))
