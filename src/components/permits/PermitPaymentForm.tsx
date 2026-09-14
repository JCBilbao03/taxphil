import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Loader2 } from 'lucide-react'

import { MAJOR_LGUS } from '@/components/permits/lgu-options'
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
import { createPermitCheckout } from '@/lib/paymongo'
import { getUserProfile } from '@/lib/firestore/user-profile'
import { useAuthUser } from '@/store/useAuthStore'
import type { PermitType } from '@/store/usePermitStore'

const CURRENT_YEAR = 2026

interface PermitPaymentFormProps {
  onError: (message: string | null) => void
}

export function PermitPaymentForm({ onError }: PermitPaymentFormProps) {
  const user = useAuthUser()
  const [businessName, setBusinessName] = useState('')
  const [lgu, setLgu] = useState('')
  const [permitType, setPermitType] = useState<PermitType>('renewal')
  const [year, setYear] = useState(String(CURRENT_YEAR))
  const [amount, setAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [profileLoaded, setProfileLoaded] = useState(false)

  useEffect(() => {
    if (!user?.uid) return

    let cancelled = false

    getUserProfile(user.uid)
      .then((profile) => {
        if (cancelled || !profile?.businessName) return
        setBusinessName((current) => current || (profile.businessName ?? ''))
      })
      .finally(() => {
        if (!cancelled) setProfileLoaded(true)
      })

    return () => {
      cancelled = true
    }
  }, [user?.uid])

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      onError(null)

      const parsedAmount = Number.parseFloat(amount)
      const parsedYear = Number.parseInt(year, 10)

      if (!businessName.trim()) {
        onError('Business name is required.')
        return
      }

      if (!lgu.trim()) {
        onError('City or municipality is required.')
        return
      }

      if (!Number.isFinite(parsedAmount) || parsedAmount < 20) {
        onError('Minimum permit fee is ₱20.')
        return
      }

      if (!Number.isInteger(parsedYear)) {
        onError('Enter a valid permit year.')
        return
      }

      setSubmitting(true)

      try {
        const result = await createPermitCheckout({
          businessName: businessName.trim(),
          lgu: lgu.trim(),
          permitType,
          year: parsedYear,
          amount: parsedAmount,
        })

        window.location.assign(result.checkoutUrl)
      } catch (error: unknown) {
        const message =
          error instanceof Error
            ? error.message
            : 'Could not start checkout. Try again.'
        onError(message)
        setSubmitting(false)
      }
    },
    [amount, businessName, lgu, onError, permitType, year],
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pay mayor&apos;s permit fee</CardTitle>
        <CardDescription>
          Enter your LGU details and amount due. You will be redirected to
          PayMongo to pay via GCash, Maya, or card.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="businessName">Business name</Label>
            <Input
              id="businessName"
              name="businessName"
              value={businessName}
              onChange={(event) => setBusinessName(event.target.value)}
              placeholder="Registered business name"
              className="min-h-11 text-base"
              disabled={submitting || !profileLoaded}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="lgu">City / municipality</Label>
            <Input
              id="lgu"
              name="lgu"
              list="lgu-suggestions"
              value={lgu}
              onChange={(event) => setLgu(event.target.value)}
              placeholder="e.g. Quezon City"
              className="min-h-11 text-base"
              disabled={submitting}
              required
            />
            <datalist id="lgu-suggestions">
              {MAJOR_LGUS.map((city) => (
                <option key={city} value={city} />
              ))}
            </datalist>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="permitType">Permit type</Label>
              <Select
                value={permitType}
                onValueChange={(value) => setPermitType(value as PermitType)}
                disabled={submitting}
              >
                <SelectTrigger id="permitType" className="min-h-11 w-full text-base">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">New permit</SelectItem>
                  <SelectItem value="renewal">Renewal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="year">Permit year</Label>
              <Input
                id="year"
                name="year"
                type="number"
                min={2020}
                max={2035}
                value={year}
                onChange={(event) => setYear(event.target.value)}
                className="min-h-11 text-base"
                disabled={submitting}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Amount due (PHP)</Label>
            <Input
              id="amount"
              name="amount"
              type="number"
              min={20}
              step="0.01"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0.00"
              className="min-h-11 text-base"
              disabled={submitting}
              required
            />
          </div>

          <p className="rounded-md border border-border bg-muted/40 px-4 py-3 text-sm leading-relaxed text-muted-foreground">
            Payments are processed through PayMongo and settle in the TaxPhil
            merchant account. This is not an official LGU eBPLS or city treasurer
            payment portal.
          </p>

          <Button
            type="submit"
            size="lg"
            className="min-h-11 w-full sm:w-auto"
            disabled={submitting}
          >
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Redirecting to checkout…
              </>
            ) : (
              'Proceed to payment'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
