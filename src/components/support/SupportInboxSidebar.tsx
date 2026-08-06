import { Headphones, Loader2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import type { SupportInboxItem } from '@/lib/support-admin'
import { cn } from '@/lib/utils'

function getInitials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

interface SupportInboxSidebarProps {
  inbox: SupportInboxItem[]
  selectedUserId: string | null
  loading: boolean
  onSelectUser: (userId: string) => void
  className?: string
}

export function SupportInboxSidebar({
  inbox,
  selectedUserId,
  loading,
  onSelectUser,
  className,
}: SupportInboxSidebarProps) {
  return (
    <div
      className={cn(
        'flex w-full shrink-0 flex-col border-r border-border bg-muted/15 md:w-80',
        className,
      )}
    >
      <div className="border-b border-border bg-white px-4 py-4">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Headphones className="size-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Open conversations</p>
            <p className="text-xs text-muted-foreground">
              {inbox.length} taxpayer{inbox.length === 1 ? '' : 's'}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : inbox.length === 0 ? (
          <p className="px-4 py-10 text-center text-xs leading-relaxed text-muted-foreground">
            No support messages yet. Taxpayer conversations will appear here when
            they message support.
          </p>
        ) : (
          inbox.map((item) => (
            <button
              key={item.userId}
              type="button"
              onClick={() => onSelectUser(item.userId)}
              className={cn(
                'flex w-full items-start gap-3 border-b border-border/50 px-4 py-3.5 text-left transition-colors hover:bg-white/80',
                selectedUserId === item.userId &&
                  'bg-white shadow-[inset_3px_0_0_0_hsl(var(--primary))]',
              )}
            >
              <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground shadow-sm">
                {getInitials(item.displayName || 'User')}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-semibold">{item.displayName}</p>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {item.lastActive}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {item.userEmail}
                </p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {item.lastMessage}
                </p>
              </div>
              {item.unread > 0 ? (
                <Badge className="size-5 shrink-0 justify-center rounded-full bg-primary p-0 text-[10px] text-primary-foreground">
                  {item.unread}
                </Badge>
              ) : null}
            </button>
          ))
        )}
      </div>
    </div>
  )
}

export { getInitials }
