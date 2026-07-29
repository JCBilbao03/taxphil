import { Link } from 'react-router-dom'
import { MessageCircle, Video, Users, X } from 'lucide-react'

import { ChatView } from '@/components/connect/ChatView'
import { ConnectModeTabs } from '@/components/connect/ConnectModeTabs'
import { Button, buttonVariants } from '@/components/ui/button'
import { useConnectStore } from '@/store/useConnectStore'
import { cn } from '@/lib/utils'

export function SupportWidget() {
  const isWidgetOpen = useConnectStore((state) => state.isWidgetOpen)
  const activeMode = useConnectStore((state) => state.activeMode)
  const toggleWidget = useConnectStore((state) => state.toggleWidget)
  const setWidgetOpen = useConnectStore((state) => state.setWidgetOpen)
  const conversations = useConnectStore((state) => state.conversations)

  const totalUnread = conversations.reduce((sum, c) => sum + c.unread, 0)

  return (
    <>
      <div
        className={cn(
          'fixed right-6 bottom-6 z-50 flex w-[380px] flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-2xl transition-all duration-300',
          isWidgetOpen
            ? 'translate-y-0 opacity-100'
            : 'pointer-events-none translate-y-4 opacity-0',
        )}
      >
        <div className="flex items-center justify-between border-b border-border bg-primary px-4 py-3 text-primary-foreground">
          <div>
            <p className="text-sm font-semibold">TaxPhil Support</p>
            <p className="text-xs opacity-80">Chat · Video · Conference</p>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setWidgetOpen(false)}
            className="text-primary-foreground hover:bg-white/15"
            aria-label="Close support widget"
          >
            <X className="size-4" />
          </Button>
        </div>

        <div className="p-3">
          <ConnectModeTabs compact />
        </div>

        <div className="px-3 pb-3">
          {activeMode === 'chat' ? (
            <ChatView compact />
          ) : (
            <div className="flex h-[320px] flex-col items-center justify-center rounded-xl border border-border bg-muted/20 px-6 text-center">
              {activeMode === 'video-call' ? (
                <Video className="mb-3 size-10 text-primary" />
              ) : (
                <Users className="mb-3 size-10 text-primary" />
              )}
              <p className="text-sm font-medium text-foreground">
                {activeMode === 'video-call'
                  ? 'Video call with a tax expert'
                  : 'Group video conference'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Open the Connect hub for the full video experience.
              </p>
              <Link
                to="/connect"
                onClick={() => setWidgetOpen(false)}
                className={buttonVariants({ size: 'sm', className: 'mt-4' })}
              >
                Open Connect hub
              </Link>
            </div>
          )}
        </div>

        <div className="border-t border-border bg-muted/30 px-4 py-2.5 text-center">
          <Link
            to="/connect"
            onClick={() => setWidgetOpen(false)}
            className="text-xs font-medium text-primary hover:underline"
          >
            Open full Connect hub →
          </Link>
        </div>
      </div>

      {!isWidgetOpen ? (
        <Button
          size="icon-lg"
          onClick={toggleWidget}
          className="fixed right-6 bottom-6 z-50 size-14 rounded-full shadow-lg transition-transform hover:scale-105 active:scale-95"
          aria-label="Open support chat"
        >
          <MessageCircle className="size-6" />
          {totalUnread > 0 ? (
            <span className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-deadline-urgent text-[10px] font-bold text-white">
              {totalUnread}
            </span>
          ) : null}
        </Button>
      ) : null}
    </>
  )
}
