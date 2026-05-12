import { create } from 'zustand';

export interface ChatMessage {
  id: string;
  fromId: string;
  fromName: string;
  fromDept: string;
  toId: string | null;
  room: string;
  content: string;
  timestamp: string;
}

export interface OnlineUser {
  id: string;
  name: string;
  department: string;
  role: string;
  socketId: string;
}

interface MessengerState {
  connected: boolean;
  onlineUsers: OnlineUser[];
  messages: Record<string, ChatMessage[]>; // room -> messages
  typingUsers: Record<string, string[]>;   // room -> names[]
  activeRoom: string;
  setConnected: (v: boolean) => void;
  setOnlineUsers: (users: OnlineUser[]) => void;
  addMessage: (msg: ChatMessage) => void;
  setHistory: (room: string, msgs: ChatMessage[]) => void;
  setTyping: (room: string, name: string, isTyping: boolean) => void;
  setActiveRoom: (room: string) => void;
  unreadCount: number;
  incrementUnread: () => void;
  clearUnread: () => void;
}

export const useMessengerStore = create<MessengerState>((set) => ({
  connected: false,
  onlineUsers: [],
  messages: {},
  typingUsers: {},
  activeRoom: 'general',
  unreadCount: 0,
  setConnected: (v) => set({ connected: v }),
  setOnlineUsers: (users) => set({ onlineUsers: users }),
  addMessage: (msg) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [msg.room]: [...(state.messages[msg.room] ?? []), msg],
      },
    })),
  setHistory: (room, msgs) =>
    set((state) => ({
      messages: { ...state.messages, [room]: msgs },
    })),
  setTyping: (room, name, isTyping) =>
    set((state) => {
      const prev = state.typingUsers[room] ?? [];
      const next = isTyping ? [...new Set([...prev, name])] : prev.filter((n) => n !== name);
      return { typingUsers: { ...state.typingUsers, [room]: next } };
    }),
  setActiveRoom: (room) => set({ activeRoom: room }),
  incrementUnread: () => set((state) => ({ unreadCount: state.unreadCount + 1 })),
  clearUnread: () => set({ unreadCount: 0 }),
}));
