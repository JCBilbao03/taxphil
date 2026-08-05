import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { httpsCallable } from 'firebase/functions'

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { functions } from '@/lib/firebase'

interface ResendVerificationResponse {
  message: string
}

export function ResendVerificationPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)

    try {
      const resendVerification = httpsCallable<{ email: string }, ResendVerificationResponse>(
        functions,
        'resendVerificationEmail',
      )
      const result = await resendVerification({ email })
      setMessage(result.data.message)
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Something went wrong. Please try again.',
      )
    } finally {
      setLoading(false)
    }
  }, [email])

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>Resend verification email</CardTitle>
        <CardDescription>
          If you signed out before verifying your email, enter your address here and we&apos;ll
          send a new verification link.
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {error ? (
            <p
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          ) : null}

          {message ? (
            <p
              role="status"
              className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary"
            >
              {message}
            </p>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-4 border-t-0 bg-transparent">
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Sending...' : 'Resend verification email'}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Already verified?{' '}
            <Link to="/login" className="font-medium text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  )
}
