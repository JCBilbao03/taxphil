import {
  permitStatusClass,
  permitStatusLabel,
} from '@/components/permits/permit-status-utils'
import { ButtonLink } from '@/components/landing/ButtonLink'
import { Badge } from '@/components/ui/badge'
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
import { formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { Permit } from '@/store/usePermitStore'

interface PermitListProps {
  permits: Permit[]
}

function PermitTypeLabel({ type }: { type: Permit['permitType'] }) {
  return type === 'new' ? 'New' : 'Renewal'
}

function PermitActions({ permit }: { permit: Permit }) {
  if (permit.status === 'paid') {
    return (
      <ButtonLink
        to={`/permits/${permit.id}/receipt`}
        variant="outline"
        size="sm"
        className="min-h-11"
      >
        View receipt
      </ButtonLink>
    )
  }

  if (permit.status === 'pending') {
    return (
      <ButtonLink
        to={`/permits/${permit.id}/receipt`}
        variant="outline"
        size="sm"
        className="min-h-11"
      >
        Check status
      </ButtonLink>
    )
  }

  return null
}

function PermitMobileCard({ permit }: { permit: Permit }) {
  return (
    <Card className="md:hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <CardTitle className="truncate text-base">{permit.businessName}</CardTitle>
            <CardDescription>
              {permit.lgu} · {permit.year} · <PermitTypeLabel type={permit.permitType} />
            </CardDescription>
          </div>
          <Badge
            variant="outline"
            className={cn('shrink-0', permitStatusClass(permit.status))}
          >
            {permitStatusLabel(permit.status)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-4">
        <p className="text-lg font-semibold tracking-tight">
          {formatCurrency(permit.amount)}
        </p>
        <PermitActions permit={permit} />
      </CardContent>
    </Card>
  )
}

export function PermitList({ permits }: PermitListProps) {
  const sorted = [...permits].sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
  )

  if (sorted.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No permits yet</CardTitle>
          <CardDescription>
            Submit the form above to pay your first mayor&apos;s permit fee.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3 md:hidden">
        {sorted.map((permit) => (
          <PermitMobileCard key={permit.id} permit={permit} />
        ))}
      </div>

      <Card className="hidden md:block">
        <CardHeader>
          <CardTitle>Permit history</CardTitle>
          <CardDescription>
            Your mayor&apos;s permit payments and their current status.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Business</TableHead>
                <TableHead>LGU</TableHead>
                <TableHead>Year</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((permit) => (
                <TableRow key={permit.id}>
                  <TableCell className="max-w-[180px] truncate font-medium">
                    {permit.businessName}
                  </TableCell>
                  <TableCell>{permit.lgu}</TableCell>
                  <TableCell>{permit.year}</TableCell>
                  <TableCell>
                    <PermitTypeLabel type={permit.permitType} />
                  </TableCell>
                  <TableCell>{formatCurrency(permit.amount)}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={permitStatusClass(permit.status)}
                    >
                      {permitStatusLabel(permit.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <PermitActions permit={permit} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
