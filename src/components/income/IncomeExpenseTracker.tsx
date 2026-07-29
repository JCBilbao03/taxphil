import { useCallback, useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  useTaxStore,
  type Transaction,
  type TransactionType,
} from '@/store/useTaxStore'
import { formatCurrency, formatDate } from '@/lib/utils'

interface FormState {
  type: TransactionType
  description: string
  amount: string
  date: string
  category: string
  reference: string
}

const emptyForm: FormState = {
  type: 'income',
  description: '',
  amount: '',
  date: new Date().toISOString().split('T')[0],
  category: '',
  reference: '',
}

export function IncomeExpenseTracker() {
  const income = useTaxStore((state) => state.income)
  const expenses = useTaxStore((state) => state.expenses)
  const addTransaction = useTaxStore((state) => state.addTransaction)
  const removeTransaction = useTaxStore((state) => state.removeTransaction)

  const [form, setForm] = useState<FormState>(emptyForm)
  const [filter, setFilter] = useState<'all' | TransactionType>('all')

  const transactions = useMemo<Transaction[]>(() => {
    const combined = [...income, ...expenses].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    )
    if (filter === 'all') return combined
    return combined.filter((item) => item.type === filter)
  }, [income, expenses, filter])

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()

      const amount = parseFloat(form.amount)
      if (!form.description || Number.isNaN(amount) || amount <= 0) return

      addTransaction({
        type: form.type,
        description: form.description,
        amount,
        date: form.date,
        category: form.category || 'Uncategorized',
        reference: form.reference || undefined,
      })

      setForm({ ...emptyForm, type: form.type })
    },
    [addTransaction, form],
  )

  return (
    <div className="space-y-6">
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Log a transaction</CardTitle>
          <CardDescription>
            Quickly record receipts, invoices, and expenses for accurate tax
            computation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleSubmit}
            className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
          >
            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <Select
                value={form.type}
                onValueChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    type: value as TransactionType,
                  }))
                }
              >
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="expense">Expense</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                placeholder="e.g. Client invoice #1024"
                value={form.description}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, description: e.target.value }))
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Amount (PHP)</Label>
              <Input
                id="amount"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={form.amount}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, amount: e.target.value }))
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={form.date}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, date: e.target.value }))
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                placeholder="e.g. Professional Services"
                value={form.category}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, category: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2 md:col-span-2 lg:col-span-3">
              <Label htmlFor="reference">Reference (optional)</Label>
              <Input
                id="reference"
                placeholder="Invoice or receipt number"
                value={form.reference}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, reference: e.target.value }))
                }
              />
            </div>

            <div className="md:col-span-2 lg:col-span-3">
              <Button type="submit" className="gap-2">
                <Plus className="size-4" />
                Add transaction
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>Transaction history</CardTitle>
            <CardDescription>
              {transactions.length} record{transactions.length !== 1 ? 's' : ''}
            </CardDescription>
          </div>
          <Select
            value={filter}
            onValueChange={(value) =>
              setFilter(value as 'all' | TransactionType)
            }
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="income">Income only</SelectItem>
              <SelectItem value="expense">Expenses only</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-12">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No transactions yet. Log your first receipt or invoice
                    above.
                  </TableCell>
                </TableRow>
              ) : (
                transactions.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-muted-foreground">
                      {formatDate(item.date)}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{item.description}</p>
                        {item.reference ? (
                          <p className="text-xs text-muted-foreground">
                            {item.reference}
                          </p>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {item.category}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          item.type === 'income'
                            ? 'border-deadline-safe/30 bg-deadline-safe-bg text-deadline-safe'
                            : 'border-border bg-muted text-muted-foreground'
                        }
                      >
                        {item.type === 'income' ? 'Income' : 'Expense'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(item.amount)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`Remove ${item.description}`}
                        onClick={() => removeTransaction(item.id)}
                      >
                        <Trash2 className="size-3.5 text-muted-foreground" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
