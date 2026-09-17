import { IncomeExpenseTracker } from '@/components/income/IncomeExpenseTracker'
import { useAuthUser } from '@/store/useAuthStore'
import { useSearchParams } from 'react-router-dom'

export function IncomeExpensesPage() {
  const user = useAuthUser()
  const [params] = useSearchParams()
  return (
    <div className="mx-auto max-w-6xl">
      <IncomeExpenseTracker key={`${user?.uid}:${params.get('type') || ''}`} />
    </div>
  )
}
