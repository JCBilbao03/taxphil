import {
  get,
  onValue,
  push,
  ref,
  set,
  update,
  type Unsubscribe,
} from 'firebase/database'

import { rtdb } from '@/lib/firebase'

export interface ConversationRecord {
  name: string
  role: string
  avatar: string
  lastMessage: string
  lastMessageAt: number
  unread: number
  online: boolean
}

export interface MessageRecord {
  senderId: string
  senderName: string
  content: string
  createdAt: number
}

export const SUPPORT_CONVERSATION_ID = 'support'

const DEFAULT_CONVERSATIONS: Record<string, ConversationRecord> = {
  support: {
    name: 'TaxPhil Support',
    role: 'Customer Support Team',
    avatar: 'TP',
    lastMessage: 'How can we help you today?',
    lastMessageAt: Date.now() - 3_600_000,
    unread: 0,
    online: true,
  },
}

const DEFAULT_MESSAGES: Record<string, MessageRecord[]> = {
  support: [
    {
      senderId: 'support',
      senderName: 'TaxPhil Support',
      content:
        'Hello! Welcome to TaxPhil. How can we assist you with your tax filing today?',
      createdAt: Date.now() - 3_600_000,
    },
  ],
}

function conversationsPath(userId: string) {
  return `chats/${userId}/conversations`
}

function messagesPath(userId: string, conversationId: string) {
  return `chats/${userId}/messages/${conversationId}`
}

export function normalizeTimestamp(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return Date.now()
}

export function formatRelativeTime(timestamp: unknown): string {
  const date = normalizeTimestamp(timestamp)
  const diffMs = Date.now() - date
  const diffMinutes = Math.floor(diffMs / 60_000)

  if (diffMinutes < 1) return 'Just now'
  if (diffMinutes < 60) return `${diffMinutes} min ago`

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours} hr ago`

  const diffDays = Math.floor(diffHours / 24)
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`

  return new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: 'numeric',
  }).format(date)
}

export async function fetchConversations(
  userId: string,
): Promise<Record<string, ConversationRecord>> {
  const snapshot = await get(ref(rtdb, conversationsPath(userId)))
  return (snapshot.val() as Record<string, ConversationRecord> | null) ?? {}
}

export async function ensureDefaultConversations(userId: string): Promise<void> {
  let existing: Record<string, ConversationRecord> = {}

  try {
    existing = await fetchConversations(userId)
  } catch {
    existing = {}
  }

  const supportExists = Boolean(existing[SUPPORT_CONVERSATION_ID]?.name)

  if (!supportExists) {
    await set(
      ref(rtdb, `${conversationsPath(userId)}/${SUPPORT_CONVERSATION_ID}`),
      DEFAULT_CONVERSATIONS[SUPPORT_CONVERSATION_ID],
    )

    const messagesSnap = await get(
      ref(rtdb, messagesPath(userId, SUPPORT_CONVERSATION_ID)),
    )

    if (!messagesSnap.exists()) {
      for (const message of DEFAULT_MESSAGES[SUPPORT_CONVERSATION_ID] ?? []) {
        await push(
          ref(rtdb, messagesPath(userId, SUPPORT_CONVERSATION_ID)),
          message,
        )
      }
    }
  }
}

export function subscribeToConversations(
  userId: string,
  onData: (conversations: Record<string, ConversationRecord>) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  const convRef = ref(rtdb, conversationsPath(userId))

  return onValue(
    convRef,
    (snapshot) => {
      onData(snapshot.val() ?? {})
    },
    (error) => {
      onError(error)
    },
  )
}

export function subscribeToMessages(
  userId: string,
  conversationId: string,
  onData: (messages: Record<string, MessageRecord>) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  const msgRef = ref(rtdb, messagesPath(userId, conversationId))

  return onValue(
    msgRef,
    (snapshot) => {
      onData(snapshot.val() ?? {})
    },
    (error) => {
      onError(error)
    },
  )
}

export async function sendChatMessage(
  userId: string,
  conversationId: string,
  senderId: string,
  senderName: string,
  content: string,
): Promise<void> {
  const trimmed = content.trim()
  if (!trimmed) return

  const messageRef = push(ref(rtdb, messagesPath(userId, conversationId)))
  const now = Date.now()

  await set(messageRef, {
    senderId,
    senderName,
    content: trimmed,
    createdAt: now,
  })

  await update(ref(rtdb, `${conversationsPath(userId)}/${conversationId}`), {
    lastMessage: trimmed,
    lastMessageAt: now,
  })
}

export async function markConversationRead(
  userId: string,
  conversationId: string,
): Promise<void> {
  await update(ref(rtdb, `${conversationsPath(userId)}/${conversationId}`), {
    unread: 0,
  })
}
