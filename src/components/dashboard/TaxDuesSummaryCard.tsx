import { CalendarClock, ArrowRight } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useTaxStore } from '@/store/useTaxStore'
import { daysUntil, formatCurrency, formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'

function getDeadlineStyles(status: string, daysLeft: number) {
  if (status === 'overdue' || daysLeft < 0) {
    return {
      badge: 'bg-deadline-urgent-bg text-deadline-urgent border-deadline-urgent/20',
      accent: 'border-l-deadline-urgent',
      label: 'Overdue',
    }
  }
  if (status === 'due_soon' || daysLeft <= 14) {
    return {
      badge: 'bg-deadline-warning-bg text-deadline-warning border-deadline-warning/20',
      accent: 'border-l-deadline-warning',
      label: daysLeft === 0 ? 'Due today' : `${daysLeft} days left`,
    }
  }
  return {
    badge: 'bg-deadline-safe-bg text-deadline-safe border-deadline-safe/20',
    accent: 'border-l-deadline-safe',
    label: `${daysLeft} days left`,
  }
}

export function TaxDuesSummaryCard() {
  const nextDeadline = useTaxStore((state) => state.nextDeadline())

  if (!nextDeadline) {
    return (
      <Card className="border-l-4 border-l-deadline-safe shadow-sm">
        <CardHeader>
          <CardTitle>All caught up</CardTitle>
          <CardDescription>
            No upcoming BIR deadlines at the moment.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const daysLeft = daysUntil(nextDeadline.dueDate)
  const styles = getDeadlineStyles(nextDeadline.status, daysLeft)

  return (
    <Card
      className={cn(
        'border-l-4 shadow-sm ring-foreground/5',
        styles.accent,
      )}
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <CardDescription className="text-xs font-medium uppercase tracking-wider">
              Next BIR Deadline
            </CardDescription>
            <CardTitle className="text-xl">{nextDeadline.title}</CardTitle>
          </div>
          <Badge variant="outline" className={styles.badge}>
            {styles.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-border bg-muted/40 p-4">
            <p className="text-xs font-medium text-muted-foreground">
              Amount due
            </p>
            <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
              {formatCurrency(nextDeadline.amountDue)}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-muted/40 p-4">
            <p className="text-xs font-medium text-muted-foreground">
              Due date
            </p>
            <p className="mt-1 flex items-center gap-2 text-base font-medium text-foreground">
              <CalendarClock className="size-4 text-muted-foreground" />
              {formatDate(nextDeadline.dueDate)}
            </p>
          </div>
        </div>
      </CardContent>

      <CardFooter className="justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Form {nextDeadline.formType} · Filed electronically via eBIR
        </p>
        <Button size="lg" className="gap-2">
          File Now
          <ArrowRight className="size-4" />
        </Button>
      </CardFooter>
    </Card>
  )
}
