import { ArrowRight, Building2 } from 'lucide-react'
import { ButtonLink } from '@/components/landing/ButtonLink'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import { usePermitStore } from '@/store/usePermitStore'

export function UnpaidPermitCard() {
  const permits = usePermitStore((state) => state.permits)
  const pendingPermits = permits.filter((permit) => permit.status === 'pending')

  if (pendingPermits.length === 0) {
    return null
  }

  const latest = [...pendingPermits].sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
  )[0]

  return (
    <Card className="border-l-4 border-l-deadline-warning">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <CardDescription className="text-xs font-medium uppercase tracking-wider">
              Unpaid permit
            </CardDescription>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Building2 className="size-5 text-muted-foreground" />
              {latest.businessName}
            </CardTitle>
            <CardDescription>
              {latest.lgu} · {latest.year} mayor&apos;s permit awaiting payment
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <p className="text-2xl font-semibold tracking-tight">
          {formatCurrency(latest.amount)}
        </p>
      </CardContent>

      <CardFooter className="flex flex-wrap justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Complete checkout via PayMongo to confirm payment.
        </p>
        <ButtonLink
          to={`/permits/${latest.id}/receipt`}
          size="lg"
          className="min-h-11 gap-2"
        >
          Complete payment
          <ArrowRight className="size-4" />
        </ButtonLink>
      </CardFooter>
    </Card>
  )
}
