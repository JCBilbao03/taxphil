import { useCallback, useMemo, useState } from 'react'
import { ChevronLeft, Headphones, Loader2 } from 'lucide-react'

import { ChatComposer } from '@/components/connect/chat/ChatComposer'
import { ChatMessageList } from '@/components/connect/chat/ChatMessageList'
import { ChatThreadHeader } from '@/components/connect/chat/ChatThreadHeader'
import { ConversationSidebar } from '@/components/connect/chat/ConversationSidebar'
import { Button } from '@/components/ui/button'
import { useSendChatMessage, useOpenSupportChat } from '@/hooks/useChatSync'
import { useConnectStore } from '@/store/useConnectStore'
import { cn } from '@/lib/utils'

interface ChatViewProps {
  compact?: boolean
  showExpandLink?: boolean
  className?: string
  fillHeight?: boolean
}

const chatShellClass =
  'flex overflow-hidden rounded-xl border border-border bg-card'

const chatHeightClass =
  'h-[min(520px,calc(100dvh-9.5rem))] min-h-[280px] md:h-[min(640px,calc(100dvh-14rem))] md:min-h-[480px]'

function ChatLoadingSkeleton({
  compact,
  className,
  fillHeight,
}: {
  compact: boolean
  className?: string
  fillHeight?: boolean
}) {
  return (
    <div
      className={cn(
        chatShellClass,
        compact
          ? fillHeight
            ? 'min-h-0 flex-1'
            : 'h-[min(360px,calc(100dvh-12rem))]'
          : chatHeightClass,
        className,
      )}
    >
      {!compact ? (
        <div className="hidden w-72 shrink-0 flex-col border-r border-border bg-muted/15 md:flex">
          <div className="border-b border-border px-4 py-4">
            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
            <div className="mt-2 h-3 w-32 animate-pulse rounded bg-muted/70" />
          </div>
          <div className="space-y-3 p-4">
            <div className="h-16 animate-pulse rounded-xl bg-muted/60" />
          </div>
        </div>
      ) : null}
      <div className="flex flex-1 flex-col items-center justify-center gap-3">
        <Loader2 className="size-6 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading your messages...</p>
      </div>
    </div>
  )
}

export function ChatView({
  compact = false,
  showExpandLink = false,
  className,
  fillHeight = false,
}: ChatViewProps) {
  const conversations = useConnectStore((state) => state.conversations)
  const messages = useConnectStore((state) => state.messages)
  const chatLoading = useConnectStore((state) => state.chatLoading)
  const chatError = useConnectStore((state) => state.chatError)
  const activeConversationId = useConnectStore(
    (state) => state.activeConversationId,
  )
  const setActiveConversation = useConnectStore(
    (state) => state.setActiveConversation,
  )
  const sendMessage = useSendChatMessage()
  const openSupportChat = useOpenSupportChat()

  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [initializing, setInitializing] = useState(false)
  const [mobileShowInbox, setMobileShowInbox] = useState(false)

  const activeConversation = conversations.find(
    (conversation) => conversation.id === activeConversationId,
  )

  const threadMessages = useMemo(
    () => messages.filter((message) => message.conversationId === activeConversationId),
    [messages, activeConversationId],
  )

  const hasMultipleConversations = conversations.length > 1
  const showMobileInbox =
    !compact && hasMultipleConversations && (mobileShowInbox || !activeConversation)

  const handleOpenSupportChat = useCallback(async () => {
    setInitializing(true)
    try {
      await openSupportChat()
      setMobileShowInbox(false)
    } finally {
      setInitializing(false)
    }
  }, [openSupportChat])

  const handleSend = useCallback(async () => {
    const trimmed = draft.trim()
    if (!trimmed || sending) return

    setSending(true)
    try {
      await sendMessage(trimmed)
      setDraft('')
    } finally {
      setSending(false)
    }
  }, [draft, sendMessage, sending])

  const handleSelectConversation = useCallback(
    (id: string) => {
      setActiveConversation(id)
      setMobileShowInbox(false)
    },
    [setActiveConversation],
  )

  if (chatLoading && conversations.length === 0) {
    return (
      <ChatLoadingSkeleton
        compact={compact}
        className={className}
        fillHeight={fillHeight}
      />
    )
  }

  return (
    <div
      className={cn(
        chatShellClass,
        compact
          ? fillHeight
            ? 'min-h-0 flex-1'
            : 'h-[min(360px,calc(100dvh-12rem))]'
          : chatHeightClass,
        className,
      )}
    >
      {!compact ? (
        <ConversationSidebar
          conversations={conversations}
          activeConversationId={activeConversationId}
          chatLoading={chatLoading}
          chatError={chatError}
          initializing={initializing}
          onSelectConversation={handleSelectConversation}
          onOpenSupportChat={() => void handleOpenSupportChat()}
          className={cn(
            hasMultipleConversations ? 'hidden md:flex' : 'hidden',
            showMobileInbox && 'flex w-full md:w-72',
          )}
        />
      ) : null}

      <div
        className={cn(
          'flex min-w-0 flex-1 flex-col bg-card',
          !compact && showMobileInbox && 'hidden md:flex',
        )}
      >
        {activeConversation ? (
          <>
            {!compact && hasMultipleConversations ? (
              <div className="flex items-center border-b border-border px-3 py-2 md:hidden">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="gap-1 px-2"
                  onClick={() => setMobileShowInbox(true)}
                >
                  <ChevronLeft className="size-4" />
                  Inbox
                </Button>
              </div>
            ) : null}

            <ChatThreadHeader
              conversation={activeConversation}
              compact={compact}
              showExpandLink={showExpandLink}
            />

            <ChatMessageList
              messages={threadMessages}
              conversation={activeConversation}
              chatError={chatError}
              compact={compact}
            />

            <ChatComposer
              draft={draft}
              onDraftChange={setDraft}
              onSend={handleSend}
              sending={sending}
              compact={compact}
              placeholder="Message TaxPhil Support..."
            />
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-8 text-center sm:px-6 sm:py-10">
            <div className="flex size-14 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Headphones className="size-7" />
            </div>
            <div className="max-w-sm space-y-1">
              <p className="text-sm font-medium text-foreground">
                Start a conversation
              </p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Connect with TaxPhil Support for help with your tax filing,
                account questions, or technical issues.
              </p>
            </div>
            {chatError ? (
              <p className="max-w-sm rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-xs text-destructive">
                {chatError}
              </p>
            ) : null}
            {chatLoading || initializing ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Opening support chat...
              </div>
            ) : (
              <Button
                type="button"
                size="sm"
                className="w-full max-w-xs"
                onClick={() => void handleOpenSupportChat()}
              >
                Message TaxPhil Support
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
