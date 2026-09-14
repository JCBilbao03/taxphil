export function userDocPath(userId: string) {
  return `users/${userId}` as const
}

export function transactionsCollectionPath(userId: string) {
  return `users/${userId}/transactions` as const
}

export function deadlinesCollectionPath(userId: string) {
  return `users/${userId}/deadlines` as const
}

export function permitsCollectionPath(userId: string) {
  return `users/${userId}/permits` as const
}

export function paymentsCollectionPath(userId: string) {
  return `users/${userId}/payments` as const
}
