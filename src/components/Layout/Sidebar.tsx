import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  CalendarDays,
  FileText,
  BrainCircuit,
  FolderOpen,
  Building2,
  Users,
  LogOut,
  MessageSquare,
  Megaphone,
  BookUser,
  Trash2,
  FilePen,
} from 'lucide-react';
import { useMessengerStore } from '../../store/messengerStore';
import clsx from 'clsx';
import { useAuthStore } from '../../store/authStore';
import { RoleLabels } from '../../types';

const navItems = [
  { to: '/', label: '대시보드', icon: LayoutDashboard, end: true },
  { to: '/schedule', label: '일정 관리', icon: CalendarDays },
  { to: '/approval', label: '전자결재', icon: FilePen },
  { to: '/weekly-report', label: '주간 업무 보고', icon: FileText },
  { to: '/notices', label: '공지사항', icon: Megaphone },
  { to: '/ai-summary', label: 'AI 내용 요약', icon: BrainCircuit },
  { to: '/documents', label: '문서 관리', icon: FolderOpen },
  { to: '/contacts', label: '주소록', icon: BookUser },
  { to: '/messenger', label: '메신저', icon: MessageSquare },
  { to: '/trash', label: '휴지통', icon: Trash2 },
];

export default function Sidebar() {
  const { currentUser, logout } = useAuthStore();
  const { connected, onlineUsers } = useMessengerStore();

  return (
    <aside
      className="w-64 min-h-screen flex flex-col"
      style={{ background: 'linear-gradient(170deg, #0f172a 0%, #1e1b4b 100%)' }}
    >
      {/* 로고 */}
      <div className="px-5 pt-6 pb-4 flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shadow-lg shrink-0"
          style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)' }}
        >
          <Building2 size={18} className="text-white" />
        </div>
        <div>
          <p className="font-bold text-sm text-white tracking-tight leading-tight">오피스 자동화</p>
          <p className="text-[10px] font-medium" style={{ color: '#818cf8' }}>
            Office Automation
          </p>
        </div>
      </div>

      {/* 구분선 */}
      <div className="mx-5 h-px mb-4" style={{ background: 'rgba(255,255,255,0.06)' }} />

      {/* 네비게이션 */}
      <nav className="flex-1 px-3 space-y-0.5">
        <p className="text-[9px] font-bold uppercase tracking-widest px-3 pb-2" style={{ color: '#6366f1' }}>
          메인 메뉴
        </p>
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
                isActive
                  ? 'text-white shadow-lg shadow-blue-900/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              )
            }
            style={({ isActive }) =>
              isActive ? { background: 'linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)' } : {}
            }
          >
            <Icon size={16} className="shrink-0" />
            <span className="flex-1">{label}</span>
            {to === '/messenger' && (
              connected && onlineUsers.length > 0 ? (
                <span className="min-w-[18px] h-[18px] bg-emerald-400 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 shadow-sm shadow-emerald-400/60">
                  {onlineUsers.length > 9 ? '9+' : onlineUsers.length}
                </span>
              ) : (
                <span
                  className={clsx(
                    'w-2 h-2 rounded-full shrink-0',
                    connected ? 'bg-emerald-400 shadow-sm shadow-emerald-400/60' : 'bg-slate-600'
                  )}
                />
              )
            )}
          </NavLink>
        ))}

        {/* 관리자 전용 */}
        {currentUser?.role === 'admin' && (
          <>
            <div className="pt-4 pb-2 px-3">
              <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: '#6366f1' }}>
                관리자
              </p>
            </div>
            <NavLink
              to="/users"
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
                  isActive
                    ? 'text-white shadow-lg shadow-blue-900/40'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                )
              }
              style={({ isActive }) =>
                isActive ? { background: 'linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)' } : {}
              }
            >
              <Users size={16} className="shrink-0" />
              사용자 관리
            </NavLink>
          </>
        )}
      </nav>

      {/* 하단 사용자 카드 */}
      <div className="p-3">
        <div
          className="flex items-center gap-3 px-3 py-3 rounded-xl"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.07)',
          }}
        >
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
            style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)' }}
          >
            {currentUser?.name?.[0] ?? '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate leading-tight">
              {currentUser?.name ?? '-'}
            </p>
            <p className="text-[11px] truncate leading-tight mt-0.5" style={{ color: '#94a3b8' }}>
              {currentUser?.department}
              {'\u00A0\u00B7\u00A0'}
              {currentUser ? RoleLabels[currentUser.role] : ''}
            </p>
          </div>
          <button
            onClick={logout}
            className="p-1.5 rounded-lg transition-colors hover:bg-white/10 shrink-0"
            style={{ color: '#64748b' }}
            title="로그아웃"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}
