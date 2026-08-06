export function getSupportAdminEmails(): string[] {
  return (import.meta.env.VITE_SUPPORT_ADMIN_EMAILS ?? '')
    .split(',')
    .map((email: string) => email.trim().toLowerCase())
    .filter(Boolean)
}

export function isSupportAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return getSupportAdminEmails().includes(email.toLowerCase())
}

export function isSupportAdminUser(
  user: { email: string | null; getIdTokenResult: () => Promise<{ claims: Record<string, unknown> }> } | null,
): Promise<boolean> {
  if (!user?.email) return Promise.resolve(false)

  if (isSupportAdminEmail(user.email)) {
    return Promise.resolve(true)
  }

  return user.getIdTokenResult().then((result) => result.claims.admin === true)
}
