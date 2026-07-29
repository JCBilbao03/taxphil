import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useTaxStore } from '@/store/useTaxStore'
import { daysUntil, formatCurrency, formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'

function statusLabel(status: string, daysLeft: number) {
  if (status === 'filed') return 'Filed'
  if (status === 'overdue' || daysLeft < 0) return 'Overdue'
  if (status === 'due_soon' || daysLeft <= 14) return 'Due soon'
  return 'Upcoming'
}

function statusClass(status: string, daysLeft: number) {
  if (status === 'filed') {
    return 'bg-deadline-safe-bg text-deadline-safe border-deadline-safe/20'
  }
  if (status === 'overdue' || daysLeft < 0) {
    return 'bg-deadline-urgent-bg text-deadline-urgent border-deadline-urgent/20'
  }
  if (status === 'due_soon' || daysLeft <= 14) {
    return 'bg-deadline-warning-bg text-deadline-warning border-deadline-warning/20'
  }
  return 'bg-muted text-muted-foreground border-border'
}

export function TaxDuesPage() {
  const deadlines = useTaxStore((state) => state.deadlines)

  const sorted = [...deadlines].sort(
    (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
  )

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Tax obligations</CardTitle>
          <CardDescription>
            All upcoming and past BIR filing deadlines for your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Form</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Due date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount due</TableHead>
                <TableHead className="w-28">
                  <span className="sr-only">Action</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((deadline) => {
                const daysLeft = daysUntil(deadline.dueDate)
                return (
                  <TableRow key={deadline.id}>
                    <TableCell className="font-medium">
                      {deadline.formType}
                    </TableCell>
                    <TableCell>{deadline.title}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(deadline.dueDate)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          statusClass(deadline.status, daysLeft),
                        )}
                      >
                        {statusLabel(deadline.status, daysLeft)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(deadline.amountDue)}
                    </TableCell>
                    <TableCell>
                      {deadline.status !== 'filed' ? (
                        <Button size="sm" variant="outline">
                          File
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          Complete
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
