import { CANNED_REPLIES } from '@/components/support/canned-replies'
import { cn } from '@/lib/utils'

interface CannedReplyBarProps {
  onSelect: (content: string) => void
  className?: string
}

export function CannedReplyBar({ onSelect, className }: CannedReplyBarProps) {
  return (
    <div
      className={cn(
        'flex gap-2 overflow-x-auto border-t border-border bg-muted/20 px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className,
      )}
    >
      {CANNED_REPLIES.map((reply) => (
        <button
          key={reply.id}
          type="button"
          onClick={() => onSelect(reply.content)}
          className="shrink-0 rounded-md border border-border bg-card px-3 py-1 text-xs font-medium text-foreground transition-colors duration-150 hover:border-primary/40 hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {reply.label}
        </button>
      ))}
    </div>
  )
}
