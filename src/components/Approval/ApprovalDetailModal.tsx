import { useState } from 'react';
import { X, CheckCircle2, XCircle, Clock, Ban, ChevronRight } from 'lucide-react';
import { useApprovalStore } from '../../store/approvalStore';
import { useAuthStore } from '../../store/authStore';
import type { Approval, ApprovalStatus } from '../../types';
import { ApprovalStatusLabel } from '../../types';

interface Props {
  approval: Approval;
  onClose: () => void;
}

const STATUS_STYLES: Record<ApprovalStatus, { bg: string; text: string; Icon: any }> = {
  pending: { bg: 'bg-amber-50 text-amber-700 border-amber-200', text: '결재 중', Icon: Clock },
  approved: { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', text: '승인', Icon: CheckCircle2 },
  rejected: { bg: 'bg-red-50 text-red-700 border-red-200', text: '반려', Icon: XCircle },
  cancelled: { bg: 'bg-gray-100 text-gray-500 border-gray-200', text: '취소', Icon: Ban },
};

const TYPE_COLORS: Record<string, string> = {
  '품의서': 'bg-blue-100 text-blue-700',
  '지출결의서': 'bg-orange-100 text-orange-700',
  '휴가신청': 'bg-emerald-100 text-emerald-700',
  '출장신청': 'bg-violet-100 text-violet-700',
  '구매요청': 'bg-rose-100 text-rose-700',
  '기타': 'bg-gray-100 text-gray-600',
};

export default function ApprovalDetailModal({ approval, onClose }: Props) {
  const { actionApproval, cancelApproval } = useApprovalStore();
  const { currentUser } = useAuthStore();
  const [comment, setComment] = useState('');
  const [actionMode, setActionMode] = useState<'approve' | 'reject' | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const statusStyle = STATUS_STYLES[approval.status];

  // 내가 처리해야 할 step 찾기
  const myPendingStep = approval.steps.find(
    (s) => s.approver_id === currentUser?.id && s.status === 'pending'
  );
  // 내 step 앞에 아직 pending인 step이 있으면 내 차례 아님
  const isMyTurn = myPendingStep
    ? !approval.steps.some(
        (s) => s.step_order < myPendingStep.step_order && s.status === 'pending'
      )
    : false;

  const isAuthor = approval.author_id === currentUser?.id;

  const handleAction = async (action: 'approved' | 'rejected') => {
    setSubmitting(true);
    try {
      await actionApproval(approval.id, action, comment);
      onClose();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm('결재를 취소하시겠습니까?')) return;
    try {
      await cancelApproval(approval.id);
      onClose();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const formatDate = (s: string | null) =>
    s ? new Date(s).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 flex flex-col max-h-[90vh]">
        {/* 헤더 */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${TYPE_COLORS[approval.type] || 'bg-gray-100 text-gray-600'}`}>
              {approval.type}
            </span>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${statusStyle.bg}`}>
              <statusStyle.Icon size={11} className="inline mr-1 -mt-0.5" />
              {ApprovalStatusLabel[approval.status]}
            </span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors shrink-0">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* 제목 */}
          <h2 className="text-xl font-bold text-gray-900">{approval.title}</h2>

          {/* 메타 정보 */}
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-400 mb-0.5">기안자</p>
              <p className="font-semibold text-gray-800">{approval.author_name}</p>
              <p className="text-xs text-gray-500">{approval.author_dept}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-400 mb-0.5">기안일시</p>
              <p className="font-medium text-gray-700">{formatDate(approval.created_at)}</p>
            </div>
            {(approval.amount > 0) && (
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400 mb-0.5">금액</p>
                <p className="font-semibold text-gray-800">{approval.amount.toLocaleString()}원</p>
              </div>
            )}
          </div>

          {/* 내용 */}
          <div>
            <p className="text-xs font-semibold text-gray-400 mb-2">결재 내용</p>
            <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed min-h-[80px]">
              {approval.content || '(내용 없음)'}
            </div>
          </div>

          {/* 결재선 시각화 */}
          <div>
            <p className="text-xs font-semibold text-gray-400 mb-3">결재선</p>
            <div className="flex items-center gap-1 flex-wrap">
              {/* 기안자 */}
              <div className="flex flex-col items-center gap-1">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <span className="text-sm font-bold text-blue-600">{approval.author_name.charAt(0)}</span>
                </div>
                <span className="text-[11px] text-gray-500 text-center">{approval.author_name}</span>
                <span className="text-[10px] text-blue-500 font-medium">기안자</span>
              </div>

              {approval.steps.map((step, i) => {
                const stepStyle =
                  step.status === 'approved'
                    ? 'bg-emerald-100 ring-2 ring-emerald-400'
                    : step.status === 'rejected'
                    ? 'bg-red-100 ring-2 ring-red-400'
                    : 'bg-gray-100';
                const nameColor =
                  step.status === 'approved'
                    ? 'text-emerald-700'
                    : step.status === 'rejected'
                    ? 'text-red-700'
                    : 'text-gray-500';

                return (
                  <div key={step.id} className="flex items-center gap-1">
                    <ChevronRight size={14} className="text-gray-300 mt-[-14px]" />
                    <div className="flex flex-col items-center gap-1">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${stepStyle}`}>
                        {step.status === 'approved' ? (
                          <CheckCircle2 size={18} className="text-emerald-500" />
                        ) : step.status === 'rejected' ? (
                          <XCircle size={18} className="text-red-500" />
                        ) : (
                          <span className="text-sm font-bold text-gray-400">{step.approver_name.charAt(0)}</span>
                        )}
                      </div>
                      <span className={`text-[11px] text-center font-medium ${nameColor}`}>
                        {step.approver_name}
                      </span>
                      <span className="text-[10px] text-gray-400">{step.step_order}차 결재</span>
                      {step.comment && (
                        <span className="text-[10px] text-gray-500 max-w-[80px] text-center leading-tight">
                          "{step.comment}"
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 결재 액션 UI */}
          {isMyTurn && approval.status === 'pending' && (
            <div className="border border-blue-100 bg-blue-50 rounded-xl p-4 space-y-3">
              <p className="text-sm font-semibold text-blue-700">내 결재 차례입니다</p>
              {actionMode ? (
                <>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={3}
                    placeholder={actionMode === 'approve' ? '승인 의견 (선택사항)' : '반려 사유를 입력하세요'}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none bg-white"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => setActionMode(null)}
                      className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 border border-gray-200 transition-colors"
                    >
                      취소
                    </button>
                    <button
                      onClick={() => handleAction(actionMode === 'approve' ? 'approved' : 'rejected')}
                      disabled={submitting}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors disabled:opacity-50 ${
                        actionMode === 'approve'
                          ? 'bg-emerald-500 hover:bg-emerald-600'
                          : 'bg-red-500 hover:bg-red-600'
                      }`}
                    >
                      {submitting ? '처리 중...' : actionMode === 'approve' ? '승인 확정' : '반려 확정'}
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => setActionMode('approve')}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-emerald-500 hover:bg-emerald-600 transition-colors"
                  >
                    <CheckCircle2 size={15} className="inline mr-1.5 -mt-0.5" />
                    승인
                  </button>
                  <button
                    onClick={() => setActionMode('reject')}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors"
                  >
                    <XCircle size={15} className="inline mr-1.5 -mt-0.5" />
                    반려
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="flex justify-between items-center px-6 py-4 border-t border-gray-100">
          <div>
            {isAuthor && approval.status === 'pending' && (
              <button
                onClick={handleCancel}
                className="px-4 py-2 rounded-xl text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 border border-gray-200 transition-colors"
              >
                기안 취소
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
