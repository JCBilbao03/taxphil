export function userDocPath(userId: string) {
  return `users/${userId}` as const
}

export function transactionsCollectionPath(userId: string) {
  return `users/${userId}/transactions` as const
}

export function deadlinesCollectionPath(userId: string) {
  return `users/${userId}/deadlines` as const
}
