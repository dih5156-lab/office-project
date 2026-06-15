import { create } from 'zustand';
import { api } from '../lib/api';
import { getSocket } from '../utils/socket';

export interface Notification {
  id: string;
  userId: string;
  type: 'mention' | 'dm' | 'notice' | 'report_approved' | 'report_rejected' | 'report_submitted' | string;
  title: string;
  body: string;
  link: string;
  isRead: boolean;
  createdAt: string;
}

interface NotificationStore {
  notifications: Notification[];
  unreadCount: number;
  fetch: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  remove: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
  addRealtime: (n: Notification) => void;
}

export const useNotificationStore = create<NotificationStore>((set) => ({
  notifications: [],
  unreadCount: 0,

  fetch: async () => {
    try {
      const data = await api.get<Notification[]>('/notifications');
      set({ notifications: data, unreadCount: data.filter((n) => !n.isRead).length });
    } catch { /* 무시 */ }
  },

  markRead: async (id) => {
    try {
      await api.put(`/notifications/${id}/read`, {});
      set((s) => {
        const notifications = s.notifications.map((n) => n.id === id ? { ...n, isRead: true } : n);
        return { notifications, unreadCount: notifications.filter((n) => !n.isRead).length };
      });
    } catch { /* 무시 */ }
  },

  markAllRead: async () => {
    try {
      await api.put('/notifications/read-all', {});
      set((s) => ({
        notifications: s.notifications.map((n) => ({ ...n, isRead: true })),
        unreadCount: 0,
      }));
    } catch { /* 무시 */ }
  },

  remove: async (id) => {
    try {
      await api.delete(`/notifications/${id}`);
      set((s) => {
        const notifications = s.notifications.filter((n) => n.id !== id);
        return { notifications, unreadCount: notifications.filter((n) => !n.isRead).length };
      });
    } catch { /* 무시 */ }
  },

  clearAll: async () => {
    try {
      await api.delete('/notifications');
      set({ notifications: [], unreadCount: 0 });
    } catch { /* 무시 */ }
  },

  addRealtime: (n) => {
    set((s) => {
      const exists = s.notifications.some((x) => x.id === n.id);
      if (exists) return s;
      const notifications = [n, ...s.notifications].slice(0, 50);
      return { notifications, unreadCount: notifications.filter((x) => !x.isRead).length };
    });
  },
}));

/* 소켓 실시간 알림 리스너 등록 (앱 로드 시 1회 호출) */
export function initNotificationSocket() {
  const socket = getSocket();
  socket.off('notification'); // 중복 방지
  socket.on('notification', (n: Notification) => {
    useNotificationStore.getState().addRealtime(n);
  });
}
