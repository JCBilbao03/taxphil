import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'

import { useConnectStore } from '@/store/useConnectStore'
import { ChatView } from '@/components/connect/ChatView'
import { ConnectModeTabs } from '@/components/connect/ConnectModeTabs'
import { SupportNotificationPrompt } from '@/components/support/SupportNotificationPrompt'
import { VideoCallView } from '@/components/connect/VideoCallView'
import { VideoConferenceView } from '@/components/connect/VideoConferenceView'
import { useOpenSupportChat } from '@/hooks/useChatSync'

export function ConnectPage() {
  const [params] = useSearchParams()
  const requestedMode = params.get('mode')
  const activeMode = useConnectStore((state) => state.activeMode)
  const conversations = useConnectStore((state) => state.conversations)
  const setActiveMode = useConnectStore((state) => state.setActiveMode)
  const openSupportChat = useOpenSupportChat()

  useEffect(() => {
    if (requestedMode === 'chat' || requestedMode === 'video-call' || requestedMode === 'conference') setActiveMode(requestedMode)
  }, [requestedMode, setActiveMode])

  useEffect(() => {
    if (activeMode !== 'chat' || conversations.length > 0) return
    void openSupportChat()
  }, [activeMode, conversations.length, openSupportChat])

  return (
    <div className="mx-auto max-w-6xl space-y-4 sm:space-y-6">
      <SupportNotificationPrompt />

      <ConnectModeTabs />

      {activeMode === 'chat' ? <ChatView /> : null}
      {activeMode === 'video-call' ? <VideoCallView /> : null}
      {activeMode === 'conference' ? <VideoConferenceView /> : null}
    </div>
  )
}
