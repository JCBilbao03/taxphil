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
          className="shrink-0 rounded-full border border-border bg-white px-3 py-1 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5"
        >
          {reply.label}
        </button>
      ))}
    </div>
  )
}
