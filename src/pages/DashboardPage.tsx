import { useState, useEffect } from 'react';
import { useScheduleStore } from '../store/scheduleStore';
import { useReportStore } from '../store/reportStore';
import { useDocumentStore } from '../store/documentStore';
import { useAISummaryStore } from '../store/aiSummaryStore';
import { useAuthStore } from '../store/authStore';
import { useTodoStore } from '../store/todoStore';
import { useApprovalStore } from '../store/approvalStore';
import { format, startOfWeek, endOfWeek, isSameDay, isAfter } from 'date-fns';
import { ko } from 'date-fns/locale';
import { CalendarDays, FileText, FolderOpen, BrainCircuit, ArrowRight, CheckSquare, Square, Plus, Trash2, Flag, FilePen, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';

const CATEGORY_COLORS: Record<string, string> = {
  회의: '#3b82f6',
  업무: '#6366f1',
  교육: '#10b981',
  출장: '#f59e0b',
  개인: '#ec4899',
  기타: '#9ca3af',
};

type DonutSegment = {
  label: string;
  value: number;
  color: string;
  dash: number;
  offset: number;
};

function DonutChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) {
    return <p className="text-xs text-gray-400 text-center py-8">이번 주 일정 없음</p>;
  }
  const R = 40;
  const CX = 60;
  const CY = 60;
  const CIRC = 2 * Math.PI * R;
  const segments = data.reduce<DonutSegment[]>((acc, d) => {
    const prev = acc[acc.length - 1];
    const offset = prev ? prev.offset + prev.dash : 0;
    const dash = (d.value / total) * CIRC;
    acc.push({ ...d, dash, offset });
    return acc;
  }, []);
  return (
    <div className="flex items-center gap-4">
      <svg width="120" height="120" viewBox="0 0 120 120" className="shrink-0">
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="#f3f4f6" strokeWidth="20" />
        {segments.map((seg, i) => (
          <circle
            key={i}
            cx={CX}
            cy={CY}
            r={R}
            fill="none"
            stroke={seg.color}
            strokeWidth="20"
            strokeDasharray={`${seg.dash} ${CIRC - seg.dash}`}
            strokeDashoffset={-seg.offset}
            transform={`rotate(-90, ${CX}, ${CY})`}
          />
        ))}
        <text x={CX} y={CY - 4} textAnchor="middle" fontSize="15" fontWeight="700" fill="#111827">
          {total}
        </text>
        <text x={CX} y={CY + 11} textAnchor="middle" fontSize="9" fill="#6b7280">
          전체
        </text>
      </svg>
      <div className="flex flex-col gap-2 flex-1">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center gap-2 text-xs">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: seg.color }}
            />
            <span className="text-gray-600 flex-1">{seg.label}</span>
            <span className="font-semibold text-gray-800">{seg.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MonthlyLineChart({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const VW = 520;
  const CHART_H = 90;
  const PAD_TOP = 16;
  const PAD_LEFT = 28;
  const PAD_RIGHT = 12;
  const PAD_BOTTOM = 22;
  const W = VW - PAD_LEFT - PAD_RIGHT;
  const H = CHART_H;
  const n = data.length;
  const slot = W / (n - 1);

  const px = (i: number) => PAD_LEFT + i * slot;
  const py = (v: number) => PAD_TOP + H - Math.round((v / max) * H);

  const pts = data.map((d, i) => ({ x: px(i), y: py(d.value), ...d }));

  // 라인 path
  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');

  // 영역 path (위→오른쪽→아래→왼쪽 닫기)
  const areaPath = [
    `M${pts[0].x},${PAD_TOP + H}`,
    ...pts.map((p) => `L${p.x},${p.y}`),
    `L${pts[pts.length - 1].x},${PAD_TOP + H}`,
    'Z',
  ].join(' ');

  // y축 눈금선 (0, 50%, 100%)
  const gridLines = [0, 0.5, 1].map((r) => PAD_TOP + H - Math.round(r * H));

  const today = new Date();
  const currentMonthIdx = today.getMonth(); // 0-based

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${VW} ${PAD_TOP + H + PAD_BOTTOM}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ display: 'block' }}
    >
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.01" />
        </linearGradient>
      </defs>

      {/* 눈금선 */}
      {gridLines.map((gy, i) => (
        <line key={i} x1={PAD_LEFT} y1={gy} x2={VW - PAD_RIGHT} y2={gy}
          stroke="#f1f5f9" strokeWidth="1" />
      ))}

      {/* 영역 */}
      <path d={areaPath} fill="url(#areaGrad)" />

      {/* 라인 */}
      <path d={linePath} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

      {/* 포인트 + 레이블 */}
      {pts.map((p, i) => {
        const isCurrent = i === currentMonthIdx;
        return (
          <g key={p.label}>
            {/* x축 레이블 */}
            <text x={p.x} y={PAD_TOP + H + 14} textAnchor="middle" fontSize="9"
              fill={isCurrent ? '#3b82f6' : '#9ca3af'}
              fontWeight={isCurrent ? '700' : '400'}>
              {p.label}
            </text>
            {/* 포인트 원 */}
            <circle cx={p.x} cy={p.y} r={isCurrent ? 4.5 : p.value > 0 ? 3 : 2}
              fill={p.value > 0 ? '#3b82f6' : '#e2e8f0'}
              stroke="white" strokeWidth="1.5" />
            {/* 값 레이블 (값 있을 때만) */}
            {p.value > 0 && (
              <text x={p.x} y={p.y - 7} textAnchor="middle" fontSize="9"
                fill="#3b82f6" fontWeight="600">
                {p.value}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { schedules, fetchSchedules } = useScheduleStore();
  const { reports, fetchReports } = useReportStore();
  const { documents, fetchDocuments } = useDocumentStore();
  const { summaries, fetchSummaries } = useAISummaryStore();
  const { currentUser } = useAuthStore();
  const { todos, fetchTodos, addTodo, toggleTodo, deleteTodo } = useTodoStore();
  const { pending: pendingApprovals, fetchPending: fetchPendingApprovals } = useApprovalStore();

  const [now, setNow] = useState(new Date());
  const [todoInput, setTodoInput] = useState('');
  const [todoPriority, setTodoPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [todoFilter, setTodoFilter] = useState<'all' | 'active' | 'done'>('all');

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    fetchSchedules();
    fetchReports();
    fetchDocuments();
    fetchSummaries();
    fetchTodos();
    fetchPendingApprovals();
  }, []);

  const today = now;
  const weekStart = startOfWeek(today, { locale: ko });
  const weekEnd = endOfWeek(today, { locale: ko });

  const todaySchedules = schedules
    .filter((s) => isSameDay(new Date(s.startDate), today))
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

  const weekSchedules = schedules.filter((s) => {
    const d = new Date(s.startDate);
    return d >= weekStart && d <= weekEnd;
  });

  const currentReport = reports.find(
    (r) => r.weekStart === format(weekStart, 'yyyy-MM-dd')
  );
  const completedTasks = currentReport?.completedTasks.length ?? 0;
  const inProgressTasks = currentReport?.inProgressTasks.length ?? 0;
  const nextWeekTasks = currentReport?.nextWeekTasks.length ?? 0;

  const upcomingSchedules = schedules
    .filter((s) => isAfter(new Date(s.startDate), today))
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
    .slice(0, 5);

  const recentReports = [...reports]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  const recentDocs = [...documents]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5);

  const thisYear = today.getFullYear();
  const monthlyData = Array.from({ length: 12 }, (_, i) => ({
    label: `${i + 1}월`,
    value: schedules.filter((s) => {
      const sd = new Date(s.startDate);
      return sd.getFullYear() === thisYear && sd.getMonth() === i;
    }).length,
  }));

  const categoryData = (['회의', '업무', '교육', '출장', '개인', '기타'] as const)
    .map((cat) => ({
      label: cat,
      value: weekSchedules.filter((s) => s.category === cat).length,
      color: CATEGORY_COLORS[cat],
    }))
    .filter((d) => d.value > 0);

  const categoryStats = Object.entries(
    weekSchedules.reduce((acc, s) => {
      acc[s.category] = (acc[s.category] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).sort((a, b) => b[1] - a[1]);

  const reportCounts = {
    submitted: reports.filter((r) => r.status === '제출됨').length,
    completed: reports.filter((r) => r.status === '완료').length,
    inProgress: reports.filter((r) => r.status === '작성중').length,
  };

  const statCards = [
    {
      label: '이번 주 일정',
      value: weekSchedules.length,
      sub: `오늘 ${todaySchedules.length}건`,
      icon: CalendarDays,
      iconColor: 'text-blue-500',
      iconBg: 'bg-blue-50',
      accent: '#3b82f6',
      route: '/schedule',
    },
    {
      label: '주간 보고서',
      value: reports.length,
      sub: currentReport ? `이번 주: ${currentReport.status}` : '이번 주 미작성',
      icon: FileText,
      iconColor: 'text-emerald-500',
      iconBg: 'bg-emerald-50',
      accent: '#10b981',
      route: '/weekly-report',
    },
    {
      label: '전체 문서',
      value: documents.length,
      sub: documents.length > 0 ? `최근 문서 ${Math.min(documents.length, 5)}건` : '문서 없음',
      icon: FolderOpen,
      iconColor: 'text-purple-500',
      iconBg: 'bg-purple-50',
      accent: '#8b5cf6',
      route: '/documents',
    },
    {
      label: 'AI 요약',
      value: summaries.length,
      sub: summaries.length > 0 ? `요약 ${summaries.length}건` : '기록 없음',
      icon: BrainCircuit,
      iconColor: 'text-amber-500',
      iconBg: 'bg-amber-50',
      accent: '#f59e0b',
      route: '/ai-summary',
    },
  ];

  return (
    <div className="space-y-5 pb-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-gray-400">
        <span>홈</span>
        <span>/</span>
        <span className="text-gray-700 font-medium">대시보드</span>
      </div>

      {/* Top stats row */}
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
        {/* Live clock card */}
        <div
          className="col-span-2 xl:col-span-1 rounded-xl shadow-sm p-5 flex flex-col gap-2 overflow-hidden relative"
          style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #2563eb 100%)' }}
        >
          <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full pointer-events-none" style={{ background: 'rgba(255,255,255,0.06)' }} />
          <p className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.55)' }}>
            {format(now, 'yyyy년 M월 d일 EEEE', { locale: ko })}
          </p>
          <p className="text-2xl font-extrabold text-white tabular-nums">
            {format(now, 'HH:mm:ss')}
          </p>
          <p className="text-xs font-semibold" style={{ color: '#93c5fd' }}>
            {currentUser?.name} · {currentUser?.department}
          </p>
          <button
            onClick={() => navigate('/schedule')}
            className="mt-auto py-2 text-sm font-bold rounded-xl transition-all hover:shadow-lg active:scale-[0.98]"
            style={{ background: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.2)' }}
          >
            일정 추가
          </button>
        </div>

        {/* Stat cards */}
        {statCards.map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.label}
              onClick={() => navigate(s.route)}
              className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md hover:border-gray-200 transition-all cursor-pointer active:scale-[0.98]"
            >
              <div className="h-1 w-full" style={{ background: s.accent }} />
              <div className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1">{s.label}</p>
                    <p className="text-3xl font-extrabold text-gray-900 tabular-nums">{s.value}</p>
                    <p className="text-xs text-gray-400 mt-1">{s.sub}</p>
                  </div>
                  <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', s.iconBg)}>
                    <Icon size={18} className={s.iconColor} />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 업무 현황 */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800 text-sm">업무 현황</h3>
            <button
              onClick={() => navigate('/weekly-report')}
              className="text-xs text-blue-500 hover:underline flex items-center gap-0.5"
            >
              전체 보기 <ArrowRight size={12} />
            </button>
          </div>
          <div className="space-y-3">
            {[
              { dot: 'bg-emerald-400', label: '완료', value: completedTasks },
              { dot: 'bg-amber-400', label: '진행중', value: inProgressTasks },
              { dot: 'bg-blue-400', label: '다음주 예정', value: nextWeekTasks },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={clsx('w-2.5 h-2.5 rounded-full', item.dot)} />
                  <span className="text-sm text-gray-600">{item.label}</span>
                </div>
                <span className="text-sm font-bold text-gray-800">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 일정 현황 */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800 text-sm">일정 현황</h3>
            <button
              onClick={() => navigate('/schedule')}
              className="text-xs text-blue-500 hover:underline flex items-center gap-0.5"
            >
              전체 보기 <ArrowRight size={12} />
            </button>
          </div>
          <div className="space-y-3">
            {[
              { dot: 'bg-blue-400', label: '오늘', value: todaySchedules.length },
              { dot: 'bg-emerald-400', label: '이번 주', value: weekSchedules.length },
              { dot: 'bg-purple-400', label: '전체', value: schedules.length },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={clsx('w-2.5 h-2.5 rounded-full', item.dot)} />
                  <span className="text-sm text-gray-600">{item.label}</span>
                </div>
                <span className="text-sm font-bold text-gray-800">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 보고서 현황 */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800 text-sm">보고서 현황</h3>
            <button
              onClick={() => navigate('/weekly-report')}
              className="text-xs text-blue-500 hover:underline flex items-center gap-0.5"
            >
              전체 보기 <ArrowRight size={12} />
            </button>
          </div>
          <div className="space-y-3">
            {[
              { dot: 'bg-blue-500', label: '제출됨', value: reportCounts.submitted },
              { dot: 'bg-emerald-500', label: '완료', value: reportCounts.completed },
              { dot: 'bg-amber-400', label: '작성중', value: reportCounts.inProgress },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={clsx('w-2.5 h-2.5 rounded-full', item.dot)} />
                  <span className="text-sm text-gray-600">{item.label}</span>
                </div>
                <span className="text-sm font-bold text-gray-800">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Bar chart + category list */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-semibold text-gray-800 text-sm">월별 일정 현황</h3>
            <span className="text-xs text-gray-400">{thisYear}년</span>
          </div>
          <MonthlyLineChart data={monthlyData} />

          <div className="mt-3 pt-4 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
              이번 주 카테고리별
            </p>
            {categoryStats.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-2">이번 주 일정 없음</p>
            ) : (
              <div className="space-y-3">
                {categoryStats.map(([cat, count]) => (
                  <div key={cat} className="flex items-center gap-3">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                      style={{
                        backgroundColor: (CATEGORY_COLORS[cat] ?? '#9ca3af') + '20',
                      }}
                    >
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: CATEGORY_COLORS[cat] ?? '#9ca3af' }}
                      />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-medium text-gray-700">{cat}</span>
                        <span className="text-xs font-bold text-gray-800">{count}건</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1">
                        <div
                          className="h-1 rounded-full transition-all"
                          style={{
                            width:
                              weekSchedules.length > 0
                                ? `${(count / weekSchedules.length) * 100}%`
                                : '0%',
                            backgroundColor: CATEGORY_COLORS[cat] ?? '#9ca3af',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Donut chart */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="mb-4">
            <h3 className="font-semibold text-gray-800 text-sm">이번 주 카테고리</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {format(weekStart, 'M월 d일')} ~ {format(weekEnd, 'M월 d일')}
            </p>
          </div>
          <DonutChart data={categoryData} />
        </div>
      </div>

      {/* 결재 대기 위젯 */}
      {pendingApprovals.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <FilePen size={15} className="text-amber-600" />
              <h3 className="font-semibold text-amber-800 text-sm">결재 대기</h3>
              <span className="text-[11px] bg-amber-400 text-white font-bold px-1.5 py-0.5 rounded-full">
                {pendingApprovals.length}
              </span>
            </div>
            <button
              onClick={() => navigate('/approval')}
              className="text-xs text-amber-600 hover:underline flex items-center gap-0.5 font-medium"
            >
              전체 보기 <ArrowRight size={12} />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {pendingApprovals.slice(0, 3).map((a) => (
              <button
                key={a.id}
                onClick={() => navigate('/approval')}
                className="bg-white rounded-xl border border-amber-200 px-3 py-2.5 text-left hover:border-amber-400 transition-colors"
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <Clock size={11} className="text-amber-500 shrink-0" />
                  <span className="text-[11px] text-amber-600 font-medium">{a.type}</span>
                </div>
                <p className="text-xs font-semibold text-gray-800 truncate">{a.title}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">{a.author_name} · {a.author_dept}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Bottom tables */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Upcoming schedules */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800 text-sm">다가오는 일정</h3>
            <button
              onClick={() => navigate('/schedule')}
              className="text-xs text-blue-500 hover:underline flex items-center gap-0.5"
            >
              전체 보기 <ArrowRight size={12} />
            </button>
          </div>
          {upcomingSchedules.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-gray-300">
              <CalendarDays size={28} />
              <p className="text-xs mt-2 text-gray-400">예정된 일정 없음</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 text-xs text-gray-400 font-medium pb-2 border-b mb-2">
                <span>일정</span>
                <span className="text-right">날짜</span>
              </div>
              <div className="space-y-2.5">
                {upcomingSchedules.map((s) => (
                  <div key={s.id} className="grid grid-cols-2 items-center">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{
                          backgroundColor: CATEGORY_COLORS[s.category] ?? '#9ca3af',
                        }}
                      />
                      <span className="text-xs text-gray-700 truncate">{s.title}</span>
                    </div>
                    <span className="text-xs text-blue-500 text-right">
                      {format(new Date(s.startDate), 'MM-dd EEE', { locale: ko })}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Recent reports */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800 text-sm">최근 보고서</h3>
            <button
              onClick={() => navigate('/weekly-report')}
              className="text-xs text-blue-500 hover:underline flex items-center gap-0.5"
            >
              전체 보기 <ArrowRight size={12} />
            </button>
          </div>
          {recentReports.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-gray-300">
              <FileText size={28} />
              <p className="text-xs mt-2 text-gray-400">보고서 없음</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 text-xs text-gray-400 font-medium pb-2 border-b mb-2">
                <span>보고서</span>
                <span className="text-right">상태</span>
              </div>
              <div className="space-y-2.5">
                {recentReports.map((r) => (
                  <div key={r.id} className="grid grid-cols-2 items-center gap-2">
                    <div className="min-w-0">
                      <p className="text-xs text-gray-700 truncate">{r.department}</p>
                      <p className="text-xs text-gray-400">
                        {format(new Date(r.weekStart), 'M/d')}~
                        {format(new Date(r.weekEnd), 'M/d')}
                      </p>
                    </div>
                    <span
                      className={clsx(
                        'text-xs px-2 py-0.5 rounded-full font-medium text-center',
                        r.status === '제출됨'
                          ? 'bg-blue-100 text-blue-700'
                          : r.status === '완료'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-amber-100 text-amber-700'
                      )}
                    >
                      {r.status}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Recent documents */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800 text-sm">최근 문서</h3>
            <button
              onClick={() => navigate('/documents')}
              className="text-xs text-blue-500 hover:underline flex items-center gap-0.5"
            >
              전체 보기 <ArrowRight size={12} />
            </button>
          </div>
          {recentDocs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-gray-300">
              <FolderOpen size={28} />
              <p className="text-xs mt-2 text-gray-400">문서 없음</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 text-xs text-gray-400 font-medium pb-2 border-b mb-2">
                <span>문서명</span>
                <span className="text-right">날짜</span>
              </div>
              <div className="space-y-2.5">
                {recentDocs.map((doc) => (
                  <div key={doc.id} className="grid grid-cols-2 items-center gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-6 h-6 bg-gray-100 rounded flex items-center justify-center shrink-0">
                        <FileText size={11} className="text-gray-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-gray-700 truncate">{doc.title}</p>
                        <p className="text-xs text-gray-400">{doc.category}</p>
                      </div>
                    </div>
                    <span className="text-xs text-blue-500 text-right">
                      {format(new Date(doc.updatedAt), 'MM-dd')}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── 개인 TODO ── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CheckSquare size={16} className="text-indigo-500" />
            <h3 className="font-semibold text-gray-800 text-sm">개인 할 일</h3>
            {todos.filter((t) => !t.completed).length > 0 && (
              <span className="text-[10px] bg-indigo-100 text-indigo-600 font-bold px-1.5 py-0.5 rounded-full">
                {todos.filter((t) => !t.completed).length}
              </span>
            )}
          </div>
          <div className="flex gap-1">
            {(['all', 'active', 'done'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setTodoFilter(f)}
                className={clsx(
                  'text-xs px-2.5 py-1 rounded-lg transition-colors font-medium',
                  todoFilter === f
                    ? 'bg-indigo-500 text-white'
                    : 'text-gray-400 hover:bg-gray-100'
                )}
              >
                {f === 'all' ? '전체' : f === 'active' ? '미완료' : '완료'}
              </button>
            ))}
          </div>
        </div>

        {/* 입력 폼 */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!todoInput.trim()) return;
            addTodo(todoInput.trim(), todoPriority);
            setTodoInput('');
          }}
          className="flex gap-2 mb-4"
        >
          <div className="flex-1 flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-indigo-300 focus-within:border-indigo-400 transition-all">
            <Plus size={14} className="text-gray-400 shrink-0" />
            <input
              type="text"
              value={todoInput}
              onChange={(e) => setTodoInput(e.target.value)}
              placeholder="새 할 일 추가..."
              className="flex-1 text-sm outline-none bg-transparent placeholder:text-gray-400"
            />
            <select
              value={todoPriority}
              onChange={(e) => setTodoPriority(e.target.value as typeof todoPriority)}
              className="text-xs border-0 outline-none bg-transparent text-gray-400 cursor-pointer"
            >
              <option value="high">🔴 높음</option>
              <option value="medium">🟡 보통</option>
              <option value="low">🟢 낮음</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={!todoInput.trim()}
            className="px-4 py-2 bg-indigo-500 text-white text-sm font-medium rounded-xl hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.97]"
          >
            추가
          </button>
        </form>

        {/* TODO 목록 */}
        {(() => {
          const filtered = todos.filter((t) =>
            todoFilter === 'all' ? true : todoFilter === 'active' ? !t.completed : t.completed
          );
          const PRIORITY_COLOR: Record<string, string> = {
            high: 'text-red-400',
            medium: 'text-amber-400',
            low: 'text-emerald-400',
          };
          if (filtered.length === 0) {
            return (
              <div className="flex flex-col items-center py-8 text-gray-300">
                <CheckSquare size={28} />
                <p className="text-xs mt-2 text-gray-400">
                  {todoFilter === 'done' ? '완료된 항목 없음' : '할 일을 추가해보세요!'}
                </p>
              </div>
            );
          }
          return (
            <div className="space-y-1.5 max-h-[280px] overflow-y-auto">
              {filtered.map((todo) => (
                <div
                  key={todo.id}
                  className={clsx(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl group transition-colors',
                    todo.completed ? 'bg-gray-50' : 'bg-white border border-gray-100 hover:border-indigo-200'
                  )}
                >
                  <button
                    onClick={() => toggleTodo(todo.id)}
                    className="shrink-0 text-gray-300 hover:text-indigo-500 transition-colors"
                  >
                    {todo.completed
                      ? <CheckSquare size={17} className="text-indigo-400" />
                      : <Square size={17} />}
                  </button>
                  <Flag size={13} className={clsx('shrink-0', PRIORITY_COLOR[todo.priority])} />
                  <span
                    className={clsx(
                      'flex-1 text-sm truncate',
                      todo.completed ? 'line-through text-gray-400' : 'text-gray-700'
                    )}
                  >
                    {todo.title}
                  </span>
                  <button
                    onClick={() => deleteTodo(todo.id)}
                    className="shrink-0 text-gray-200 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          );
        })()}

        {/* 완료 항목 정리 버튼 */}
        {todos.some((t) => t.completed) && (
          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
            <span>{todos.filter((t) => t.completed).length}개 완료</span>
            <button
              onClick={() => {
                todos.filter((t) => t.completed).forEach((t) => deleteTodo(t.id));
              }}
              className="text-red-400 hover:text-red-500 transition-colors"
            >
              완료 항목 삭제
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
