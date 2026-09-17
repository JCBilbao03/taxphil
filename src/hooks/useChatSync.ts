import { FirebaseError } from 'firebase/app'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'

import {
  ensureDefaultConversations,
  fetchConversations,
  formatRelativeTime,
  markConversationRead,
  normalizeTimestamp,
  sendChatMessage,
  subscribeToConversations,
  subscribeToMessages,
  SUPPORT_CONVERSATION_ID,
  type ConversationRecord,
  type MessageRecord,
} from '@/lib/chat'
import { auth } from '@/lib/firebase'
import { useAuthUser } from '@/store/useAuthStore'
import {
  useConnectStore,
  type ChatMessage,
  type Conversation,
} from '@/store/useConnectStore'

function mapConversation(
  id: string,
  record: ConversationRecord,
): Conversation {
  return {
    id,
    name: record.name,
    role: record.role,
    avatar: record.avatar,
    lastMessage: record.lastMessage,
    lastActive: formatRelativeTime(record.lastMessageAt),
    unread: record.unread ?? 0,
    online: false, // No advisor presence service is configured; stored legacy flags are not presence.
  }
}

function mapMessage(
  id: string,
  conversationId: string,
  record: MessageRecord,
  currentUserId: string,
): ChatMessage {
  const createdAt = normalizeTimestamp(record.createdAt)

  return {
    id,
    conversationId,
    senderId: record.senderId,
    senderName: record.senderName,
    content: record.content,
    timestamp: new Date(createdAt).toISOString(),
    isOwn: record.senderId === currentUserId,
  }
}

function sortConversations(conversations: Conversation[]): Conversation[] {
  return [...conversations].sort((a, b) => {
    const supportFirst =
      (a.id === SUPPORT_CONVERSATION_ID ? 0 : 1) -
      (b.id === SUPPORT_CONVERSATION_ID ? 0 : 1)
    if (supportFirst !== 0) return supportFirst
    return a.name.localeCompare(b.name)
  })
}

function mapConversationRecords(
  records: Record<string, ConversationRecord>,
): Conversation[] {
  return sortConversations(
    Object.entries(records).map(([id, record]) => mapConversation(id, record)),
  )
}

function getFirebaseErrorMessage(error: unknown): string {
  if (error instanceof FirebaseError) {
    if (error.code === 'PERMISSION_DENIED') {
      return 'Chat access denied. Try signing out and back in after verifying your email.'
    }
    return error.message
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'Failed to initialize chat'
}

async function refreshVerifiedAuthToken(): Promise<void> {
  const currentUser = auth.currentUser
  if (!currentUser) return

  await currentUser.reload()
  if (!currentUser.emailVerified) return

  await currentUser.getIdToken(true)
}

async function syncConversationsToStore(userId: string): Promise<Conversation[]> {
  const records = await fetchConversations(userId)
  if (auth.currentUser?.uid !== userId) return []
  const mapped = mapConversationRecords(records)
  useConnectStore.getState().setConversations(mapped)

  if (mapped.length > 0) {
    const currentId = useConnectStore.getState().activeConversationId
    const activeExists = mapped.some((conversation) => conversation.id === currentId)
    if (!activeExists) {
      useConnectStore
        .getState()
        .setActiveConversation(mapped[0]?.id ?? SUPPORT_CONVERSATION_ID)
    }
  }

  return mapped
}

export function useChatSync() {
  const { pathname } = useLocation()
  const widgetOpen = useConnectStore((state) => state.isWidgetOpen)
  const activeMode = useConnectStore((state) => state.activeMode)
  const [documentVisible, setDocumentVisible] = useState(() => document.visibilityState === 'visible')
  useEffect(() => {
    const onVisibility = () => setDocumentVisible(document.visibilityState === 'visible')
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])
  const conversationVisible = documentVisible && activeMode === 'chat' && (widgetOpen || pathname === '/connect')
  const user = useAuthUser()
  const activeConversationId = useConnectStore(
    (state) => state.activeConversationId,
  )
  const setChatLoading = useConnectStore((state) => state.setChatLoading)
  const setChatError = useConnectStore((state) => state.setChatError)
  const setConversations = useConnectStore((state) => state.setConversations)
  const setMessages = useConnectStore((state) => state.setMessages)
  const setActiveConversation = useConnectStore(
    (state) => state.setActiveConversation,
  )
  const hasSetDefaultConversation = useRef(false)

  useEffect(() => {
    hasSetDefaultConversation.current = false
  }, [user?.uid])

  const initializeChat = useCallback(async (userId: string) => {
    await refreshVerifiedAuthToken()
    await ensureDefaultConversations(userId)
    await syncConversationsToStore(userId)
  }, [])

  useEffect(() => {
    if (!user?.uid || !user.emailVerified) {
      setConversations([])
      setMessages([])
      setChatLoading(false)
      return
    }

    let cancelled = false
    const userId = user.uid

    setChatLoading(true)
    setChatError(null)

    void initializeChat(userId)
      .catch((error: unknown) => {
        if (!cancelled) {
          setChatError(getFirebaseErrorMessage(error))
        }
      })
      .finally(() => {
        if (!cancelled) {
          setChatLoading(false)
        }
      })

    const unsubscribeConversations = subscribeToConversations(
      userId,
      (records) => {
        if (cancelled) return

        const mapped = mapConversationRecords(records)
        setConversations(mapped)

        if (!hasSetDefaultConversation.current && mapped.length > 0) {
          const currentId = useConnectStore.getState().activeConversationId
          const activeExists = mapped.some((c) => c.id === currentId)
          if (!activeExists) {
            setActiveConversation(mapped[0].id)
          }
          hasSetDefaultConversation.current = true
        }
      },
      (error) => {
        if (!cancelled) {
          setChatError(error.message)
        }
      },
    )

    return () => {
      cancelled = true
      unsubscribeConversations()
    }
  }, [
    user?.uid,
    user?.emailVerified,
    initializeChat,
    setActiveConversation,
    setChatError,
    setChatLoading,
    setConversations,
    setMessages,
  ])

  useEffect(() => {
    if (!user?.uid || !user.emailVerified || !activeConversationId) {
      setMessages([])
      return
    }

    const userId = user.uid

    const unsubscribeMessages = subscribeToMessages(
      userId,
      activeConversationId,
      (records) => {
        const mapped = Object.entries(records)
          .map(([id, record]) =>
            mapMessage(id, activeConversationId, record, userId),
          )
          .sort(
            (a, b) =>
              Date.parse(a.timestamp) - Date.parse(b.timestamp),
          )

        setMessages(mapped)
        if (conversationVisible) {
          void markConversationRead(userId, activeConversationId).catch(() => { /* Retry when the thread is viewed again. */ })
        }
      },
      (error) => {
        setChatError(error.message)
      },
    )

    return unsubscribeMessages
  }, [user?.uid, user?.emailVerified, activeConversationId, conversationVisible, setChatError, setMessages])
}

export function useSendChatMessage() {
  const user = useAuthUser()
  const activeConversationId = useConnectStore(
    (state) => state.activeConversationId,
  )
  const setChatError = useConnectStore((state) => state.setChatError)

  return async (content: string) => {
    if (!user?.uid) {
      setChatError('You must be signed in to send messages.')
      return false
    }

    const conversationId =
      activeConversationId || SUPPORT_CONVERSATION_ID

    try {
      await refreshVerifiedAuthToken()
      await sendChatMessage(
        user.uid,
        conversationId,
        user.uid,
        user.displayName ?? 'You',
        content,
      )
      setChatError(null)
      return true
    } catch (error: unknown) {
      setChatError(getFirebaseErrorMessage(error))
      return false
    }
  }
}

export function useInitializeChat() {
  const setChatError = useConnectStore((state) => state.setChatError)
  const setChatLoading = useConnectStore((state) => state.setChatLoading)

  return useCallback(async () => {
    const currentUser = auth.currentUser

    if (!currentUser) {
      setChatError('You must be signed in to start chat.')
      return false
    }

    setChatLoading(true)
    setChatError(null)

    try {
      await currentUser.reload()

      if (!currentUser.emailVerified) {
        setChatError('Verify your email before using chat.')
        return false
      }

      await currentUser.getIdToken(true)
      await ensureDefaultConversations(currentUser.uid)
      const conversations = await syncConversationsToStore(currentUser.uid)

      if (conversations.length === 0) {
        setChatError('Could not load support chat. Please try again.')
        return false
      }

      useConnectStore
        .getState()
        .setActiveConversation(SUPPORT_CONVERSATION_ID)

      return true
    } catch (error: unknown) {
      setChatError(getFirebaseErrorMessage(error))
      return false
    } finally {
      setChatLoading(false)
    }
  }, [setChatError, setChatLoading])
}

export function useOpenSupportChat() {
  const initializeChat = useInitializeChat()
  const setActiveMode = useConnectStore((state) => state.setActiveMode)

  return useCallback(async () => {
    setActiveMode('chat')
    return initializeChat()
  }, [initializeChat, setActiveMode])
}
