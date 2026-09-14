import { CheckCircle2, Clock, Loader2 } from 'lucide-react'
import { ButtonLink } from '@/components/landing/ButtonLink'
import {
  paymentChannelLabel,
  permitStatusClass,
  permitStatusLabel,
} from '@/components/permits/permit-status-utils'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { formatCurrency, formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { Permit, PermitPayment } from '@/store/usePermitStore'

interface PermitReceiptCardProps {
  permit: Permit
  payment: PermitPayment | undefined
  waitingForConfirmation: boolean
}

export function PermitReceiptCard({
  permit,
  payment,
  waitingForConfirmation,
}: PermitReceiptCardProps) {
  const isPaid = permit.status === 'paid'

  return (
    <Card className={cn('border-l-4', isPaid ? 'border-l-deadline-safe' : 'border-l-deadline-warning')}>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardDescription className="text-xs font-medium uppercase tracking-wider">
              Mayor&apos;s permit payment
            </CardDescription>
            <CardTitle className="text-xl">{permit.businessName}</CardTitle>
            <CardDescription>
              {permit.lgu} · {permit.year} ·{' '}
              {permit.permitType === 'new' ? 'New permit' : 'Renewal'}
            </CardDescription>
          </div>
          <Badge variant="outline" className={permitStatusClass(permit.status)}>
            {permitStatusLabel(permit.status)}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {waitingForConfirmation ? (
          <div className="flex items-start gap-3 rounded-lg border border-deadline-warning/20 bg-deadline-warning-bg px-4 py-3 text-sm text-deadline-warning">
            <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin" />
            <p>
              Payment received by PayMongo. Waiting for confirmation — this
              usually takes a few seconds.
            </p>
          </div>
        ) : null}

        {!waitingForConfirmation && !isPaid && permit.status === 'pending' ? (
          <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            <Clock className="mt-0.5 size-4 shrink-0" />
            <p>
              Payment is still pending. If you cancelled checkout, start a new
              payment from the permits page.
            </p>
          </div>
        ) : null}

        {isPaid ? (
          <div className="flex items-start gap-3 rounded-lg border border-deadline-safe/20 bg-deadline-safe-bg px-4 py-3 text-sm text-deadline-safe">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
            <p>Payment confirmed. Keep this receipt for your records.</p>
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-border bg-muted/40 p-4">
            <p className="text-xs font-medium text-muted-foreground">Amount paid</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight">
              {formatCurrency(permit.amount)}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-muted/40 p-4">
            <p className="text-xs font-medium text-muted-foreground">Reference</p>
            <p className="mt-1 break-all font-mono text-sm">
              {payment?.referenceNumber ?? '—'}
            </p>
          </div>
        </div>

        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Payment method</dt>
            <dd className="font-medium">
              {payment ? paymentChannelLabel(payment.channel) : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Date</dt>
            <dd className="font-medium">
              {payment?.paidAt
                ? formatDate(payment.paidAt)
                : formatDate(permit.createdAt)}
            </dd>
          </div>
        </dl>

        <p className="text-sm leading-relaxed text-muted-foreground">
          This receipt confirms payment processed via PayMongo. Present your LGU
          requirements separately to your city or municipality — this does not
          replace official eBPLS registration.
        </p>
      </CardContent>

      <CardFooter className="flex flex-wrap gap-3">
        <ButtonLink to="/permits" variant="outline" className="min-h-11">
          Back to permits
        </ButtonLink>
      </CardFooter>
    </Card>
  )
}
