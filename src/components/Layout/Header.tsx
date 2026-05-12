import { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, Search, CalendarDays, FileText, X, ExternalLink, Megaphone, FolderOpen, Sun, Moon, MessageSquare } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { useScheduleStore } from '../../store/scheduleStore';
import { useReportStore } from '../../store/reportStore';

import { useDocumentStore } from '../../store/documentStore';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { useNotificationStore } from '../../store/notificationStore';
import { RoleLabels } from '../../types';
import ProfileModal from './ProfileModal';

interface HeaderProps {
  title: string;
}

/* ══════════════════════════════════════
   통합 검색
══════════════════════════════════════ */
type SearchCategory = '일정' | '문서' | '주간보고';

interface SearchResult {
  id: string;
  category: SearchCategory;
  title: string;
  sub: string;
  route: string;
}

const SEARCH_ICON_MAP: Record<SearchCategory, { Icon: typeof CalendarDays; color: string; bg: string }> = {
  일정:    { Icon: CalendarDays, color: 'text-blue-500',  bg: 'bg-blue-50'  },
  문서:    { Icon: FolderOpen,   color: 'text-green-500', bg: 'bg-green-50' },
  주간보고: { Icon: FileText,     color: 'text-amber-500', bg: 'bg-amber-50' },
};

function useGlobalSearch(query: string): SearchResult[] {
  const { schedules } = useScheduleStore();
  const { documents }  = useDocumentStore();
  const { reports }    = useReportStore();

  if (!query.trim()) return [];
  const q = query.toLowerCase();
  const results: SearchResult[] = [];

  // 일정
  schedules
    .filter((s) => s.title.toLowerCase().includes(q) || (s.description ?? '').toLowerCase().includes(q) || (s.location ?? '').toLowerCase().includes(q))
    .slice(0, 4)
    .forEach((s) => {
      results.push({
        id: `sch-${s.id}`,
        category: '일정',
        title: s.title,
        sub: `${s.category} · ${format(new Date(s.startDate), 'M/d', { locale: ko })}${s.location ? ` · ${s.location}` : ''}`,
        route: '/schedule',
      });
    });

  // 문서
  documents
    .filter((d) => d.title.toLowerCase().includes(q) || d.content.toLowerCase().includes(q) || d.tags.some((t) => t.toLowerCase().includes(q)))
    .slice(0, 4)
    .forEach((d) => {
      results.push({
        id: `doc-${d.id}`,
        category: '문서',
        title: d.title,
        sub: `${d.category} · ${d.tags.slice(0, 2).join(', ')}`,
        route: '/documents',
      });
    });

  // 주간보고
  reports
    .filter((r) =>
      r.author.toLowerCase().includes(q) ||
      r.department.toLowerCase().includes(q) ||
      r.completedTasks.some((t) => t.content.toLowerCase().includes(q)) ||
      r.inProgressTasks.some((t) => t.content.toLowerCase().includes(q))
    )
    .slice(0, 3)
    .forEach((r) => {
      results.push({
        id: `rep-${r.id}`,
        category: '주간보고',
        title: `${r.department} ${r.author} 주간보고`,
        sub: `${r.weekStart} ~ ${r.weekEnd} · ${r.status}`,
        route: '/weekly-report',
      });
    });

  return results;
}


const NOTIF_ICON_MAP: Record<string, { Icon: typeof CalendarDays; color: string; bg: string }> = {
  mention:          { Icon: MessageSquare, color: 'text-indigo-500', bg: 'bg-indigo-50' },
  dm:               { Icon: MessageSquare, color: 'text-blue-500',   bg: 'bg-blue-50'   },
  notice:           { Icon: Megaphone,     color: 'text-green-600',  bg: 'bg-green-50'  },
  report_approved:  { Icon: FileText,      color: 'text-green-600',  bg: 'bg-green-50'  },
  report_rejected:  { Icon: FileText,      color: 'text-red-500',    bg: 'bg-red-50'    },
  report_submitted: { Icon: FileText,      color: 'text-amber-500',  bg: 'bg-amber-50'  },
  default:          { Icon: Bell,          color: 'text-gray-400',   bg: 'bg-gray-50'   },
};

function getNotifIcon(type: string) {
  return NOTIF_ICON_MAP[type] ?? NOTIF_ICON_MAP.default;
}


export default function Header({ title }: HeaderProps) {
  const today    = format(new Date(), 'yyyy년 M월 d일 (EEEE)', { locale: ko });
  const navigate = useNavigate();

  /* ── 검색 상태 ── */
  const [searchQuery,  setSearchQuery]  = useState('');
  const [searchOpen,   setSearchOpen]   = useState(false);
  const [searchFocus,  setSearchFocus]  = useState(-1); // 키보드 포커스 인덱스
  const searchRef  = useRef<HTMLDivElement>(null);
  const searchResults = useGlobalSearch(searchQuery);

  /* 검색 외부 클릭 닫기 */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
        setSearchFocus(-1);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') { setSearchOpen(false); setSearchFocus(-1); return; }
    if (!searchResults.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSearchFocus((prev) => Math.min(prev + 1, searchResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSearchFocus((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && searchFocus >= 0) {
      e.preventDefault();
      navigate(searchResults[searchFocus].route);
      setSearchQuery('');
      setSearchOpen(false);
      setSearchFocus(-1);
    }
  }, [searchResults, searchFocus, navigate]);

  const handleSearchResultClick = (result: SearchResult) => {
    navigate(result.route);
    setSearchQuery('');
    setSearchOpen(false);
    setSearchFocus(-1);
  };


  const [bellOpen,      setBellOpen]      = useState(false);
  const [expandedId,    setExpandedId]    = useState<string | null>(null);
  const [profileOpen,   setProfileOpen]   = useState(false);
  const bellRef      = useRef<HTMLDivElement>(null);

  const { currentUser } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const { notifications, unreadCount, fetch: fetchNotifs, markAllRead, remove } = useNotificationStore();

  // 알림 주기적 불러오기
  useEffect(() => {
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 30_000);
    return () => clearInterval(interval);
  }, [fetchNotifs]);

  // 번 열면 읽지 않은 알림 읽음 처리
  useEffect(() => {
    if (bellOpen && unreadCount > 0) {
      const timer = setTimeout(() => markAllRead(), 1500);
      return () => clearTimeout(timer);
    }
  }, [bellOpen, unreadCount, markAllRead]);

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

  /* 단일 클릭 → 상세 펼치기 / 페이지 이동 버튼 분리 */
  const handleItemClick = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const handleItemNavigate = (e: React.MouseEvent, link: string) => {
    e.stopPropagation();
    if (link) navigate(link);
    setBellOpen(false);
    setExpandedId(null);
  };

  /* X 버튼 – 알림 개별 삭제 */
  const handleDismiss = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    remove(id);
    if (expandedId === id) setExpandedId(null);
  };

  /* 모두 삭제 */
  const dismissAll = () => {
    useNotificationStore.getState().clearAll();
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
        {/* ── 통합 검색 ── */}
        <div ref={searchRef} className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setSearchOpen(true); setSearchFocus(-1); }}
            onFocus={() => setSearchOpen(true)}
            onKeyDown={handleSearchKeyDown}
            placeholder="일정, 문서, 보고서 검색..."
            className="pl-9 pr-8 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-56 transition-all focus:w-64"
          />
          {searchQuery && (
            <button
              onClick={() => { setSearchQuery(''); setSearchOpen(false); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={14} />
            </button>
          )}

          {/* 검색 결과 드롭다운 */}
          {searchOpen && searchQuery.trim() && (
            <div className="absolute left-0 top-full mt-2 bg-white rounded-xl shadow-2xl border border-gray-100 z-50 overflow-hidden" style={{ width: 340 }}>
              {searchResults.length === 0 ? (
                <div className="px-4 py-8 text-center text-gray-400">
                  <Search size={28} className="mx-auto mb-2 text-gray-200" />
                  <p className="text-sm">"{searchQuery}"에 대한 결과 없음</p>
                </div>
              ) : (
                <>
                  <div className="px-4 py-2 border-b border-gray-100 bg-gray-50">
                    <p className="text-xs text-gray-500 font-medium">{searchResults.length}개 결과 · ↑↓ 탐색 · Enter 이동</p>
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
                    {searchResults.map((result, idx) => {
                      const { Icon, color, bg } = SEARCH_ICON_MAP[result.category];
                      const isActive = idx === searchFocus;
                      return (
                        <button
                          key={result.id}
                          onMouseDown={(e) => { e.preventDefault(); handleSearchResultClick(result); }}
                          onMouseEnter={() => setSearchFocus(idx)}
                          className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${isActive ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                        >
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${bg}`}>
                            <Icon size={15} className={color} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-gray-400 mb-0.5">{result.category}</p>
                            <p className="text-sm font-medium text-gray-800 truncate">{result.title}</p>
                            <p className="text-xs text-gray-400 truncate">{result.sub}</p>
                          </div>
                          <ExternalLink size={13} className="text-gray-300 shrink-0" />
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* 알림 벨 */}
        <div ref={bellRef} className="relative">
          <button
            onClick={() => { setBellOpen((v) => !v); setExpandedId(null); }}
            className="relative p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5 animate-pulse">
                {unreadCount > 9 ? '9+' : unreadCount}
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
                  {notifications.length > 0 && (
                    <span className="text-xs bg-red-100 text-red-600 font-bold px-1.5 py-0.5 rounded-full">
                      {notifications.length}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {notifications.length > 0 && (
                    <button
                      onClick={dismissAll}
                      className="text-xs text-gray-400 hover:text-red-500 px-2 py-1 rounded transition-colors flex items-center gap-1"
                    >
                      <X size={11} /> 모두 삭제
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
              {/* ── 알림 목록 ── */}
              <div className="max-h-[440px] overflow-y-auto divide-y divide-gray-50">
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                    <Bell size={30} className="mb-2 text-gray-200" />
                    <p className="text-sm">새로운 알림이 없습니다</p>
                  </div>
                ) : (
                  notifications.map((n) => {
                    const { Icon, color, bg } = getNotifIcon(n.type);
                    const isExpanded = expandedId === n.id;

                    return (
                      <div key={n.id}>
                        {/* 알림 행 */}
                        <div
                          onClick={() => handleItemClick(n.id)}
                          className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors select-none ${
                            !n.isRead ? 'bg-blue-50/30' : ''
                          } ${isExpanded ? 'bg-blue-50/70' : 'hover:bg-gray-50'}`}
                        >
                          {/* 아이콘 */}
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${bg}`}>
                            <Icon size={15} className={color} />
                          </div>

                          {/* 내용 */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1 mb-0.5">
                              {!n.isRead && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />}
                              <p className="text-sm text-gray-800 font-medium leading-snug truncate">{n.title}</p>
                            </div>
                            {n.body && <p className="text-xs text-gray-400 truncate">{n.body}</p>}
                            <p className="text-[10px] text-gray-300 mt-0.5">
                              {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: ko })}
                            </p>
                          </div>

                          {/* 우측 버튼 */}
                          <div className="flex items-center gap-0.5 shrink-0 ml-1 mt-0.5">
                            {n.link && (
                              <button
                                onClick={(e) => handleItemNavigate(e, n.link)}
                                className="p-0.5 rounded text-gray-300 hover:text-blue-500 hover:bg-blue-50 transition-colors"
                                title="페이지로 이동"
                              >
                                <ExternalLink size={13} />
                              </button>
                            )}
                            <button
                              onClick={(e) => handleDismiss(e, n.id)}
                              className="p-0.5 rounded text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors"
                              title="알림 삭제"
                            >
                              <X size={13} />
                            </button>
                          </div>
                        </div>

                        {/* ── 확장 미리보기 ── */}
                        {isExpanded && n.body && (
                          <div className="mx-4 mb-3 p-3 bg-white rounded-lg border border-blue-100 shadow-sm">
                            <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap">{n.body}</p>
                            {n.link && (
                              <button
                                onClick={() => { navigate(n.link); setBellOpen(false); setExpandedId(null); }}
                                className="mt-2 flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 font-medium transition-colors"
                              >
                                <ExternalLink size={11} />
                                페이지로 이동
                              </button>
                            )}
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

        {/* ── 다크 모드 토글 ── */}
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
          className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-800"
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>

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
