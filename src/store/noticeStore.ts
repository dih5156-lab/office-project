import { create } from 'zustand';
import { api } from '../lib/api';

export interface Notice {
  id: string;
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  department: string;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
}

interface NoticeStore {
  notices: Notice[];
  isLoaded: boolean;
  fetchNotices: () => Promise<void>;
  addNotice: (data: { title: string; content: string; isPinned: boolean }) => Promise<Notice>;
  updateNotice: (id: string, data: Partial<{ title: string; content: string; isPinned: boolean }>) => Promise<void>;
  deleteNotice: (id: string) => Promise<void>;
}

export const useNoticeStore = create<NoticeStore>()((set, get) => ({
  notices: [],
  isLoaded: false,

  fetchNotices: async () => {
    if (get().isLoaded) return;
    try {
      const data = await api.get<Notice[]>('/notices');
      set({ notices: data, isLoaded: true });
    } catch {
      /* isLoaded는 false 유지 → 다음 호출 때 재시도 */
    }
  },

  addNotice: async (data) => {
    const notice = await api.post<Notice>('/notices', data);
    set((state) => ({ notices: [notice, ...state.notices] }));
    return notice;
  },

  updateNotice: async (id, data) => {
    const updated = await api.put<Notice>(`/notices/${id}`, data);
    set((state) => ({ notices: state.notices.map((n) => (n.id === id ? updated : n)) }));
  },

  deleteNotice: async (id) => {
    await api.delete(`/notices/${id}`);
    set((state) => ({ notices: state.notices.filter((n) => n.id !== id) }));
  },
}));
