import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { MessageCircle, Video, Users, X } from 'lucide-react'

import { ChatView } from '@/components/connect/ChatView'
import { ConnectModeTabs } from '@/components/connect/ConnectModeTabs'
import { Button, buttonVariants } from '@/components/ui/button'
import { useOpenSupportChat } from '@/hooks/useChatSync'
import { useConnectStore } from '@/store/useConnectStore'
import { cn } from '@/lib/utils'

export function SupportWidget() {
  const isWidgetOpen = useConnectStore((state) => state.isWidgetOpen)
  const activeMode = useConnectStore((state) => state.activeMode)
  const conversations = useConnectStore((state) => state.conversations)
  const toggleWidget = useConnectStore((state) => state.toggleWidget)
  const setWidgetOpen = useConnectStore((state) => state.setWidgetOpen)
  const openSupportChat = useOpenSupportChat()

  const totalUnread = conversations.reduce(
    (sum, conversation) => sum + conversation.unread,
    0,
  )

  useEffect(() => {
    if (!isWidgetOpen || activeMode !== 'chat' || conversations.length > 0) return
    void openSupportChat()
  }, [activeMode, conversations.length, isWidgetOpen, openSupportChat])

  useEffect(() => {
    if (!isWidgetOpen) return

    const isMobile = window.matchMedia('(max-width: 639px)').matches
    if (!isMobile) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isWidgetOpen])

  const handleOpenWidget = () => {
    if (!isWidgetOpen) {
      toggleWidget()
      return
    }

    setWidgetOpen(false)
  }

  return (
    <>
      <div
        className={cn(
          'fixed z-50 flex flex-col overflow-hidden border border-border bg-card shadow-md transition-all duration-300',
          'max-sm:inset-0 max-sm:h-[100dvh] max-sm:w-full max-sm:max-w-none max-sm:rounded-none max-sm:border-0',
          'sm:right-6 sm:bottom-[max(1.5rem,env(safe-area-inset-bottom))] sm:w-[min(calc(100vw-3rem),400px)] sm:rounded-xl',
          isWidgetOpen
            ? 'translate-y-0 scale-100 opacity-100'
            : 'pointer-events-none translate-y-4 scale-95 opacity-0 max-sm:translate-y-full',
        )}
        role="dialog"
        aria-label="TaxPhil Support"
        aria-hidden={!isWidgetOpen}
        inert={!isWidgetOpen}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-primary/20 bg-primary px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-primary-foreground">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/15">
              <MessageCircle className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">TaxPhil Support</p>
              <p className="truncate text-xs opacity-85">We&apos;re here to help</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setWidgetOpen(false)}
            className="shrink-0 text-primary-foreground hover:bg-white/15"
            aria-label="Close support widget"
          >
            <X className="size-4" />
          </Button>
        </div>

        <div className="shrink-0 border-b border-border bg-muted/20 px-3 py-2">
          <ConnectModeTabs compact />
        </div>

        <div className="flex min-h-0 flex-1 flex-col p-3">
          {activeMode === 'chat' ? (
            <ChatView compact showExpandLink fillHeight className="min-h-0 flex-1" />
          ) : (
            <div className="flex min-h-[240px] flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/15 px-6 text-center">
              {activeMode === 'video-call' ? (
                <Video className="mb-3 size-10 text-primary" />
              ) : (
                <Users className="mb-3 size-10 text-primary" />
              )}
              <p className="text-sm font-medium text-foreground">
                {activeMode === 'video-call'
                  ? 'Request a video consultation'
                  : 'Group video conference'}
              </p>
              <p className="mt-1 max-w-[240px] text-xs leading-relaxed text-muted-foreground">
                Request a session in Connect and return there for the confirmed
                schedule and meeting link.
              </p>
              <Link
                to={`/connect?mode=${activeMode}`}
                onClick={() => setWidgetOpen(false)}
                className={buttonVariants({ size: 'sm', className: 'mt-4' })}
              >
                Open Connect hub
              </Link>
            </div>
          )}
        </div>

        {activeMode === 'chat' ? (
          <div className="shrink-0 border-t border-border bg-muted/25 px-4 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] text-center">
            <Link
              to="/connect"
              onClick={() => setWidgetOpen(false)}
              className="text-xs font-medium text-primary hover:underline"
            >
              Open full Connect hub →
            </Link>
          </div>
        ) : null}
      </div>

      {!isWidgetOpen ? (
        <Button
          size="icon-lg"
          onClick={handleOpenWidget}
          className="fixed right-4 z-50 size-14 rounded-full shadow-md transition-colors duration-150 hover:bg-primary/90 sm:right-6 bottom-[max(1rem,env(safe-area-inset-bottom))]"
          aria-label="Open support chat"
        >
          <MessageCircle className="size-6" />
          {totalUnread > 0 ? (
            <span className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-deadline-urgent text-[10px] font-medium text-white ring-2 ring-card">
              {totalUnread > 9 ? '9+' : totalUnread}
            </span>
          ) : null}
        </Button>
      ) : null}
    </>
  )
}
