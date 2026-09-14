import { httpsCallable } from 'firebase/functions'
import {
  get,
  onValue,
  ref,
  type Unsubscribe,
} from 'firebase/database'

import {
  formatRelativeTime,
  normalizeTimestamp,
  subscribeToMessages,
  type MessageRecord,
} from '@/lib/chat'
import { getUserProfile } from '@/lib/firestore/user-profile'
import { auth, functions, rtdb } from '@/lib/firebase'
import type { ChatMessage } from '@/store/useConnectStore'

export interface SupportInboxEntry {
  userId: string
  userEmail: string
  displayName: string
  conversationId: string
  lastMessage: string
  lastMessageAt: number
  unread: number
}

export interface SupportInboxItem extends SupportInboxEntry {
  lastActive: string
}

export interface TaxpayerProfile {
  email?: string
  displayName?: string
  memberSince?: number
}

function mapSupportMessage(
  id: string,
  conversationId: string,
  record: MessageRecord,
  customerUserId: string,
): ChatMessage {
  const createdAt = normalizeTimestamp(record.createdAt)

  return {
    id,
    conversationId,
    senderId: record.senderId,
    senderName: record.senderName,
    content: record.content,
    timestamp: new Date(createdAt).toISOString(),
    isOwn: record.senderId !== customerUserId,
  }
}

export function subscribeToSupportInbox(
  onData: (items: SupportInboxItem[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  const inboxRef = ref(rtdb, 'supportInbox')

  return onValue(
    inboxRef,
    (snapshot) => {
      const records = snapshot.val() as Record<string, SupportInboxEntry> | null
      const items = Object.entries(records ?? {})
        .map(([userId, entry]) => ({
          ...entry,
          userId,
          lastActive: formatRelativeTime(entry.lastMessageAt),
        }))
        .sort((a, b) => b.lastMessageAt - a.lastMessageAt)

      onData(items)
    },
    (error) => onError(error),
  )
}

export function subscribeToUserSupportMessages(
  userId: string,
  conversationId: string,
  onData: (messages: ChatMessage[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return subscribeToMessages(
    userId,
    conversationId,
    (records) => {
      const mapped = Object.entries(records)
        .map(([id, record]) =>
          mapSupportMessage(id, conversationId, record, userId),
        )
        .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))

      onData(mapped)
    },
    onError,
  )
}

export async function syncSupportAdminAccess(): Promise<void> {
  const syncSupportAdmin = httpsCallable(functions, 'syncSupportAdmin')
  await syncSupportAdmin()
  await auth.currentUser?.getIdToken(true)
}

export async function sendSupportReply(
  userId: string,
  conversationId: string,
  content: string,
): Promise<void> {
  const reply = httpsCallable<
    { userId: string; conversationId: string; content: string },
    { success: boolean }
  >(functions, 'sendSupportReply')

  await reply({ userId, conversationId, content })
}

export async function markSupportInboxRead(userId: string): Promise<void> {
  const markRead = httpsCallable<{ userId: string }, { success: boolean }>(
    functions,
    'markSupportInboxRead',
  )

  await markRead({ userId })
}

export async function fetchTaxpayerProfile(
  userId: string,
): Promise<TaxpayerProfile | null> {
  const firestoreProfile = await getUserProfile(userId)

  if (firestoreProfile) {
    return {
      email: firestoreProfile.email,
      displayName: firestoreProfile.fullName || firestoreProfile.displayName,
      memberSince: firestoreProfile.createdAt.toMillis(),
    }
  }

  const snapshot = await get(ref(rtdb, `users/${userId}`))
  const legacyProfile = snapshot.val() as {
    email?: string
    displayName?: string
    createdAt?: unknown
  } | null

  if (!legacyProfile) return null

  return {
    email: legacyProfile.email,
    displayName: legacyProfile.displayName,
    memberSince: normalizeTimestamp(legacyProfile.createdAt),
  }
}

export async function getSupportInboxSnapshot(): Promise<SupportInboxItem[]> {
  const snapshot = await get(ref(rtdb, 'supportInbox'))
  const records = snapshot.val() as Record<string, SupportInboxEntry> | null

  return Object.entries(records ?? {})
    .map(([userId, entry]) => ({
      ...entry,
      userId,
      lastActive: formatRelativeTime(entry.lastMessageAt),
    }))
    .sort((a, b) => b.lastMessageAt - a.lastMessageAt)
}
