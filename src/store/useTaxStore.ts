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
  totalIncome: () => number
  totalExpenses: () => number
  netIncome: () => number
  nextDeadline: () => TaxDeadline | undefined
  addTransaction: (transaction: Omit<Transaction, 'id'>) => void
  removeTransaction: (id: string) => void
}

const seedIncome: Transaction[] = [
  {
    id: 'inc-1',
    type: 'income',
    description: 'Client retainer — Q2 consulting',
    amount: 85000,
    date: '2026-04-15',
    category: 'Professional Services',
    reference: 'INV-2026-014',
  },
  {
    id: 'inc-2',
    type: 'income',
    description: 'Freelance web development project',
    amount: 42000,
    date: '2026-05-02',
    category: 'Project Work',
    reference: 'INV-2026-021',
  },
]

const seedExpenses: Transaction[] = [
  {
    id: 'exp-1',
    type: 'expense',
    description: 'Co-working space membership',
    amount: 4500,
    date: '2026-04-01',
    category: 'Office & Admin',
    reference: 'RCP-8841',
  },
  {
    id: 'exp-2',
    type: 'expense',
    description: 'Software subscriptions (Adobe, Figma)',
    amount: 3200,
    date: '2026-04-10',
    category: 'Tools & Software',
    reference: 'RCP-8892',
  },
]

const seedDeadlines: TaxDeadline[] = [
  {
    id: 'dl-1',
    formType: '2551Q',
    title: 'Percentage Tax — 2551Q (Q2 2026)',
    dueDate: '2026-07-25',
    amountDue: 3825,
    status: 'due_soon',
  },
  {
    id: 'dl-2',
    formType: '1701Q',
    title: 'Income Tax — 1701Q (Q2 2026)',
    dueDate: '2026-08-15',
    amountDue: 12450,
    status: 'upcoming',
  },
  {
    id: 'dl-3',
    formType: '0619-E',
    title: 'Monthly Withholding — 0619-E (July 2026)',
    dueDate: '2026-08-10',
    amountDue: 2100,
    status: 'upcoming',
  },
]

export const useTaxStore = create<TaxState>((set, get) => ({
  income: seedIncome,
  expenses: seedExpenses,
  deadlines: seedDeadlines,

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

  addTransaction: (transaction) => {
    const id = crypto.randomUUID()
    const entry = { ...transaction, id }

    if (transaction.type === 'income') {
      set((state) => ({ income: [entry, ...state.income] }))
    } else {
      set((state) => ({ expenses: [entry, ...state.expenses] }))
    }
  },

  removeTransaction: (id) => {
    set((state) => ({
      income: state.income.filter((item) => item.id !== id),
      expenses: state.expenses.filter((item) => item.id !== id),
    }))
  },
}))
