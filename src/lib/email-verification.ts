import { sendEmailVerification, type User } from 'firebase/auth'

import {
  getEmailActionSettings,
  isContinueUrlError,
  markContinueUrlRejected,
} from '@/lib/email-action-settings'

export async function sendVerificationEmail(user: User): Promise<void> {
  const actionCodeSettings = getEmailActionSettings('/verify-email')

  if (!actionCodeSettings) {
    await sendEmailVerification(user)
    return
  }

  try {
    await sendEmailVerification(user, actionCodeSettings)
  } catch (error) {
    if (!isContinueUrlError(error)) {
      throw error
    }

    markContinueUrlRejected()
    await sendEmailVerification(user)
  }
}
