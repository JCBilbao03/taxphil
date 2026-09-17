import { useCallback, useEffect, useRef, useState } from 'react'

import {
  markSupportInboxRead,
  sendSupportReply,
  subscribeToSupportInbox,
  subscribeToUserSupportMessages,
  syncSupportAdminAccess,
  type SupportInboxItem,
} from '@/lib/support-admin'
import { SUPPORT_CONVERSATION_ID } from '@/lib/chat'
import type { ChatMessage } from '@/store/useConnectStore'

interface UseSupportAdminResult {
  inbox: SupportInboxItem[]
  messages: ChatMessage[]
  selectedUserId: string | null
  loading: boolean
  syncing: boolean
  error: string | null
  selectUser: (userId: string) => void
  sendReply: (content: string) => Promise<boolean>
  sending: boolean
}

export function useSupportAdmin(): UseSupportAdminResult {
  const [inbox, setInbox] = useState<SupportInboxItem[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const hasSynced = useRef(false)

  useEffect(() => {
    if (hasSynced.current) return
    hasSynced.current = true

    void syncSupportAdminAccess()
      .catch((syncError: unknown) => {
        setError(
          syncError instanceof Error
            ? syncError.message
            : 'Failed to activate support admin access',
        )
      })
      .finally(() => {
        setSyncing(false)
      })
  }, [])

  useEffect(() => {
    if (syncing) return

    setLoading(true)

    const unsubscribe = subscribeToSupportInbox(
      (items) => {
        setInbox(items)
        setLoading(false)

        setSelectedUserId((current) => current ?? items[0]?.userId ?? null)
      },
      (subscribeError) => {
        setError(subscribeError.message)
        setLoading(false)
      },
    )

    return unsubscribe
  }, [syncing])

  useEffect(() => {
    if (!selectedUserId) {
      setMessages([])
      return
    }

    void markSupportInboxRead(selectedUserId).catch(() => {
      // Non-blocking
    })

    const unsubscribe = subscribeToUserSupportMessages(
      selectedUserId,
      SUPPORT_CONVERSATION_ID,
      setMessages,
      (subscribeError) => {
        setError(subscribeError.message)
      },
    )

    return unsubscribe
  }, [selectedUserId])

  const selectUser = useCallback((userId: string) => {
    setSelectedUserId(userId)
    setError(null)
  }, [])

  const sendReply = useCallback(
    async (content: string) => {
      if (!selectedUserId) return false

      setSending(true)
      setError(null)

      try {
        await sendSupportReply(
          selectedUserId,
          SUPPORT_CONVERSATION_ID,
          content,
        )
        return true
      } catch (replyError: unknown) {
        setError(
          replyError instanceof Error
            ? replyError.message
            : 'Failed to send reply',
        )
        return false
      } finally {
        setSending(false)
      }
    },
    [selectedUserId],
  )

  return {
    inbox,
    messages,
    selectedUserId,
    loading,
    syncing,
    error,
    selectUser,
    sendReply,
    sending,
  }
}
