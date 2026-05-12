import { useState, useEffect } from 'react';
import { X, Plus, Trash2, ChevronDown } from 'lucide-react';
import { useApprovalStore } from '../../store/approvalStore';
import { useAuthStore } from '../../store/authStore';
import { APPROVAL_TYPES } from '../../types';
import type { ApprovalType } from '../../types';

interface Props {
  onClose: () => void;
}

export default function ApprovalFormModal({ onClose }: Props) {
  const { createApproval } = useApprovalStore();
  const { users, fetchUsers, currentUser } = useAuthStore();

  const [title, setTitle] = useState('');
  const [type, setType] = useState<ApprovalType>('품의서');
  const [content, setContent] = useState('');
  const [amount, setAmount] = useState('');
  const [approvers, setApprovers] = useState<{ id: string; name: string }[]>([]);
  const [approverSearch, setApproverSearch] = useState('');
  const [showUserList, setShowUserList] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const availableUsers = users.filter(
    (u) =>
      u.id !== currentUser?.id &&
      !approvers.find((a) => a.id === u.id) &&
      (approverSearch === '' ||
        u.name.includes(approverSearch) ||
        u.department.includes(approverSearch))
  );

  const addApprover = (user: { id: string; name: string; department: string; position?: string }) => {
    setApprovers((prev) => [...prev, { id: user.id, name: user.name }]);
    setApproverSearch('');
    setShowUserList(false);
  };

  const removeApprover = (id: string) => {
    setApprovers((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSubmit = async () => {
    if (!title.trim()) return setError('제목을 입력하세요.');
    if (!content.trim()) return setError('내용을 입력하세요.');
    if (approvers.length === 0) return setError('결재자를 한 명 이상 추가하세요.');
    setSubmitting(true);
    setError('');
    try {
      await createApproval({
        title: title.trim(),
        type,
        content: content.trim(),
        amount: Number(amount.replace(/,/g, '')) || 0,
        approvers,
      });
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const needsAmount = ['지출결의서', '구매요청'].includes(type);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 flex flex-col max-h-[90vh]">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-800">전자결재 기안</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* 종류 + 제목 */}
          <div className="flex gap-3">
            <div className="w-36 shrink-0">
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">문서 종류</label>
              <div className="relative">
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as ApprovalType)}
                  className="w-full appearance-none border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 pr-8"
                >
                  {APPROVAL_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-2.5 top-3 text-gray-400 pointer-events-none" />
              </div>
            </div>
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">제목</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="결재 제목을 입력하세요"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* 금액 (지출결의서, 구매요청일 때만) */}
          {needsAmount && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">금액 (원)</label>
              <input
                type="text"
                value={amount}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^0-9]/g, '');
                  setAmount(v ? Number(v).toLocaleString() : '');
                }}
                placeholder="예: 1,500,000"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {/* 내용 */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">결재 내용</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={6}
              placeholder="결재 요청 내용을 상세히 작성하세요."
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* 결재선 */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-2">결재선 설정</label>
            {/* 기안자 */}
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-blue-600">기</span>
              </div>
              <div className="flex-1 bg-gray-50 rounded-xl px-3 py-2 text-sm text-gray-600">
                {currentUser?.name} <span className="text-gray-400 text-xs ml-1">(기안자)</span>
              </div>
            </div>
            {/* 결재자 목록 */}
            {approvers.map((a, i) => (
              <div key={a.id} className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-indigo-600">{i + 1}</span>
                </div>
                <div className="flex-1 bg-indigo-50 rounded-xl px-3 py-2 text-sm text-gray-700">
                  {a.name}
                </div>
                <button
                  onClick={() => removeApprover(a.id)}
                  className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {/* 결재자 추가 */}
            <div className="relative mt-1">
              <div className="flex items-center gap-2 border border-dashed border-gray-300 rounded-xl px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors">
                <Plus size={14} className="text-gray-400 shrink-0" />
                <input
                  type="text"
                  value={approverSearch}
                  onChange={(e) => { setApproverSearch(e.target.value); setShowUserList(true); }}
                  onFocus={() => setShowUserList(true)}
                  placeholder="결재자 추가 (이름·부서 검색)"
                  className="flex-1 text-sm bg-transparent focus:outline-none text-gray-600 placeholder-gray-400"
                />
              </div>
              {showUserList && availableUsers.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                  {availableUsers.slice(0, 8).map((u) => (
                    <button
                      key={u.id}
                      onMouseDown={() => addApprover(u)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-blue-50 transition-colors"
                    >
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                        {u.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-800">{u.name}</p>
                        <p className="text-xs text-gray-400">{u.department} · {u.position || ''}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 에러 */}
        {error && (
          <p className="mx-6 mb-2 text-sm text-red-500 bg-red-50 rounded-xl px-3 py-2">{error}</p>
        )}

        {/* 푸터 */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-5 py-2 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {submitting ? '기안 중...' : '기안 상신'}
          </button>
        </div>
      </div>
    </div>
  );
}
