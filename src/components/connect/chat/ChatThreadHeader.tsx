import { Link } from 'react-router-dom'
import { Circle, Maximize2 } from 'lucide-react'

import { buttonVariants } from '@/components/ui/button'
import type { Conversation } from '@/store/useConnectStore'
import { cn } from '@/lib/utils'

interface ChatThreadHeaderProps {
  conversation: Conversation
  compact?: boolean
  showExpandLink?: boolean
}

export function ChatThreadHeader({
  conversation,
  compact = false,
  showExpandLink = false,
}: ChatThreadHeaderProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between border-b border-border bg-card',
        compact ? 'px-3 py-2.5' : 'px-4 py-3',
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="relative shrink-0">
          <div
            className={cn(
              'flex items-center justify-center rounded-full bg-primary font-medium text-primary-foreground',
              compact ? 'size-8 text-[10px]' : 'size-10 text-xs',
            )}
          >
            {conversation.avatar}
          </div>
          {conversation.online ? (
            <span className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2 border-card bg-deadline-safe" />
          ) : null}
        </div>
        <div className="min-w-0">
          <p className={cn('truncate font-medium', compact ? 'text-sm' : 'text-base')}>
            {conversation.name}
          </p>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Circle
              className={cn(
                'size-2 fill-current',
                conversation.online ? 'text-deadline-safe' : 'text-muted-foreground/50',
              )}
            />
            {conversation.online ? 'Online now' : 'Away'}
            {!compact ? (
              <>
                <span aria-hidden="true">·</span>
                <span className="truncate">{conversation.role}</span>
              </>
            ) : null}
          </p>
        </div>
      </div>

      {showExpandLink ? (
        <Link
          to="/connect"
          className={buttonVariants({
            variant: 'outline',
            size: 'sm',
            className: 'shrink-0',
          })}
          aria-label="Open full chat"
        >
          <Maximize2 className="size-3.5" />
          <span className="hidden sm:inline">Open full chat</span>
        </Link>
      ) : null}
    </div>
  )
}
