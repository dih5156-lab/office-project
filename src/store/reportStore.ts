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
  approveReport: (id: string, action: 'approve' | 'reject', comment?: string) => Promise<void>;
  getCurrentWeekReport: () => WeeklyReport | undefined;
  createNewReport: (author: string, department: string) => Promise<WeeklyReport>;
}

// 디바운스용 타이머 맵 (스토어 외부에 위치)
const saveTimers = new Map<string, ReturnType<typeof setTimeout>>();

export const useReportStore = create<ReportStore>()((set, get) => ({
  reports: [],
  isLoaded: false,

  fetchReports: async () => {
    if (get().isLoaded) return;
    try {
      const data = await api.get<WeeklyReport[]>('/reports');
      set({ reports: data, isLoaded: true });
    } catch { /* isLoaded는 false 유지 → 다음 호출 때 재시도 */ }
  },

  addReport: async (data) => {
    const report = await api.post<WeeklyReport>('/reports', data);
    set(state => ({ reports: [report, ...state.reports] }));
    return report;
  },

  updateReport: async (id, data) => {
    // 1) 낙관적 업데이트: API 응답 전에 즉시 로컬 상태 반영 → 포커스 유지
    set(state => ({
      reports: state.reports.map(r => r.id === id ? { ...r, ...data } : r),
    }));

    // 2) 디바운스: 마지막 입력 후 800ms 뒤에 서버 저장 (중복 요청 방지)
    const existing = saveTimers.get(id);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(async () => {
      saveTimers.delete(id);
      const current = get().reports.find(r => r.id === id);
      if (current) {
        try {
          await api.put<WeeklyReport>(`/reports/${id}`, current);
        } catch {
          // 저장 실패 시 조용히 무시 (필요 시 알림 추가)
        }
      }
    }, 800);
    saveTimers.set(id, timer);
  },

  deleteReport: async (id) => {
    await api.delete(`/reports/${id}`);
    set(state => ({ reports: state.reports.filter(r => r.id !== id) }));
  },

  approveReport: async (id, action, comment) => {
    const updated = await api.post<WeeklyReport>(`/reports/${id}/approve`, { action, comment: comment ?? null });
    set(state => ({ reports: state.reports.map(r => r.id === id ? updated : r) }));
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
