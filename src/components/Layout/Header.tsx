import { useState, useEffect, useRef } from 'react';
import { Bell, Search, CalendarDays, FileText, BrainCircuit, X, ExternalLink, Megaphone } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { useScheduleStore } from '../../store/scheduleStore';
import { useReportStore } from '../../store/reportStore';
import { useAISummaryStore } from '../../store/aiSummaryStore';
import { useAuthStore } from '../../store/authStore';
import { RoleLabels } from '../../types';
import ProfileModal from './ProfileModal';

interface HeaderProps {
  title: string;
}

type NotifTag = '내 작성' | '공지' | '전체 보고';
type IconName = 'calendar' | 'report' | 'ai' | 'notice';

interface NotifItem {
  id: string;
  iconName: IconName;
  title: string;
  sub: string;
  detail: string;
  time: string;
  route: string;
  tag: NotifTag;
}

const ICON_MAP: Record<IconName, { Icon: typeof CalendarDays; color: string; bg: string }> = {
  calendar: { Icon: CalendarDays, color: 'text-blue-500',   bg: 'bg-blue-50'   },
  report:   { Icon: FileText,     color: 'text-amber-500',  bg: 'bg-amber-50'  },
  ai:       { Icon: BrainCircuit, color: 'text-purple-500', bg: 'bg-purple-50' },
  notice:   { Icon: Megaphone,    color: 'text-green-600',  bg: 'bg-green-50'  },
};

const TAG_COLORS: Record<NotifTag, string> = {
  '내 작성':  'bg-blue-100   text-blue-600',
  '공지':     'bg-green-100  text-green-700',
  '전체 보고': 'bg-orange-100 text-orange-600',
};

function useNotifications(dismissedIds: Set<string>): NotifItem[] {
  const { schedules } = useScheduleStore();
  const { reports }   = useReportStore();
  const { summaries } = useAISummaryStore();
  const { currentUser } = useAuthStore();

  const now         = new Date();
  const todayStr    = format(now, 'yyyy-MM-dd');
  const tomorrowStr = format(new Date(now.getTime() + 86_400_000), 'yyyy-MM-dd');

  const items: NotifItem[] = [];

  /* ① 오늘·내일 일정 (공지성 공용 일정) */
  schedules
    .filter((s) => s.startDate.startsWith(todayStr) || s.startDate.startsWith(tomorrowStr))
    .slice(0, 3)
    .forEach((s) => {
      const id = `sch-${s.id}`;
      if (dismissedIds.has(id)) return;
      items.push({
        id,
        iconName: 'calendar',
        title: s.startDate.startsWith(todayStr) ? `[오늘] ${s.title}` : `[내일] ${s.title}`,
        sub: s.allDay ? '종일' : format(new Date(s.startDate), 'HH:mm'),
        detail: s.description?.trim() || '(설명 없음)',
        time: format(new Date(s.createdAt), 'M/d HH:mm'),
        route: '/schedule',
        tag: '공지',
      });
    });

  /* ② 내가 작성한 미제출 보고서 */
  reports
    .filter((r) => r.author === currentUser?.name && r.status === '작성중')
    .slice(0, 3)
    .forEach((r) => {
      const id = `rep-my-${r.id}`;
      if (dismissedIds.has(id)) return;
      items.push({
        id,
        iconName: 'report',
        title: `[미제출] ${r.department} 주간보고`,
        sub: `${format(new Date(r.weekStart), 'M/d')} ~ ${format(new Date(r.weekEnd), 'M/d')}`,
        detail: `작성자: ${r.author} | 완료업무 ${r.completedTasks.length}건 | 진행중 ${r.inProgressTasks.length}건`,
        time: format(new Date(r.updatedAt), 'M/d HH:mm'),
        route: '/reports',
        tag: '내 작성',
      });
    });

  /* ③ 전체 제출 완료 보고서 (전체 보고사항) */
  reports
    .filter((r) => r.status === '제출됨')
    .slice(0, 4)
    .forEach((r) => {
      const id = `rep-all-${r.id}`;
      if (dismissedIds.has(id)) return;
      items.push({
        id,
        iconName: 'notice',
        title: `[제출완료] ${r.department} 주간보고`,
        sub: `${r.author} | ${format(new Date(r.weekStart), 'M/d')} ~ ${format(new Date(r.weekEnd), 'M/d')}`,
        detail: `완료업무 ${r.completedTasks.length}건 | 진행중 ${r.inProgressTasks.length}건${r.aiSummary ? ' | AI 요약 있음' : ''}`,
        time: format(new Date(r.updatedAt), 'M/d HH:mm'),
        route: '/reports',
        tag: '전체 보고',
      });
    });

  /* ④ 최근 AI 요약 (내 작성) */
  summaries
    .slice(-2)
    .reverse()
    .forEach((s) => {
      const id = `ai-${s.id}`;
      if (dismissedIds.has(id)) return;
      items.push({
        id,
        iconName: 'ai',
        title: `[AI 요약] ${s.title}`,
        sub: s.keywords.slice(0, 3).join(', ') || s.originalText.slice(0, 25),
        detail: s.summaryText.slice(0, 100) + (s.summaryText.length > 100 ? '…' : ''),
        time: format(new Date(s.createdAt), 'M/d HH:mm'),
        route: '/ai-summary',
        tag: '내 작성',
      });
    });

  return items;
}

export default function Header({ title }: HeaderProps) {
  const today    = format(new Date(), 'yyyy년 M월 d일 (EEEE)', { locale: ko });
  const navigate = useNavigate();

  const [bellOpen,      setBellOpen]      = useState(false);
  const [dismissedIds,  setDismissedIds]  = useState<Set<string>>(new Set());
  const [expandedId,    setExpandedId]    = useState<string | null>(null);
  const [profileOpen,   setProfileOpen]   = useState(false);
  const bellRef      = useRef<HTMLDivElement>(null);
  const clickTimers  = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const { currentUser } = useAuthStore();
  const notifications = useNotifications(dismissedIds);
  const count         = notifications.length;

  /* 외부 클릭 시 드롭다운 닫기 */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setBellOpen(false);
        setExpandedId(null);
      }
    };
    if (bellOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [bellOpen]);

  /* 단일 클릭 → 미리보기 / 더블 클릭 → 페이지 이동 */
  const handleItemClick = (id: string, route: string) => {
    if (clickTimers.current[id]) {
      clearTimeout(clickTimers.current[id]);
      delete clickTimers.current[id];
      navigate(route);
      setBellOpen(false);
      setExpandedId(null);
    } else {
      clickTimers.current[id] = setTimeout(() => {
        delete clickTimers.current[id];
        setExpandedId((prev) => (prev === id ? null : id));
      }, 280);
    }
  };

  /* X 버튼 – 알림 개별 삭제 */
  const handleDismiss = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDismissedIds((prev) => new Set([...prev, id]));
    if (expandedId === id) setExpandedId(null);
  };

  /* 모두 삭제 */
  const dismissAll = () => {
    setDismissedIds(new Set(notifications.map((n) => n.id)));
    setExpandedId(null);
  };

  return (
    <>
    <header className="h-16 bg-white border-b border-gray-200 px-6 flex items-center justify-between">
      <div>
        <h1 className="text-lg font-semibold text-gray-800">{title}</h1>
        <p className="text-xs text-gray-400">{today}</p>
      </div>

      <div className="flex items-center gap-3">
        {/* 검색 */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="검색..."
            className="pl-9 pr-4 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
          />
        </div>

        {/* 알림 벨 */}
        <div ref={bellRef} className="relative">
          <button
            onClick={() => { setBellOpen((v) => !v); setExpandedId(null); }}
            className="relative p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Bell size={18} />
            {count > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5">
                {count > 9 ? '9+' : count}
              </span>
            )}
          </button>

          {bellOpen && (
            <div
              className="absolute right-0 top-full mt-2 bg-white rounded-xl shadow-2xl border border-gray-100 z-50 overflow-hidden"
              style={{ width: 360 }}
            >
              {/* ── 드롭다운 헤더 ── */}
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <Bell size={14} className="text-gray-500" />
                  <span className="text-sm font-semibold text-gray-800">알림</span>
                  {count > 0 && (
                    <span className="text-xs bg-red-100 text-red-600 font-bold px-1.5 py-0.5 rounded-full">
                      {count}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {count > 0 && (
                    <button
                      onClick={dismissAll}
                      className="text-xs text-gray-400 hover:text-red-500 px-2 py-1 rounded transition-colors"
                    >
                      모두 삭제
                    </button>
                  )}
                  <button
                    onClick={() => setBellOpen(false)}
                    className="p-1 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-200 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              {/* ── 사용법 안내 ── */}
              <div className="px-4 py-1.5 bg-blue-50 border-b border-blue-100">
                <p className="text-[11px] text-blue-500">
                  클릭: 미리보기&nbsp;&nbsp;|&nbsp;&nbsp;더블클릭: 페이지 이동&nbsp;&nbsp;|&nbsp;&nbsp;✕: 삭제
                </p>
              </div>

              {/* ── 알림 목록 ── */}
              <div className="max-h-[420px] overflow-y-auto divide-y divide-gray-50">
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                    <Bell size={30} className="mb-2 text-gray-200" />
                    <p className="text-sm">새로운 알림이 없습니다</p>
                  </div>
                ) : (
                  notifications.map((n) => {
                    const { Icon, color, bg } = ICON_MAP[n.iconName];
                    const isExpanded = expandedId === n.id;

                    return (
                      <div key={n.id}>
                        {/* 알림 행 */}
                        <div
                          onClick={() => handleItemClick(n.id, n.route)}
                          className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors select-none ${
                            isExpanded ? 'bg-blue-50/70' : 'hover:bg-gray-50'
                          }`}
                        >
                          {/* 아이콘 */}
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${bg}`}>
                            <Icon size={15} className={color} />
                          </div>

                          {/* 내용 */}
                          <div className="flex-1 min-w-0">
                            <span className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-full mb-1 ${TAG_COLORS[n.tag]}`}>
                              {n.tag}
                            </span>
                            <p className="text-sm text-gray-800 font-medium leading-snug truncate">{n.title}</p>
                            <p className="text-xs text-gray-400 mt-0.5 truncate">{n.sub}</p>
                          </div>

                          {/* 우측: X버튼 + 시간 */}
                          <div className="flex flex-col items-end gap-1 shrink-0 ml-1">
                            <button
                              onClick={(e) => handleDismiss(e, n.id)}
                              className="p-0.5 rounded text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors"
                              title="알림 삭제"
                            >
                              <X size={13} />
                            </button>
                            <span className="text-[10px] text-gray-400 whitespace-nowrap">{n.time}</span>
                          </div>
                        </div>

                        {/* ── 확장 미리보기 박스 (단일 클릭 시) ── */}
                        {isExpanded && (
                          <div className="mx-4 mb-3 p-3 bg-white rounded-lg border border-blue-100 shadow-sm">
                            <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap">{n.detail}</p>
                            <button
                              onClick={() => { navigate(n.route); setBellOpen(false); setExpandedId(null); }}
                              className="mt-2 flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 font-medium transition-colors"
                            >
                              <ExternalLink size={11} />
                              페이지로 이동
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── 구분선 ── */}
        <div className="w-px h-6 bg-gray-200" />

        {/* ── 프로필 아바타 버튼 ── */}
        <button
          onClick={() => setProfileOpen(true)}
          className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-gray-100 transition-colors group"
        >
          {/* 아바타 */}
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-extrabold text-white select-none shadow-sm group-hover:shadow-md transition-shadow"
            style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}
          >
            {currentUser?.name?.[0] ?? '?'}
          </div>
          {/* 이름 + 역할 */}
          <div className="text-left hidden sm:block">
            <p className="text-sm font-semibold text-gray-800 leading-tight">{currentUser?.name}</p>
            <p className="text-[11px] text-gray-400 leading-tight">
              {currentUser ? RoleLabels[currentUser.role] : ''}
            </p>
          </div>
        </button>
      </div>
    </header>

    {/* ── 프로필 모달 ── */}
    {profileOpen && (
      <ProfileModal onClose={() => setProfileOpen(false)} />
    )}
  </>
  );
}
