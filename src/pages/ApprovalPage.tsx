import { useState, useEffect } from 'react';
import {
  FilePen,
  Clock,
  CheckCircle2,
  XCircle,
  Ban,
  Plus,
  Inbox,
  RefreshCw,
} from 'lucide-react';
import { useApprovalStore } from '../store/approvalStore';
import { useAuthStore } from '../store/authStore';
import type { Approval, ApprovalStatus } from '../types';
import { ApprovalStatusLabel } from '../types';
import ApprovalFormModal from '../components/Approval/ApprovalFormModal';
import ApprovalDetailModal from '../components/Approval/ApprovalDetailModal';

type Tab = 'mine' | 'pending' | 'done';

const STATUS_CONFIG: Record<ApprovalStatus, { icon: any; cls: string }> = {
  pending: { icon: Clock, cls: 'bg-amber-50 text-amber-700 border border-amber-200' },
  approved: { icon: CheckCircle2, cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  rejected: { icon: XCircle, cls: 'bg-red-50 text-red-700 border border-red-200' },
  cancelled: { icon: Ban, cls: 'bg-gray-100 text-gray-500 border border-gray-200' },
};

const TYPE_COLOR: Record<string, string> = {
  '품의서': 'bg-blue-100 text-blue-700',
  '지출결의서': 'bg-orange-100 text-orange-700',
  '휴가신청': 'bg-emerald-100 text-emerald-700',
  '출장신청': 'bg-violet-100 text-violet-700',
  '구매요청': 'bg-rose-100 text-rose-700',
  '기타': 'bg-gray-100 text-gray-600',
};

function ApprovalCard({ approval, onClick }: { approval: Approval; onClick: () => void }) {
  const cfg = STATUS_CONFIG[approval.status];
  const Icon = cfg.icon;
  const currentStep = approval.steps.find((s) => s.status === 'pending');

  const formatDate = (s: string) =>
    new Date(s).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-blue-200 transition-all p-4 group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${TYPE_COLOR[approval.type] || 'bg-gray-100 text-gray-600'}`}>
            {approval.type}
          </span>
          <h3 className="text-sm font-semibold text-gray-800 truncate group-hover:text-blue-600 transition-colors">
            {approval.title}
          </h3>
        </div>
        <span className={`shrink-0 flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${cfg.cls}`}>
          <Icon size={11} />
          {ApprovalStatusLabel[approval.status]}
        </span>
      </div>

      <div className="mt-2.5 flex items-center justify-between text-xs text-gray-400">
        <div className="flex items-center gap-2">
          <span>{approval.author_name}</span>
          <span>·</span>
          <span>{approval.author_dept}</span>
          {approval.amount > 0 && (
            <>
              <span>·</span>
              <span className="text-gray-600 font-medium">{approval.amount.toLocaleString()}원</span>
            </>
          )}
        </div>
        <span>{formatDate(approval.created_at)}</span>
      </div>

      {/* 결재선 미니 표시 */}
      <div className="mt-2.5 flex items-center gap-1">
        {approval.steps.map((step, i) => (
          <div key={step.id} className="flex items-center gap-0.5">
            {i > 0 && <div className="w-3 h-px bg-gray-200" />}
            <div
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                step.status === 'approved'
                  ? 'bg-emerald-100 text-emerald-600'
                  : step.status === 'rejected'
                  ? 'bg-red-100 text-red-600'
                  : step.id === currentStep?.id
                  ? 'bg-amber-100 text-amber-600 ring-1 ring-amber-300'
                  : 'bg-gray-100 text-gray-400'
              }`}
            >
              {step.approver_name}
            </div>
          </div>
        ))}
      </div>
    </button>
  );
}

export default function ApprovalPage() {
  const [tab, setTab] = useState<Tab>('mine');
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<Approval | null>(null);
  const { mine, pending, done, loading, fetchAll } = useApprovalStore();
  const { currentUser } = useAuthStore();

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const list = tab === 'mine' ? mine : tab === 'pending' ? pending : done;

  const TABS: { key: Tab; label: string; count: number }[] = [
    { key: 'mine', label: '내 기안', count: mine.length },
    { key: 'pending', label: '결재 대기', count: pending.length },
    { key: 'done', label: '완료', count: done.length },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FilePen size={24} className="text-blue-600" />
            전자결재
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">결재 기안 및 처리</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchAll}
            className="p-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition-colors text-gray-500 hover:text-gray-700"
            title="새로고침"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm shadow-blue-200 transition-colors"
            style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)' }}
          >
            <Plus size={16} />
            기안 작성
          </button>
        </div>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 bg-white rounded-2xl p-1 border border-gray-100 shadow-sm mb-5 w-fit">
        {TABS.map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              tab === key
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            {label}
            {count > 0 && (
              <span
                className={`text-[11px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1 ${
                  tab === key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                } ${key === 'pending' && tab !== key ? 'bg-amber-100 text-amber-600' : ''}`}
              >
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 목록 */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400 text-sm">
          <RefreshCw size={18} className="animate-spin mr-2" />
          불러오는 중...
        </div>
      ) : list.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <Inbox size={40} className="mb-3 text-gray-300" />
          <p className="text-sm font-medium">
            {tab === 'mine'
              ? '기안한 문서가 없습니다.'
              : tab === 'pending'
              ? '결재 대기 중인 문서가 없습니다.'
              : '완료된 결재가 없습니다.'}
          </p>
          {tab === 'mine' && (
            <button
              onClick={() => setShowForm(true)}
              className="mt-3 text-sm text-blue-500 hover:text-blue-600 font-medium"
            >
              + 첫 번째 기안 작성하기
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-3 max-w-3xl">
          {list.map((a) => (
            <ApprovalCard key={a.id} approval={a} onClick={() => setSelected(a)} />
          ))}
        </div>
      )}

      {/* 모달 */}
      {showForm && <ApprovalFormModal onClose={() => { setShowForm(false); fetchAll(); }} />}
      {selected && (
        <ApprovalDetailModal
          approval={selected}
          onClose={() => { setSelected(null); fetchAll(); }}
        />
      )}
    </div>
  );
}
