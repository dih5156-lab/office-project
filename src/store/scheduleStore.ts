import { create } from 'zustand';
import { Schedule } from '../types';
import { format } from 'date-fns';
import { api } from '../lib/api';

interface ScheduleStore {
  schedules: Schedule[];
  isLoaded: boolean;
  fetchSchedules: (force?: boolean) => Promise<void>;
  addSchedule: (data: Omit<Schedule, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateSchedule: (id: string, data: Partial<Omit<Schedule, 'id' | 'createdAt'>>) => Promise<void>;
  deleteSchedule: (id: string) => Promise<void>;
  getSchedulesByDate: (date: Date) => Schedule[];
  getSchedulesByWeek: (start: Date, end: Date) => Schedule[];
}

export const useScheduleStore = create<ScheduleStore>()((set, get) => ({
  schedules: [],
  isLoaded: false,

  fetchSchedules: async (force = false) => {
    if (get().isLoaded && !force) return;
    try {
      const data = await api.get<Schedule[]>('/schedules');
      set({ schedules: data, isLoaded: true });
    } catch { /* isLoaded는 false 유지 → 다음 호출 때 재시도 */ }
  },

  addSchedule: async (data) => {
    const schedule = await api.post<Schedule>('/schedules', data);
    set(state => ({ schedules: [...state.schedules, schedule] }));
  },

  updateSchedule: async (id, data) => {
    const updated = await api.put<Schedule>(`/schedules/${id}`, data);
    set(state => ({ schedules: state.schedules.map(s => s.id === id ? updated : s) }));
  },

  deleteSchedule: async (id) => {
    await api.delete(`/schedules/${id}`);
    set(state => ({ schedules: state.schedules.filter(s => s.id !== id) }));
  },

  getSchedulesByDate: (date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return get().schedules.filter(s => s.startDate.startsWith(dateStr));
  },

  getSchedulesByWeek: (start, end) => {
    return get().schedules.filter(s => {
      const d = new Date(s.startDate);
      return d >= start && d <= end;
    });
  },
}));
