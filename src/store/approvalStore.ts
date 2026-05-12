import { create } from 'zustand';
import { api } from '../lib/api';
import type { Approval } from '../types';

interface ApprovalState {
  mine: Approval[];
  pending: Approval[];
  done: Approval[];
  loading: boolean;
  error: string | null;
  fetchMine: () => Promise<void>;
  fetchPending: () => Promise<void>;
  fetchDone: () => Promise<void>;
  fetchAll: () => Promise<void>;
  createApproval: (data: {
    title: string;
    type: string;
    content: string;
    amount: number;
    approvers: { id: string; name: string }[];
  }) => Promise<Approval>;
  actionApproval: (id: string, action: 'approved' | 'rejected', comment?: string) => Promise<Approval>;
  cancelApproval: (id: string) => Promise<void>;
}

export const useApprovalStore = create<ApprovalState>((set, get) => ({
  mine: [],
  pending: [],
  done: [],
  loading: false,
  error: null,

  fetchMine: async () => {
    const data = await api.get<Approval[]>('/approvals?tab=mine');
    set({ mine: data });
  },

  fetchPending: async () => {
    const data = await api.get<Approval[]>('/approvals?tab=pending');
    set({ pending: data });
  },

  fetchDone: async () => {
    const data = await api.get<Approval[]>('/approvals?tab=done');
    set({ done: data });
  },

  fetchAll: async () => {
    set({ loading: true, error: null });
    try {
      const [mine, pending, done] = await Promise.all([
        api.get<Approval[]>('/approvals?tab=mine'),
        api.get<Approval[]>('/approvals?tab=pending'),
        api.get<Approval[]>('/approvals?tab=done'),
      ]);
      set({ mine, pending, done });
    } catch (e: any) {
      set({ error: e.message });
    } finally {
      set({ loading: false });
    }
  },

  createApproval: async (data) => {
    const result = await api.post<Approval>('/approvals', data);
    // mine 목록 앞에 추가
    set((s) => ({ mine: [result, ...s.mine] }));
    return result;
  },

  actionApproval: async (id, action, comment = '') => {
    const result = await api.put<Approval>(`/approvals/${id}/action`, { action, comment });
    // pending에서 제거, done에 추가
    set((s) => ({
      pending: s.pending.filter((a) => a.id !== id),
      done: [result, ...s.done.filter((a) => a.id !== id)],
      mine: s.mine.map((a) => (a.id === id ? result : a)),
    }));
    return result;
  },

  cancelApproval: async (id) => {
    await api.delete(`/approvals/${id}`);
    set((s) => ({
      mine: s.mine.map((a) =>
        a.id === id ? { ...a, status: 'cancelled' as const } : a
      ),
    }));
  },
}));
