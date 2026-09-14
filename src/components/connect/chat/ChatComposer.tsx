import { useCallback, useEffect, useRef } from 'react'
import { Loader2, Send } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ChatComposerProps {
  draft: string
  onDraftChange: (value: string) => void
  onSend: () => Promise<void>
  sending: boolean
  disabled?: boolean
  placeholder?: string
  compact?: boolean
}

export function ChatComposer({
  draft,
  onDraftChange,
  onSend,
  sending,
  disabled = false,
  placeholder = 'Type your message...',
  compact = false,
}: ChatComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const canSend = draft.trim().length > 0 && !sending && !disabled

  useEffect(() => {
    if (disabled) return
    textareaRef.current?.focus()
  }, [disabled])

  const resizeTextarea = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(textarea.scrollHeight, compact ? 96 : 120)}px`
  }, [compact])

  useEffect(() => {
    resizeTextarea()
  }, [draft, resizeTextarea])

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key !== 'Enter' || event.shiftKey) return

      event.preventDefault()
      if (!canSend) return

      void onSend()
    },
    [canSend, onSend],
  )

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        if (!canSend) return
        void onSend()
      }}
      className="border-t border-border bg-muted/30 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-3"
    >
      <div className="flex items-end gap-2">
        <div className="relative min-w-0 flex-1">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled || sending}
            rows={1}
            aria-label="Message"
            className={cn(
              'max-h-[120px] min-h-10 w-full resize-none rounded-lg border border-input bg-card px-4 py-2 text-sm leading-relaxed transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50',
              compact && 'min-h-9 max-h-24 py-2 text-sm',
            )}
          />
        </div>
        <Button
          type="submit"
          size="icon"
          disabled={!canSend}
          className="size-10 shrink-0 rounded-lg"
          aria-label="Send message"
        >
          {sending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
        </Button>
      </div>
      {!compact ? (
        <p className="mt-2 hidden text-[11px] text-muted-foreground md:block">
          Press <kbd className="rounded border border-border bg-muted/60 px-1 py-0.5 font-mono text-[10px]">Enter</kbd>{' '}
          to send,{' '}
          <kbd className="rounded border border-border bg-muted/60 px-1 py-0.5 font-mono text-[10px]">Shift + Enter</kbd>{' '}
          for a new line
        </p>
      ) : null}
    </form>
  )
}
