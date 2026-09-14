import { useEffect, useRef } from 'react'
import { Headphones } from 'lucide-react'

import {
  formatMessageTime,
  groupMessagesByDate,
  shouldShowSenderHeader,
} from '@/components/connect/chat/chat-utils'
import type { ChatMessage, Conversation } from '@/store/useConnectStore'
import { cn } from '@/lib/utils'

interface ChatMessageListProps {
  messages: ChatMessage[]
  conversation: Conversation
  chatError: string | null
  compact?: boolean
  perspective?: 'customer' | 'agent'
}

function linkifyContent(content: string) {
  const urlPattern = /(https?:\/\/[^\s]+)/g
  const parts = content.split(urlPattern)

  return parts.map((part, index) => {
    if (/^https?:\/\//.test(part)) {
      return (
        <a
          key={`${part}-${index}`}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2"
        >
          {part}
        </a>
      )
    }

    return part
  })
}

export function ChatMessageList({
  messages,
  conversation,
  chatError,
  compact = false,
  perspective = 'customer',
}: ChatMessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messageGroups = groupMessagesByDate(messages)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (chatError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-8">
        <p className="max-w-sm rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-center text-sm text-destructive">
          {chatError}
        </p>
      </div>
    )
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-10 text-center">
        <div className="flex size-14 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Headphones className="size-7" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">
            {perspective === 'agent'
              ? `Conversation with ${conversation.name}`
              : `You're connected with ${conversation.name}`}
          </p>
          <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">
            {perspective === 'agent'
              ? 'Review the taxpayer thread below and send a reply when ready.'
              : 'Ask about BIR filing, deadlines, or your account. We typically reply within a few hours on business days.'}
          </p>
        </div>
        {perspective === 'customer' ? (
          <div className="flex items-center gap-1.5 rounded-md bg-muted/60 px-3 py-1.5 text-[11px] text-muted-foreground">
            Start the conversation below
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex-1 overflow-y-auto overscroll-contain bg-muted/10 touch-pan-y',
        compact ? 'px-2.5 py-2.5' : 'px-3 py-3 sm:px-4 sm:py-4',
      )}
    >
      {messageGroups.map((group) => (
        <div key={group.dateLabel} className="mb-4 last:mb-0">
          <div className="mb-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-border/80" />
            <span className="shrink-0 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              {group.dateLabel}
            </span>
            <div className="h-px flex-1 bg-border/80" />
          </div>

          <div className="space-y-1">
            {group.messages.map((message, index) => {
              const previousMessage =
                index > 0 ? group.messages[index - 1] : undefined
              const showSender = shouldShowSenderHeader(message, previousMessage)
              const isGrouped =
                !message.isOwn &&
                previousMessage &&
                !previousMessage.isOwn &&
                previousMessage.senderId === message.senderId

              return (
                <div
                  key={message.id}
                  className={cn(
                    'flex gap-2',
                    message.isOwn ? 'justify-end' : 'justify-start',
                    isGrouped ? 'mt-0.5' : 'mt-3 first:mt-0',
                  )}
                >
                  {!message.isOwn ? (
                    <div
                      className={cn(
                        'flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground',
                        !showSender && 'invisible',
                      )}
                      aria-hidden={!showSender}
                    >
                      {conversation.avatar}
                    </div>
                  ) : null}

                  <div
                    className={cn(
                      'max-w-[min(88%,420px)] sm:max-w-[min(80%,420px)]',
                      message.isOwn ? 'items-end' : 'items-start',
                    )}
                  >
                    {showSender && !message.isOwn ? (
                      <p className="mb-1 px-1 text-[11px] font-medium text-muted-foreground">
                        {message.senderName}
                      </p>
                    ) : null}

                    <div
                      className={cn(
                        'rounded-lg px-4 py-2 text-sm leading-relaxed',
                        message.isOwn
                          ? 'rounded-br-md bg-primary text-primary-foreground'
                          : 'rounded-bl-md border border-border bg-card text-foreground',
                      )}
                    >
                      <p className="whitespace-pre-wrap break-words">
                        {linkifyContent(message.content)}
                      </p>
                      <p
                        className={cn(
                          'mt-1.5 text-[10px]',
                          message.isOwn
                            ? 'text-primary-foreground/65'
                            : 'text-muted-foreground',
                        )}
                      >
                        {formatMessageTime(message.timestamp)}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
      <div ref={messagesEndRef} />
    </div>
  )
}
