import { TaxDuesSummaryCard } from '@/components/dashboard/TaxDuesSummaryCard'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useTaxStore } from '@/store/useTaxStore'
import { formatCurrency } from '@/lib/utils'

export function DashboardPage() {
  const totalIncome = useTaxStore((state) => state.totalIncome)
  const totalExpenses = useTaxStore((state) => state.totalExpenses)
  const netIncome = useTaxStore((state) => state.netIncome)
  const deadlines = useTaxStore((state) => state.deadlines)

  const pendingCount = deadlines.filter((d) => d.status !== 'filed').length

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total income
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tracking-tight">
              {formatCurrency(totalIncome())}
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total expenses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tracking-tight">
              {formatCurrency(totalExpenses())}
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Net income
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tracking-tight text-primary">
              {formatCurrency(netIncome())}
            </p>
          </CardContent>
        </Card>
      </div>

      <TaxDuesSummaryCard />

      <p className="text-sm text-muted-foreground">
        {pendingCount} upcoming tax obligation
        {pendingCount !== 1 ? 's' : ''} this quarter. Stay compliant — file
        before the BIR deadline to avoid penalties.
      </p>
    </div>
  )
}
