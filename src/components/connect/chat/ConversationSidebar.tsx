import { Clock, Headphones, Loader2, MessageCircle } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { Conversation } from '@/store/useConnectStore'
import { cn } from '@/lib/utils'

interface ConversationSidebarProps {
  conversations: Conversation[]
  activeConversationId: string
  chatLoading: boolean
  chatError: string | null
  initializing: boolean
  onSelectConversation: (id: string) => void
  onOpenSupportChat: () => void
  className?: string
}

export function ConversationSidebar({
  conversations,
  activeConversationId,
  chatLoading,
  chatError,
  initializing,
  onSelectConversation,
  onOpenSupportChat,
  className,
}: ConversationSidebarProps) {
  return (
    <div
      className={cn(
        'flex w-72 shrink-0 flex-col border-r border-border bg-muted/15',
        className,
      )}
    >
      <div className="border-b border-border bg-card px-4 py-4">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <MessageCircle className="size-4" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Inbox</p>
            <p className="text-xs text-muted-foreground">TaxPhil Support</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="flex flex-col items-center gap-4 px-4 py-10 text-center">
            <div className="flex size-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Headphones className="size-6" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">
                No conversations yet
              </p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Reach out to our support team for help with filing, deadlines,
                or your account.
              </p>
            </div>
            {chatError ? (
              <p className="w-full rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {chatError}
              </p>
            ) : null}
            <Button
              type="button"
              size="sm"
              disabled={chatLoading || initializing}
              onClick={onOpenSupportChat}
              className="w-full"
            >
              {chatLoading || initializing ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Opening chat...
                </>
              ) : (
                'Start support chat'
              )}
            </Button>
          </div>
        ) : (
          conversations.map((conversation) => (
            <button
              key={conversation.id}
              type="button"
              onClick={() => onSelectConversation(conversation.id)}
              className={cn(
                'flex w-full items-start gap-3 border-b border-border/50 px-4 py-3 text-left transition-colors duration-150 hover:bg-card focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                activeConversationId === conversation.id &&
                  'border-l-2 border-l-primary bg-card',
              )}
            >
              <div className="relative shrink-0">
                <div className="flex size-11 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                  {conversation.avatar}
                </div>
                {conversation.online ? (
                  <span className="absolute -right-0.5 -bottom-0.5 size-3 rounded-full border-2 border-card bg-deadline-safe" />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium">
                    {conversation.name}
                  </p>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {conversation.lastActive}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {conversation.lastMessage}
                </p>
                <p className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground/80">
                  <Clock className="size-3" />
                  {conversation.online ? 'Usually replies quickly' : conversation.role}
                </p>
              </div>
              {conversation.unread > 0 ? (
                <Badge className="size-5 shrink-0 justify-center rounded-full bg-primary p-0 text-[10px] text-primary-foreground">
                  {conversation.unread}
                </Badge>
              ) : null}
            </button>
          ))
        )}
      </div>
    </div>
  )
}
