// Scope the shared reviewer login by its immutable Firebase account ID.
export function isAccountingDemo(user: { uid: string } | null | undefined): boolean {
  return user?.uid === 'demo-tester-4c5fdd13-57bb-42f4-8b87-31d1e96e7838'
}

export function signedInDestination(user: { uid: string } | null | undefined, fallback = '/dashboard'): string {
  return isAccountingDemo(user) ? '/accounting' : fallback
}
