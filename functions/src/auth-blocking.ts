import { beforeUserSignedIn } from 'firebase-functions/v2/identity'

/**
 * Passthrough blocking function required while Identity Platform still has a
 * beforeSignIn trigger registered. Email verification is enforced client-side
 * via RequireVerifiedEmail — this function must not throw during signup.
 */
export const requireVerifiedEmailOnSignIn = beforeUserSignedIn(
  { region: 'asia-southeast1' },
  async () => {
    return
  },
)
