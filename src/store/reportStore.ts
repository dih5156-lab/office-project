import { create } from 'zustand';
import { WeeklyReport, ReportStatus } from '../types';
import { startOfWeek, endOfWeek, format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { api } from '../lib/api';

interface ReportStore {
  reports: WeeklyReport[];
  isLoaded: boolean;
  fetchReports: () => Promise<void>;
  addReport: (data: Omit<WeeklyReport, 'id' | 'createdAt' | 'updatedAt'>) => Promise<WeeklyReport>;
  updateReport: (id: string, data: Partial<Omit<WeeklyReport, 'id' | 'createdAt'>>) => Promise<void>;
  deleteReport: (id: string) => Promise<void>;
  getCurrentWeekReport: () => WeeklyReport | undefined;
  createNewReport: (author: string, department: string) => Promise<WeeklyReport>;
}

export const useReportStore = create<ReportStore>()((set, get) => ({
  reports: [],
  isLoaded: false,

  fetchReports: async () => {
    if (get().isLoaded) return;
    try {
      const data = await api.get<WeeklyReport[]>('/reports');
      set({ reports: data, isLoaded: true });
    } catch { set({ isLoaded: true }); }
  },

  addReport: async (data) => {
    const report = await api.post<WeeklyReport>('/reports', data);
    set(state => ({ reports: [report, ...state.reports] }));
    return report;
  },

  updateReport: async (id, data) => {
    const updated = await api.put<WeeklyReport>(`/reports/${id}`, data);
    set(state => ({ reports: state.reports.map(r => r.id === id ? updated : r) }));
  },

  deleteReport: async (id) => {
    await api.delete(`/reports/${id}`);
    set(state => ({ reports: state.reports.filter(r => r.id !== id) }));
  },

  getCurrentWeekReport: () => {
    const now = new Date();
    const weekStart = format(startOfWeek(now, { locale: ko }), 'yyyy-MM-dd');
    return get().reports.find(r => r.weekStart === weekStart);
  },

  createNewReport: async (author, department) => {
    const now = new Date();
    const weekStart = startOfWeek(now, { locale: ko });
    const weekEnd = endOfWeek(now, { locale: ko });
    const data = {
      weekStart: format(weekStart, 'yyyy-MM-dd'),
      weekEnd: format(weekEnd, 'yyyy-MM-dd'),
      author,
      department,
      completedTasks: [],
      inProgressTasks: [],
      nextWeekTasks: [],
      issues: '',
      notes: '',
      status: '작성중' as ReportStatus,
    };
    const report = await api.post<WeeklyReport>('/reports', data);
    set(state => ({ reports: [report, ...state.reports] }));
    return report;
  },
}));
