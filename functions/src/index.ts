import { initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { GoogleAuth } from 'google-auth-library'
import { onCall, HttpsError as CallableHttpsError } from 'firebase-functions/v2/https'
import { setGlobalOptions } from 'firebase-functions/v2/options'

import {
  markSupportInboxRead,
  onSupportMessageCreated,
  sendSupportReply,
  syncSupportAdmin,
} from './chat.js'
import { requireVerifiedEmailOnSignIn } from './auth-blocking.js'

initializeApp()
setGlobalOptions({ region: 'asia-southeast1' })

export {
  markSupportInboxRead,
  onSupportMessageCreated,
  requireVerifiedEmailOnSignIn,
  sendSupportReply,
  syncSupportAdmin,
}

async function sendVerificationOob(email: string): Promise<void> {
  const projectId = process.env.GCLOUD_PROJECT

  if (!projectId) {
    throw new Error('Missing GCLOUD_PROJECT environment variable.')
  }

  const googleAuth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  })
  const accessToken = await googleAuth.getAccessToken()

  if (!accessToken) {
    throw new Error('Could not obtain access token.')
  }

  const body: Record<string, string> = {
    requestType: 'VERIFY_EMAIL',
    email,
  }

  const continueUrl = process.env.VERIFICATION_CONTINUE_URL
  if (continueUrl) {
    body.continueUrl = continueUrl
  }

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:sendOobCode`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  )

  if (!response.ok) {
    throw new Error(`sendOobCode failed with status ${response.status}`)
  }
}

export const resendVerificationEmail = onCall(async (request) => {
  const email =
    typeof request.data?.email === 'string' ? request.data.email.trim().toLowerCase() : ''

  if (!email) {
    throw new CallableHttpsError('invalid-argument', 'A valid email address is required.')
  }

  try {
    const user = await getAuth().getUserByEmail(email)

    if (user.emailVerified) {
      return {
        message: 'If an account exists for this email, a verification link has been sent.',
      }
    }

    await sendVerificationOob(email)
  } catch (error) {
    // Do not reveal whether the account exists.
    console.error('resendVerificationEmail failed', error)
  }

  return {
    message: 'If an account exists for this email, a verification link has been sent.',
  }
})
