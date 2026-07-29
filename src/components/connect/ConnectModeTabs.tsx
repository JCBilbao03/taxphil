import { MessageSquare, Users, Video } from 'lucide-react'

import { useConnectStore, type ConnectMode } from '@/store/useConnectStore'
import { cn } from '@/lib/utils'

const modes: {
  id: ConnectMode
  label: string
  description: string
  icon: typeof MessageSquare
}[] = [
  {
    id: 'chat',
    label: 'Chat',
    description: 'Message a tax expert',
    icon: MessageSquare,
  },
  {
    id: 'video-call',
    label: 'Video Call',
    description: '1-on-1 with an expert',
    icon: Video,
  },
  {
    id: 'conference',
    label: 'Video Conference',
    description: 'Group tax consultation',
    icon: Users,
  },
]

interface ConnectModeTabsProps {
  className?: string
  compact?: boolean
}

export function ConnectModeTabs({ className, compact = false }: ConnectModeTabsProps) {
  const activeMode = useConnectStore((state) => state.activeMode)
  const setActiveMode = useConnectStore((state) => state.setActiveMode)

  return (
    <div
      className={cn(
        'flex gap-2',
        compact ? 'flex-col' : 'flex-col sm:flex-row',
        className,
      )}
    >
      {modes.map(({ id, label, description, icon: Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => setActiveMode(id)}
          className={cn(
            'flex flex-1 items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all',
            activeMode === id
              ? 'border-primary bg-primary text-primary-foreground shadow-sm'
              : 'border-border bg-white text-foreground hover:border-primary/30 hover:bg-muted/50',
          )}
        >
          <div
            className={cn(
              'flex size-9 shrink-0 items-center justify-center rounded-lg',
              activeMode === id
                ? 'bg-primary-foreground/15'
                : 'bg-primary/10 text-primary',
            )}
          >
            <Icon className="size-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold">{label}</p>
            {!compact ? (
              <p
                className={cn(
                  'truncate text-xs',
                  activeMode === id
                    ? 'text-primary-foreground/70'
                    : 'text-muted-foreground',
                )}
              >
                {description}
              </p>
            ) : null}
          </div>
        </button>
      ))}
    </div>
  )
}
