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
    description: 'Message TaxPhil Support',
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
        compact
          ? '-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
          : 'flex flex-col gap-2 sm:flex-row',
        className,
      )}
    >
      {modes.map(({ id, label, description, icon: Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => setActiveMode(id)}
          className={cn(
            'flex items-center rounded-lg border text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
            compact
              ? 'min-w-[7.5rem] shrink-0 snap-start gap-2 px-3 py-2'
              : 'flex-1 gap-3 px-4 py-3',
            activeMode === id
              ? 'border-primary bg-primary text-primary-foreground shadow-sm'
              : 'border-border bg-card text-foreground hover:border-primary/30 hover:bg-muted/50',
          )}
        >
          <div
            className={cn(
              'flex shrink-0 items-center justify-center rounded-lg',
              compact ? 'size-8' : 'size-9',
              activeMode === id
                ? 'bg-primary-foreground/15'
                : 'bg-primary/10 text-primary',
            )}
          >
            <Icon className={compact ? 'size-3.5' : 'size-4'} />
          </div>
          <div className="min-w-0">
            <p className={cn('font-semibold', compact ? 'text-xs' : 'text-sm')}>
              {label}
            </p>
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
