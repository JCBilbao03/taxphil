import { sendPasswordResetEmail } from 'firebase/auth'

import {
  getEmailActionSettings,
  isContinueUrlError,
  markContinueUrlRejected,
} from '@/lib/email-action-settings'
import { auth } from '@/lib/firebase'

export async function sendPasswordReset(email: string): Promise<void> {
  const actionCodeSettings = getEmailActionSettings('/login')

  if (!actionCodeSettings) {
    await sendPasswordResetEmail(auth, email)
    return
  }

  try {
    await sendPasswordResetEmail(auth, email, actionCodeSettings)
  } catch (error) {
    if (!isContinueUrlError(error)) {
      throw error
    }

    markContinueUrlRejected()
    await sendPasswordResetEmail(auth, email)
  }
}
