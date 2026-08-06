import { FirebaseError } from 'firebase/app'

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  'auth/email-already-in-use': 'An account with this email already exists.',
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/operation-not-allowed': 'Email/password sign-in is not enabled.',
  'auth/weak-password': 'Password must be at least 6 characters.',
  'auth/user-disabled': 'This account has been disabled.',
  'auth/user-not-found': 'No account found with this email.',
  'auth/wrong-password': 'Incorrect password. Please try again.',
  'auth/invalid-credential': 'Invalid email or password.',
  'auth/too-many-requests': 'Too many attempts. Please try again later.',
  'auth/requires-recent-login': 'Please sign in again before continuing.',
  'auth/invalid-continue-uri': 'Could not send email. Please try again.',
  'auth/unauthorized-continue-uri':
    'This app domain is not authorized in Firebase. Add it under Authentication → Settings → Authorized domains.',
  'auth/missing-continue-uri': 'Could not send email. Please try again.',
  'auth/permission-denied':
    'Please verify your email before signing in. Check your inbox for the verification link.',
  'auth/internal-error': 'Authentication failed. Please try again.',
  'auth/invalid-action-code': 'This verification link is invalid or has expired.',
  'auth/expired-action-code': 'This verification link has expired. Request a new one.',
}

function parseBlockingFunctionMessage(message: string): string | null {
  const jsonMatch = message.match(/\{[\s\S]*\}/)

  if (!jsonMatch) {
    return null
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as {
      error?: { message?: string }
    }

    return parsed.error?.message ?? null
  } catch {
    return null
  }
}

function isBlockingFunctionError(error: FirebaseError): boolean {
  return (
    error.code === 'auth/error-code:-47' ||
    error.message.includes('Error code: 47') ||
    error.message.includes('BLOCKING_FUNCTION')
  )
}

export function getAuthErrorMessage(error: unknown): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string'
  ) {
    if (error instanceof FirebaseError) {
      if (error.code.startsWith('auth/error-code:') || isBlockingFunctionError(error)) {
        const blockingMessage = parseBlockingFunctionMessage(error.message)

        if (blockingMessage) {
          return blockingMessage
        }

        return AUTH_ERROR_MESSAGES['auth/permission-denied']
      }

      const mapped = AUTH_ERROR_MESSAGES[error.code]

      if (mapped && error.code !== 'auth/permission-denied' && error.code !== 'auth/internal-error') {
        return mapped
      }

      const blockingMessage = parseBlockingFunctionMessage(error.message)

      if (blockingMessage) {
        return blockingMessage
      }

      if (error.message) {
        return error.message
      }
    }

    return AUTH_ERROR_MESSAGES[error.code] ?? 'Something went wrong. Please try again.'
  }

  return 'Something went wrong. Please try again.'
}
