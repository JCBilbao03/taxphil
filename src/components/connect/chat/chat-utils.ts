import { normalizeTimestamp } from '@/lib/chat'
import type { ChatMessage } from '@/store/useConnectStore'

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

export function formatMessageTime(timestamp: string) {
  const date = new Date(normalizeTimestamp(timestamp))

  return new Intl.DateTimeFormat('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date)
}

export function getDateSeparatorLabel(timestamp: string): string {
  const date = new Date(normalizeTimestamp(timestamp))
  const today = startOfDay(new Date())
  const messageDay = startOfDay(date)
  const diffDays = Math.round((today - messageDay) / 86_400_000)

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'

  return new Intl.DateTimeFormat('en-PH', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
  }).format(date)
}

export interface MessageGroup {
  dateLabel: string
  messages: ChatMessage[]
}

export function groupMessagesByDate(messages: ChatMessage[]): MessageGroup[] {
  const groups: MessageGroup[] = []

  for (const message of messages) {
    const dateLabel = getDateSeparatorLabel(message.timestamp)
    const lastGroup = groups[groups.length - 1]

    if (lastGroup?.dateLabel === dateLabel) {
      lastGroup.messages.push(message)
    } else {
      groups.push({ dateLabel, messages: [message] })
    }
  }

  return groups
}

export function shouldShowSenderHeader(
  message: ChatMessage,
  previousMessage: ChatMessage | undefined,
): boolean {
  if (message.isOwn) return false
  if (!previousMessage) return true
  if (previousMessage.isOwn) return true
  return previousMessage.senderId !== message.senderId
}
