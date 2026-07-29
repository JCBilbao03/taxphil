import { useConnectStore } from '@/store/useConnectStore'
import { ChatView } from '@/components/connect/ChatView'
import { ConnectModeTabs } from '@/components/connect/ConnectModeTabs'
import { VideoCallView } from '@/components/connect/VideoCallView'
import { VideoConferenceView } from '@/components/connect/VideoConferenceView'

export function ConnectPage() {
  const activeMode = useConnectStore((state) => state.activeMode)

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <ConnectModeTabs />

      {activeMode === 'chat' ? <ChatView /> : null}
      {activeMode === 'video-call' ? <VideoCallView /> : null}
      {activeMode === 'conference' ? <VideoConferenceView /> : null}
    </div>
  )
}
