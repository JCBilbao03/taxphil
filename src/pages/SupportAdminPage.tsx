import { useCallback, useMemo, useState } from 'react'
import { ChevronLeft, Headphones, Loader2 } from 'lucide-react'

import { ChatComposer } from '@/components/connect/chat/ChatComposer'
import { ChatMessageList } from '@/components/connect/chat/ChatMessageList'
import { CannedReplyBar } from '@/components/support/CannedReplyBar'
import {
  getInitials,
  SupportInboxSidebar,
} from '@/components/support/SupportInboxSidebar'
import { SupportUserContext } from '@/components/support/SupportUserContext'
import { ConsultationWorkspace } from '@/components/connect/ConsultationWorkspace'
import { Button } from '@/components/ui/button'
import { useSupportAdmin } from '@/hooks/useSupportAdmin'
import { SUPPORT_CONVERSATION_ID } from '@/lib/chat'
import type { Conversation } from '@/store/useConnectStore'
import { cn } from '@/lib/utils'

export function SupportAdminPage() {
  const {
    inbox,
    messages,
    selectedUserId,
    loading,
    syncing,
    error,
    selectUser,
    sendReply,
    sending,
  } = useSupportAdmin()

  const [draft, setDraft] = useState('')
  const [activeTab, setActiveTab] = useState<'messages' | 'consultations'>('messages')
  const [mobileShowInbox, setMobileShowInbox] = useState(false)

  const selectedUser = inbox.find((item) => item.userId === selectedUserId)

  const conversation = useMemo<Conversation | null>(() => {
    if (!selectedUser) return null

    return {
      id: SUPPORT_CONVERSATION_ID,
      name: selectedUser.displayName,
      role: selectedUser.userEmail,
      avatar: getInitials(selectedUser.displayName || 'User'),
      lastMessage: selectedUser.lastMessage,
      lastActive: selectedUser.lastActive,
      unread: selectedUser.unread,
      online: false,
    }
  }, [selectedUser])

  const handleSelectUser = useCallback(
    (userId: string) => {
      if (sending) return
      if (selectedUserId !== userId) setDraft('')
      selectUser(userId)
      setMobileShowInbox(false)
    },
    [selectUser, selectedUserId, sending],
  )

  const handleSend = useCallback(async () => {
    const trimmed = draft.trim()
    if (!trimmed || sending) return

    const sent = await sendReply(trimmed)
    if (sent) setDraft((current) => current === draft ? '' : current)
  }, [draft, sendReply, sending])

  const showMobileInbox = mobileShowInbox || !selectedUser

  if (syncing || (loading && inbox.length === 0)) {
    return (
      <div className="flex h-[min(520px,calc(100dvh-9.5rem))] min-h-[280px] items-center justify-center rounded-xl border border-border bg-card md:min-h-[480px]">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex gap-2"><Button variant={activeTab === 'messages' ? 'default' : 'outline'} onClick={() => setActiveTab('messages')}>Support messages</Button><Button variant={activeTab === 'consultations' ? 'default' : 'outline'} onClick={() => setActiveTab('consultations')}>Consultation desk</Button></div>
      {activeTab === 'consultations' ? <ConsultationWorkspace admin /> : <>
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
        <div className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Headphones className="size-5" />
        </div>
        <div>
          <p className="text-sm font-medium">Support Inbox</p>
          <p className="text-xs text-muted-foreground">
            Reply to taxpayer messages · Notifications delivered when enabled
          </p>
        </div>
      </div>

      <div className="flex h-[min(520px,calc(100dvh-9.5rem))] min-h-[280px] overflow-hidden rounded-xl border border-border bg-card md:min-h-[480px]">
        <SupportInboxSidebar
          inbox={inbox}
          selectedUserId={selectedUserId}
          loading={loading}
          onSelectUser={handleSelectUser}
          className={cn(showMobileInbox ? 'flex' : 'hidden md:flex')}
        />

        <div
          className={cn(
            'flex min-w-0 flex-1 flex-col',
            showMobileInbox && 'hidden md:flex',
          )}
        >
          {selectedUser && conversation ? (
            <>
              <div className="flex items-center border-b border-border px-3 py-2 md:hidden">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="gap-1 px-2"
                  onClick={() => setMobileShowInbox(true)}
                >
                  <ChevronLeft className="size-4" />
                  Inbox
                </Button>
              </div>

              <SupportUserContext
                userId={selectedUser.userId}
                displayName={selectedUser.displayName}
                userEmail={selectedUser.userEmail}
              />

              <ChatMessageList
                messages={messages}
                conversation={conversation}
                chatError={error}
                perspective="agent"
              />

              <CannedReplyBar onSelect={setDraft} />
              <ChatComposer
                draft={draft}
                onDraftChange={setDraft}
                onSend={handleSend}
                sending={sending}
                placeholder="Reply as TaxPhil Support..."
              />
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
              <div className="flex size-14 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Headphones className="size-7" />
              </div>
              <p className="text-sm font-medium text-foreground">
                Select a conversation
              </p>
              <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">
                Choose a taxpayer from the inbox to review their support thread
                and send a reply.
              </p>
            </div>
          )}
        </div>
      </div>
      </>}
    </div>
  )
}
