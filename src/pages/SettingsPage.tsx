import { useCallback, useEffect, useState } from 'react'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  getUserProfile,
  updateUserProfile,
  updateUserRegistration,
} from '@/lib/firestore/user-profile'
import { useAuthUser } from '@/store/useAuthStore'

interface ProfileFormState {
  fullName: string
  tin: string
  businessName: string
  taxType: string
  rdo: string
}

const emptyForm: ProfileFormState = {
  fullName: '',
  tin: '',
  businessName: '',
  taxType: '',
  rdo: '',
}

export function SettingsPage() {
  const user = useAuthUser()
  const [form, setForm] = useState<ProfileFormState>(emptyForm)
  const [loading, setLoading] = useState(true)
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingRegistration, setSavingRegistration] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user?.uid) {
      setForm(emptyForm)
      setLoading(false)
      return
    }

    let cancelled = false

    void getUserProfile(user.uid)
      .then((profile) => {
        if (cancelled) return

        setForm({
          fullName: profile?.fullName ?? user.displayName ?? '',
          tin: profile?.tin ?? '',
          businessName: profile?.businessName ?? '',
          taxType: profile?.taxType ?? '',
          rdo: profile?.rdo ?? '',
        })
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Failed to load profile',
          )
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [user?.displayName, user?.uid])

  const updateField = useCallback(
    (field: keyof ProfileFormState, value: string) => {
      setForm((current) => ({ ...current, [field]: value }))
    },
    [],
  )

  const handleSaveProfile = useCallback(async () => {
    if (!user?.uid) return

    setSavingProfile(true)
    setMessage(null)
    setError(null)

    try {
      await updateUserProfile(
        user.uid,
        {
          email: user.email ?? '',
          displayName: user.displayName ?? form.fullName,
        },
        {
          fullName: form.fullName,
          tin: form.tin,
          businessName: form.businessName,
        },
      )
      setMessage('Profile saved.')
    } catch (saveError: unknown) {
      setError(
        saveError instanceof Error ? saveError.message : 'Failed to save profile',
      )
    } finally {
      setSavingProfile(false)
    }
  }, [form.businessName, form.fullName, form.tin, user?.displayName, user?.email, user?.uid])

  const handleUpdateRegistration = useCallback(async () => {
    if (!user?.uid) return

    setSavingRegistration(true)
    setMessage(null)
    setError(null)

    try {
      await updateUserRegistration(
        user.uid,
        {
          email: user.email ?? '',
          displayName: user.displayName ?? form.fullName,
        },
        {
          taxType: form.taxType,
          rdo: form.rdo,
        },
      )
      setMessage('Tax registration updated.')
    } catch (saveError: unknown) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Failed to update registration',
      )
    } finally {
      setSavingRegistration(false)
    }
  }, [form.fullName, form.rdo, form.taxType, user?.displayName, user?.email, user?.uid])

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {message ? (
        <p className="rounded-md border border-deadline-safe/20 bg-deadline-safe-bg px-4 py-3 text-sm text-deadline-safe">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-md border border-deadline-urgent/20 bg-deadline-urgent-bg px-4 py-3 text-sm text-deadline-urgent">
          {error}
        </p>
      ) : null}

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>
            Your registered taxpayer information with the BIR.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full name</Label>
              <Input
                id="fullName"
                placeholder="Your full name"
                value={form.fullName}
                disabled={loading}
                onChange={(event) => updateField('fullName', event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tin">TIN</Label>
              <Input
                id="tin"
                placeholder="000-000-000-000"
                value={form.tin}
                disabled={loading}
                onChange={(event) => updateField('tin', event.target.value)}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="businessName">Registered business name</Label>
              <Input
                id="businessName"
                placeholder="Business or trade name"
                value={form.businessName}
                disabled={loading}
                onChange={(event) =>
                  updateField('businessName', event.target.value)
                }
              />
            </div>
          </div>
          <Button
            disabled={loading || savingProfile}
            onClick={() => void handleSaveProfile()}
          >
            {savingProfile ? 'Saving…' : 'Save profile'}
          </Button>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Tax registration</CardTitle>
          <CardDescription>
            Configure your taxpayer type and applicable BIR forms.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="taxType">Taxpayer type</Label>
            <Input
              id="taxType"
              placeholder="e.g. Self-Employed / Professional"
              value={form.taxType}
              disabled={loading}
              onChange={(event) => updateField('taxType', event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rdo">Revenue District Office (RDO)</Label>
            <Input
              id="rdo"
              placeholder="e.g. RDO 39 — South QC"
              value={form.rdo}
              disabled={loading}
              onChange={(event) => updateField('rdo', event.target.value)}
            />
          </div>
          <Separator />
          <p className="text-sm text-muted-foreground">
            TaxPhil auto-calculates 2551Q (Percentage Tax) and 1701Q (Quarterly
            Income Tax) based on your logged transactions.
          </p>
          <Button
            variant="outline"
            disabled={loading || savingRegistration}
            onClick={() => void handleUpdateRegistration()}
          >
            {savingRegistration ? 'Updating…' : 'Update registration'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
