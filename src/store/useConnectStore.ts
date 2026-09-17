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

interface ConnectState {
  activeMode: ConnectMode
  activeConversationId: string
  conversations: Conversation[]
  messages: ChatMessage[]
  chatLoading: boolean
  chatError: string | null
  isWidgetOpen: boolean
  setActiveMode: (mode: ConnectMode) => void
  setActiveConversation: (id: string) => void
  setConversations: (conversations: Conversation[]) => void
  setMessages: (messages: ChatMessage[]) => void
  setChatLoading: (loading: boolean) => void
  setChatError: (error: string | null) => void
  toggleWidget: () => void
  setWidgetOpen: (open: boolean) => void
}

export const useConnectStore = create<ConnectState>((set) => ({
  activeMode: 'chat',
  activeConversationId: SUPPORT_CONVERSATION_ID,
  conversations: [],
  messages: [],
  chatLoading: true,
  chatError: null,
  isWidgetOpen: false,

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

  toggleWidget: () => set((state) => ({ isWidgetOpen: !state.isWidgetOpen })),
  setWidgetOpen: (open) => set({ isWidgetOpen: open }),
}))
