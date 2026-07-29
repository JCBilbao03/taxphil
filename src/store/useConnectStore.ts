import { create } from 'zustand'

export type ConnectMode = 'chat' | 'video-call' | 'conference'

export interface ChatMessage {
  id: string
  conversationId: string
  senderId: string
  senderName: string
  content: string
  timestamp: string
  isOwn: boolean
}

export interface Conversation {
  id: string
  name: string
  role: string
  avatar: string
  lastMessage: string
  lastActive: string
  unread: number
  online: boolean
}

export type CallStatus = 'idle' | 'connecting' | 'active' | 'ended'

interface ConnectState {
  activeMode: ConnectMode
  activeConversationId: string
  conversations: Conversation[]
  messages: ChatMessage[]
  callStatus: CallStatus
  conferenceStatus: CallStatus
  isWidgetOpen: boolean
  isMuted: boolean
  isCameraOff: boolean
  isScreenSharing: boolean
  setActiveMode: (mode: ConnectMode) => void
  setActiveConversation: (id: string) => void
  sendMessage: (content: string) => void
  setCallStatus: (status: CallStatus) => void
  setConferenceStatus: (status: CallStatus) => void
  toggleWidget: () => void
  setWidgetOpen: (open: boolean) => void
  toggleMute: () => void
  toggleCamera: () => void
  toggleScreenShare: () => void
}

const seedConversations: Conversation[] = [
  {
    id: 'conv-1',
    name: 'Maria Santos',
    role: 'Tax Expert · BIR Specialist',
    avatar: 'MS',
    lastMessage: 'Your 2551Q is ready for review.',
    lastActive: '2 min ago',
    unread: 1,
    online: true,
  },
  {
    id: 'conv-2',
    name: 'TaxPhil Support',
    role: 'Customer Support Team',
    avatar: 'TP',
    lastMessage: 'How can we help you today?',
    lastActive: '1 hr ago',
    unread: 0,
    online: true,
  },
  {
    id: 'conv-3',
    name: 'Live Demo Team',
    role: 'Product Walkthrough',
    avatar: 'LD',
    lastMessage: 'Schedule confirmed for Thursday, 2:00 PM.',
    lastActive: 'Yesterday',
    unread: 0,
    online: false,
  },
]

const seedMessages: ChatMessage[] = [
  {
    id: 'msg-1',
    conversationId: 'conv-1',
    senderId: 'expert-1',
    senderName: 'Maria Santos',
    content:
      'Hi Juan! I reviewed your Q2 transactions. Your Percentage Tax (2551Q) computation looks correct.',
    timestamp: '2026-07-20T09:00:00',
    isOwn: false,
  },
  {
    id: 'msg-2',
    conversationId: 'conv-1',
    senderId: 'user',
    senderName: 'You',
    content: 'Thanks Maria! Can you confirm the amount due before I file?',
    timestamp: '2026-07-20T09:05:00',
    isOwn: true,
  },
  {
    id: 'msg-3',
    conversationId: 'conv-1',
    senderId: 'expert-1',
    senderName: 'Maria Santos',
    content:
      'Absolutely. Based on your logged income, the amount due is ₱3,825.00. You can file directly from your Tax Dues dashboard.',
    timestamp: '2026-07-20T09:08:00',
    isOwn: false,
  },
  {
    id: 'msg-4',
    conversationId: 'conv-1',
    senderId: 'expert-1',
    senderName: 'Maria Santos',
    content: 'Your 2551Q is ready for review.',
    timestamp: '2026-07-20T09:10:00',
    isOwn: false,
  },
  {
    id: 'msg-5',
    conversationId: 'conv-2',
    senderId: 'support',
    senderName: 'TaxPhil Support',
    content: 'Hello! Welcome to TaxPhil. How can we assist you with your tax filing today?',
    timestamp: '2026-07-19T14:00:00',
    isOwn: false,
  },
]

export const useConnectStore = create<ConnectState>((set, get) => ({
  activeMode: 'chat',
  activeConversationId: 'conv-1',
  conversations: seedConversations,
  messages: seedMessages,
  callStatus: 'idle',
  conferenceStatus: 'idle',
  isWidgetOpen: false,
  isMuted: false,
  isCameraOff: false,
  isScreenSharing: false,

  setActiveMode: (mode) => set({ activeMode: mode }),

  setActiveConversation: (id) => {
    set((state) => ({
      activeConversationId: id,
      conversations: state.conversations.map((c) =>
        c.id === id ? { ...c, unread: 0 } : c,
      ),
    }))
  },

  sendMessage: (content) => {
    const trimmed = content.trim()
    if (!trimmed) return

    const { activeConversationId } = get()
    const message: ChatMessage = {
      id: crypto.randomUUID(),
      conversationId: activeConversationId,
      senderId: 'user',
      senderName: 'You',
      content: trimmed,
      timestamp: new Date().toISOString(),
      isOwn: true,
    }

    set((state) => ({
      messages: [...state.messages, message],
      conversations: state.conversations.map((c) =>
        c.id === activeConversationId
          ? { ...c, lastMessage: trimmed, lastActive: 'Just now' }
          : c,
      ),
    }))
  },

  setCallStatus: (status) => set({ callStatus: status }),
  setConferenceStatus: (status) => set({ conferenceStatus: status }),
  toggleWidget: () => set((state) => ({ isWidgetOpen: !state.isWidgetOpen })),
  setWidgetOpen: (open) => set({ isWidgetOpen: open }),
  toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
  toggleCamera: () => set((state) => ({ isCameraOff: !state.isCameraOff })),
  toggleScreenShare: () =>
    set((state) => ({ isScreenSharing: !state.isScreenSharing })),
}))
