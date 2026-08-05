import type { ActionCodeSettings } from 'firebase/auth'

const CONTINUE_URI_ERROR_CODES = new Set([
  'auth/invalid-continue-uri',
  'auth/unauthorized-continue-uri',
  'auth/missing-continue-uri',
])

let continueUrlRejected = false

export function isContinueUrlError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string' &&
    CONTINUE_URI_ERROR_CODES.has(error.code)
  )
}

export function markContinueUrlRejected(): void {
  continueUrlRejected = true
}

export function getEmailActionSettings(path: string): ActionCodeSettings | null {
  if (continueUrlRejected || typeof window === 'undefined') {
    return null
  }

  try {
    return { url: new URL(path, window.location.origin).href }
  } catch {
    return null
  }
}
