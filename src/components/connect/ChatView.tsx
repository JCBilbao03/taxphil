import { useCallback, useMemo, useRef, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Maximize2,
  Paperclip,
  Send,
  Smile,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useConnectStore } from '@/store/useConnectStore'
import { cn } from '@/lib/utils'

function formatMessageTime(timestamp: string) {
  return new Intl.DateTimeFormat('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(timestamp))
}

interface ChatViewProps {
  compact?: boolean
}

export function ChatView({ compact = false }: ChatViewProps) {
  const conversations = useConnectStore((state) => state.conversations)
  const messages = useConnectStore((state) => state.messages)
  const activeConversationId = useConnectStore(
    (state) => state.activeConversationId,
  )
  const setActiveConversation = useConnectStore(
    (state) => state.setActiveConversation,
  )
  const sendMessage = useConnectStore((state) => state.sendMessage)

  const [draft, setDraft] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const activeConversation = conversations.find(
    (c) => c.id === activeConversationId,
  )

  const threadMessages = useMemo(
    () =>
      messages.filter((m) => m.conversationId === activeConversationId),
    [messages, activeConversationId],
  )

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [threadMessages])

  const handleSend = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault()
      sendMessage(draft)
      setDraft('')
    },
    [draft, sendMessage],
  )

  return (
    <div
      className={cn(
        'flex overflow-hidden rounded-xl border border-border bg-white shadow-sm',
        compact ? 'h-[420px]' : 'h-[calc(100vh-16rem)] min-h-[520px]',
      )}
    >
      {/* Conversation list */}
      <div
        className={cn(
          'flex shrink-0 flex-col border-r border-border bg-muted/20',
          compact ? 'hidden' : 'w-72',
        )}
      >
        <div className="border-b border-border px-4 py-3">
          <p className="text-sm font-semibold text-foreground">Messages</p>
          <p className="text-xs text-muted-foreground">
            Chat with tax experts &amp; support
          </p>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations.map((conv) => (
            <button
              key={conv.id}
              type="button"
              onClick={() => setActiveConversation(conv.id)}
              className={cn(
                'flex w-full items-start gap-3 border-b border-border/60 px-4 py-3 text-left transition-colors hover:bg-muted/50',
                activeConversationId === conv.id && 'bg-primary/5',
              )}
            >
              <div className="relative shrink-0">
                <div className="flex size-10 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                  {conv.avatar}
                </div>
                {conv.online ? (
                  <span className="absolute -right-0.5 -bottom-0.5 size-3 rounded-full border-2 border-white bg-deadline-safe" />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium">{conv.name}</p>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {conv.lastActive}
                  </span>
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {conv.lastMessage}
                </p>
              </div>
              {conv.unread > 0 ? (
                <Badge className="size-5 shrink-0 justify-center rounded-full bg-primary p-0 text-[10px] text-primary-foreground">
                  {conv.unread}
                </Badge>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      {/* Active thread */}
      <div className="flex min-w-0 flex-1 flex-col">
        {activeConversation ? (
          <>
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="flex size-9 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                    {activeConversation.avatar}
                  </div>
                  {activeConversation.online ? (
                    <span className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2 border-white bg-deadline-safe" />
                  ) : null}
                </div>
                <div>
                  <p className="text-sm font-semibold">
                    {activeConversation.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {activeConversation.online ? 'Online' : 'Offline'} ·{' '}
                    {activeConversation.role}
                  </p>
                </div>
              </div>
              {!compact ? (
                <Link
                  to="/connect"
                  className={buttonVariants({ variant: 'outline', size: 'sm' })}
                >
                  <Maximize2 className="size-3.5" />
                  Expand
                </Link>
              ) : null}
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
              {threadMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    'flex',
                    msg.isOwn ? 'justify-end' : 'justify-start',
                  )}
                >
                  <div
                    className={cn(
                      'max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                      msg.isOwn
                        ? 'rounded-br-md bg-primary text-primary-foreground'
                        : 'rounded-bl-md bg-muted text-foreground',
                    )}
                  >
                    {!msg.isOwn ? (
                      <p className="mb-1 text-[10px] font-medium opacity-70">
                        {msg.senderName}
                      </p>
                    ) : null}
                    <p>{msg.content}</p>
                    <p
                      className={cn(
                        'mt-1 text-[10px]',
                        msg.isOwn
                          ? 'text-primary-foreground/60'
                          : 'text-muted-foreground',
                      )}
                    >
                      {formatMessageTime(msg.timestamp)}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <form
              onSubmit={handleSend}
              className="border-t border-border bg-muted/20 p-3"
            >
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Attach file"
                >
                  <Paperclip className="size-4 text-muted-foreground" />
                </Button>
                <Input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Type your message..."
                  className="h-10 flex-1 bg-white"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Add emoji"
                >
                  <Smile className="size-4 text-muted-foreground" />
                </Button>
                <Button type="submit" size="icon" disabled={!draft.trim()}>
                  <Send className="size-4" />
                </Button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            Select a conversation to start chatting
          </div>
        )}
      </div>
    </div>
  )
}
