import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { applyActionCode } from 'firebase/auth'

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getAuthErrorMessage } from '@/lib/auth-errors'
import { auth } from '@/lib/firebase'
import { useAuthLoading, useAuthStore, useAuthUser } from '@/store/useAuthStore'

export function VerifyEmailPage() {
  const user = useAuthUser()
  const loading = useAuthLoading()
  const resendVerificationEmail = useAuthStore((state) => state.resendVerificationEmail)
  const reloadUser = useAuthStore((state) => state.reloadUser)
  const signOut = useAuthStore((state) => state.signOut)
  const navigate = useNavigate()
  const handledOobCode = useRef(false)

  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [processingLink, setProcessingLink] = useState(false)

  const completeVerification = useCallback(async () => {
    const verified = await reloadUser()

    if (verified) {
      navigate('/dashboard', { replace: true })
      return true
    }

    return false
  }, [navigate, reloadUser])

  useEffect(() => {
    if (handledOobCode.current) {
      return
    }

    const params = new URLSearchParams(window.location.search)
    const mode = params.get('mode')
    const oobCode = params.get('oobCode')

    if (mode !== 'verifyEmail' || !oobCode) {
      return
    }

    handledOobCode.current = true
    setProcessingLink(true)
    setError('')

    void (async () => {
      try {
        await applyActionCode(auth, oobCode)
        window.history.replaceState({}, '', '/verify-email')

        const verified = await completeVerification()

        if (!verified) {
          setMessage('Email verified. Confirm below to continue to your dashboard.')
        }
      } catch (linkError) {
        setError(getAuthErrorMessage(linkError))
        window.history.replaceState({}, '', '/verify-email')
      } finally {
        setProcessingLink(false)
      }
    })()
  }, [completeVerification])

  const handleResend = useCallback(async () => {
    setError('')
    setMessage('')

    try {
      await resendVerificationEmail()
      setMessage('Verification email sent. Check your inbox and spam folder.')
    } catch (resendError) {
      setError(
        resendError instanceof Error
          ? resendError.message
          : 'Something went wrong. Please try again.',
      )
    }
  }, [resendVerificationEmail])

  const handleCheckVerification = useCallback(async () => {
    setError('')
    setMessage('')

    try {
      const verified = await completeVerification()

      if (!verified) {
        setError('Your email is not verified yet. Click the link in the email we sent you.')
      }
    } catch (checkError) {
      setError(getAuthErrorMessage(checkError))
    }
  }, [completeVerification])

  const handleSignOut = useCallback(async () => {
    setError('')

    try {
      await signOut()
      navigate('/login', { replace: true })
    } catch (signOutError) {
      setError(getAuthErrorMessage(signOutError))
    }
  }, [navigate, signOut])

  const isBusy = loading || processingLink

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>Verify your email</CardTitle>
        <CardDescription>
          We sent a verification link to{' '}
          <span className="font-medium text-foreground">{user?.email ?? 'your email'}</span>.
          Please confirm your address before accessing your account.
        </CardDescription>
      </CardHeader>

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

        <p className="text-sm text-muted-foreground">
          After clicking the link in your email, return here and confirm verification to continue.
        </p>
      </CardContent>

      <CardFooter className="flex flex-col gap-3 border-t-0 bg-transparent">
        <Button
          type="button"
          className="w-full"
          disabled={isBusy}
          onClick={handleCheckVerification}
        >
          {isBusy ? 'Checking...' : "I've verified my email"}
        </Button>

        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={isBusy}
          onClick={handleResend}
        >
          Resend verification email
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Wrong account?{' '}
          <button
            type="button"
            className="font-medium text-primary hover:underline"
            onClick={handleSignOut}
            disabled={isBusy}
          >
            Sign out
          </button>{' '}
          or{' '}
          <Link to="/login" className="font-medium text-primary hover:underline">
            sign in
          </Link>
        </p>
      </CardFooter>
    </Card>
  )
}
