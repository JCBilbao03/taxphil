import { create } from 'zustand'

import { SUPPORT_CONVERSATION_ID } from '@/lib/chat'

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
  chatLoading: boolean
  chatError: string | null
  callStatus: CallStatus
  conferenceStatus: CallStatus
  isWidgetOpen: boolean
  isMuted: boolean
  isCameraOff: boolean
  isScreenSharing: boolean
  setActiveMode: (mode: ConnectMode) => void
  setActiveConversation: (id: string) => void
  setConversations: (conversations: Conversation[]) => void
  setMessages: (messages: ChatMessage[]) => void
  setChatLoading: (loading: boolean) => void
  setChatError: (error: string | null) => void
  setCallStatus: (status: CallStatus) => void
  setConferenceStatus: (status: CallStatus) => void
  toggleWidget: () => void
  setWidgetOpen: (open: boolean) => void
  toggleMute: () => void
  toggleCamera: () => void
  toggleScreenShare: () => void
}

export const useConnectStore = create<ConnectState>((set) => ({
  activeMode: 'chat',
  activeConversationId: SUPPORT_CONVERSATION_ID,
  conversations: [],
  messages: [],
  chatLoading: true,
  chatError: null,
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

  setConversations: (conversations) => set({ conversations }),
  setMessages: (messages) => set({ messages }),
  setChatLoading: (chatLoading) => set({ chatLoading }),
  setChatError: (chatError) => set({ chatError }),

  setCallStatus: (status) => set({ callStatus: status }),
  setConferenceStatus: (status) => set({ conferenceStatus: status }),
  toggleWidget: () => set((state) => ({ isWidgetOpen: !state.isWidgetOpen })),
  setWidgetOpen: (open) => set({ isWidgetOpen: open }),
  toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
  toggleCamera: () => set((state) => ({ isCameraOff: !state.isCameraOff })),
  toggleScreenShare: () =>
    set((state) => ({ isScreenSharing: !state.isScreenSharing })),
}))
