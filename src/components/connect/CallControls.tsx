import {
  Mic,
  MicOff,
  MonitorUp,
  PhoneOff,
  Video,
  VideoOff,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface CallControlsProps {
  isMuted: boolean
  isCameraOff: boolean
  isScreenSharing: boolean
  onToggleMute: () => void
  onToggleCamera: () => void
  onToggleScreenShare: () => void
  onEndCall: () => void
  className?: string
}

export function CallControls({
  isMuted,
  isCameraOff,
  isScreenSharing,
  onToggleMute,
  onToggleCamera,
  onToggleScreenShare,
  onEndCall,
  className,
}: CallControlsProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-center gap-3 rounded-xl bg-navy-900/90 px-6 py-4 backdrop-blur-sm',
        className,
      )}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon-lg"
        onClick={onToggleMute}
        className={cn(
          'rounded-full text-white hover:bg-white/15',
          isMuted && 'bg-deadline-urgent/80 hover:bg-deadline-urgent',
        )}
        aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
      >
        {isMuted ? <MicOff className="size-5" /> : <Mic className="size-5" />}
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="icon-lg"
        onClick={onToggleCamera}
        className={cn(
          'rounded-full text-white hover:bg-white/15',
          isCameraOff && 'bg-deadline-urgent/80 hover:bg-deadline-urgent',
        )}
        aria-label={isCameraOff ? 'Turn camera on' : 'Turn camera off'}
      >
        {isCameraOff ? (
          <VideoOff className="size-5" />
        ) : (
          <Video className="size-5" />
        )}
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="icon-lg"
        onClick={onToggleScreenShare}
        className={cn(
          'rounded-full text-white hover:bg-white/15',
          isScreenSharing && 'bg-primary hover:bg-primary/80',
        )}
        aria-label="Share screen"
      >
        <MonitorUp className="size-5" />
      </Button>

      <Button
        type="button"
        size="icon-lg"
        onClick={onEndCall}
        className="rounded-full bg-deadline-urgent text-white hover:bg-deadline-urgent/90"
        aria-label="End call"
      >
        <PhoneOff className="size-5" />
      </Button>
    </div>
  )
}
