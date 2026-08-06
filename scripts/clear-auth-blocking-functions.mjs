/**
 * Clears Identity Platform blocking function triggers.
 * Requires Application Default Credentials (firebase login / gcloud auth).
 *
 *   node scripts/clear-auth-blocking-functions.mjs
 */
import { GoogleAuth } from 'google-auth-library'

const projectId = process.env.FIREBASE_PROJECT_ID ?? 'philtax'

const googleAuth = new GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/cloud-platform'],
})

const accessToken = await googleAuth.getAccessToken()

if (!accessToken) {
  throw new Error('Could not obtain access token. Run: npx firebase login')
}

const response = await fetch(
  `https://identitytoolkit.googleapis.com/admin/v2/projects/${projectId}/config?updateMask=blockingFunctions`,
  {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      blockingFunctions: {},
    }),
  },
)

if (!response.ok) {
  const body = await response.text()
  throw new Error(`Failed to clear blocking functions (${response.status}): ${body}`)
}

console.log('Cleared Identity Platform blocking function triggers.')
