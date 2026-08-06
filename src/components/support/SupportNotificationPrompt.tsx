import { Bell, Loader2, X } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { cn } from '@/lib/utils'

interface SupportNotificationPromptProps {
  className?: string
}

export function SupportNotificationPrompt({
  className,
}: SupportNotificationPromptProps) {
  const { shouldPrompt, registering, enableNotifications } = usePushNotifications()
  const [dismissed, setDismissed] = useState(false)

  if (!shouldPrompt || dismissed) return null

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3',
        className,
      )}
    >
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Bell className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">
          Get notified when support replies
        </p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
          Enable browser notifications so you don&apos;t miss TaxPhil Support
          messages.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            disabled={registering}
            onClick={() => void enableNotifications()}
          >
            {registering ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Enabling...
              </>
            ) : (
              'Enable notifications'
            )}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setDismissed(true)}
          >
            Not now
          </Button>
        </div>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="shrink-0"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss notification prompt"
      >
        <X className="size-4" />
      </Button>
    </div>
  )
}
