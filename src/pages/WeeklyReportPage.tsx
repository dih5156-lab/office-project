import { useState, useEffect } from 'react';
import { useReportStore } from '../store/reportStore';
import { exportReportToExcel } from '../utils/exportExcel';
import { exportReportToPDF } from '../utils/exportPDF';
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  FileText,
  Check,
  X,
  Download,
  Sheet,
  FileDown,
  Sparkles,
  Loader2,
  CheckCircle2,
  XCircle,
  MessageSquare,
} from 'lucide-react';
import clsx from 'clsx';
import { TaskItem, WeeklyReport, ReportStatus, DEPARTMENTS } from '../types';
import { useAuthStore } from '../store/authStore';

function generateTaskId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function weekLabel(weekStartStr: string): string {
  const d = new Date(weekStartStr);
  const month = d.getMonth() + 1;
  const weekNum = Math.ceil(d.getDate() / 7);
  return `${month}월 ${weekNum}주차`;
}

const statusColors: Record<ReportStatus, string> = {
  작성중: 'bg-yellow-100 text-yellow-700',
  완료: 'bg-green-100 text-green-700',
  제출됨: 'bg-blue-100 text-blue-700',
};

export default function WeeklyReportPage() {
  const { reports, updateReport, deleteReport, createNewReport, fetchReports, approveReport } = useReportStore();
  const { currentUser } = useAuthStore();

  // 현재 선택된 부서 탭 (기본: 로그인 사용자 부서 or 첫 번째)
  const defaultDept = (DEPARTMENTS as readonly string[]).includes(currentUser?.department ?? '')
    ? (currentUser!.department as typeof DEPARTMENTS[number])
    : DEPARTMENTS[0];

  const [activeDept, setActiveDept] = useState<typeof DEPARTMENTS[number]>(defaultDept);
  const [openId, setOpenId] = useState<string | null>(null);
  const [authorInput, setAuthorInput] = useState(currentUser?.name ?? '');
  const [showCreateForm, setShowCreateForm] = useState(false);

  useEffect(() => { fetchReports(); }, []);

  // 현재 선택된 부서의 보고서만 필터링
  const filteredReports = reports.filter((r) => r.department === activeDept);

  async function handleCreateReport() {
    const report = await createNewReport(authorInput, activeDept);
    setOpenId(report.id);
    setShowCreateForm(false);
  }

  function addTask(
    report: WeeklyReport,
    field: 'completedTasks' | 'inProgressTasks' | 'nextWeekTasks'
  ) {
    const newTask: TaskItem = {
      id: generateTaskId(),
      content: '',
      progress: field === 'completedTasks' ? 100 : field === 'inProgressTasks' ? 50 : 0,
      category: '',
    };
    updateReport(report.id, { [field]: [...report[field], newTask] });
  }

  function updateTask(
    report: WeeklyReport,
    field: 'completedTasks' | 'inProgressTasks' | 'nextWeekTasks',
    taskId: string,
    data: Partial<TaskItem>
  ) {
    updateReport(report.id, {
      [field]: report[field].map((t) => (t.id === taskId ? { ...t, ...data } : t)),
    });
  }

  function removeTask(
    report: WeeklyReport,
    field: 'completedTasks' | 'inProgressTasks' | 'nextWeekTasks',
    taskId: string
  ) {
    updateReport(report.id, { [field]: report[field].filter((t) => t.id !== taskId) });
  }

  function exportReport(report: WeeklyReport) {
    const lines = [
      `■ 주간 업무 보고서`,
      `기간: ${report.weekStart} ~ ${report.weekEnd}`,
      `작성자: ${report.author} (${report.department})`,
      ``,
      `▶ 완료 업무`,
      ...report.completedTasks.map((t) => `  - ${t.content} [${t.category}] (${t.progress}%)`),
      ``,
      `▶ 진행 중 업무`,
      ...report.inProgressTasks.map((t) => `  - ${t.content} [${t.category}] (${t.progress}%)`),
      ``,
      `▶ 다음 주 계획`,
      ...report.nextWeekTasks.map((t) => `  - ${t.content}`),
      ``,
      `▶ 이슈 / 특이사항`,
      report.issues || '없음',
      ``,
      `▶ 기타 메모`,
      report.notes || '없음',
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `주간보고_${report.weekStart}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">주간 업무 보고</h2>
        <button
          onClick={() => setShowCreateForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
        >
          <Plus size={16} />
          새 보고서 작성
        </button>
      </div>

      {/* 부서 탭 */}
      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        {DEPARTMENTS.map((dept) => {
          const count = reports.filter((r) => r.department === dept).length;
          return (
            <button
              key={dept}
              onClick={() => { setActiveDept(dept); setOpenId(null); setShowCreateForm(false); }}
              className={clsx(
                'px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors',
                activeDept === dept
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              )}
            >
              {dept}
              {count > 0 && (
                <span className={clsx('ml-1.5 text-xs px-1.5 py-0.5 rounded-full font-normal', activeDept === dept ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500')}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 새 보고서 생성 폼 */}
      {showCreateForm && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h3 className="font-semibold text-gray-800 mb-1">이번 주 보고서 생성</h3>
          <p className="text-sm text-gray-500 mb-4">부서: <span className="font-medium text-blue-600">{activeDept}</span></p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">작성자</label>
            <input
              type="text"
              value={authorInput}
              onChange={(e) => setAuthorInput(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="이름을 입력하세요"
            />
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleCreateReport}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
            >
              생성
            </button>
            <button
              onClick={() => setShowCreateForm(false)}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {filteredReports.length === 0 ? (
        <div className="text-center py-16 text-gray-400 bg-white rounded-xl border border-gray-100">
          <FileText size={48} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">{activeDept} 부서의 보고서가 없습니다</p>
          <button
            onClick={() => setShowCreateForm(true)}
            className="mt-2 text-sm text-blue-500 hover:underline"
          >
            첫 번째 보고서 작성하기
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {[...filteredReports].reverse().map((report) => (
            <ReportCard
              key={report.id}
              report={report}
              isOpen={openId === report.id}
              onToggle={() => setOpenId(openId === report.id ? null : report.id)}
              onUpdate={(data) => updateReport(report.id, data)}
              onDelete={() => deleteReport(report.id)}
              onAddTask={(field) => addTask(report, field)}
              onUpdateTask={(field, taskId, data) => updateTask(report, field, taskId, data)}
              onRemoveTask={(field, taskId) => removeTask(report, field, taskId)}
              onExport={() => exportReport(report)}
              onApprove={(action, comment) => approveReport(report.id, action, comment)}
              canApprove={currentUser?.role === 'admin' || currentUser?.role === 'manager'}
              statusColors={statusColors}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface ReportCardProps {
  report: WeeklyReport;
  isOpen: boolean;
  onToggle: () => void;
  onUpdate: (data: Partial<WeeklyReport>) => void;
  onDelete: () => void;
  onAddTask: (field: 'completedTasks' | 'inProgressTasks' | 'nextWeekTasks') => void;
  onUpdateTask: (field: 'completedTasks' | 'inProgressTasks' | 'nextWeekTasks', taskId: string, data: Partial<TaskItem>) => void;
  onRemoveTask: (field: 'completedTasks' | 'inProgressTasks' | 'nextWeekTasks', taskId: string) => void;
  onExport: () => void;
  onApprove: (action: 'approve' | 'reject', comment?: string) => Promise<void>;
  canApprove: boolean;
  statusColors: Record<ReportStatus, string>;
}

function ReportCard({ report, isOpen, onToggle, onUpdate, onDelete, onAddTask, onUpdateTask, onRemoveTask, onExport, onApprove, canApprove, statusColors }: ReportCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(report.aiSummary ?? null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [approvalComment, setApprovalComment] = useState('');
  const [showApprovalForm, setShowApprovalForm] = useState(false);
  const [approving, setApproving] = useState(false);

  async function handleAISummary() {
    setAiLoading(true);
    setAiError(null);
    setAiSummary(null);
    try {
      const res = await fetch('/api/ai/report-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.guide || data.error || 'AI 요약 실패');
      setAiSummary(data.summary);
      // 보고서에 AI 요약 저장 (Excel/PDF 내보내기 시 포함됨)
      onUpdate({ aiSummary: data.summary });
    } catch (e) {
      setAiError((e as Error).message);
    } finally {
      setAiLoading(false);
    }
  }

  async function handleApprove(action: 'approve' | 'reject') {
    setApproving(true);
    try {
      await onApprove(action, approvalComment || undefined);
      setShowApprovalForm(false);
      setApprovalComment('');
    } finally {
      setApproving(false);
    }
  }

  const approvalBadge = report.approvalStatus === '승인'
    ? 'bg-green-100 text-green-700'
    : report.approvalStatus === '반려'
    ? 'bg-red-100 text-red-700'
    : null;

  const taskFields: { field: 'completedTasks' | 'inProgressTasks' | 'nextWeekTasks'; label: string; color: string }[] = [
    { field: 'completedTasks', label: '완료 업무', color: 'text-green-700 bg-green-50' },
    { field: 'inProgressTasks', label: '진행 중 업무', color: 'text-yellow-700 bg-yellow-50' },
    { field: 'nextWeekTasks', label: '다음 주 계획', color: 'text-blue-700 bg-blue-50' },
  ];

  return (
    <div className={clsx('bg-white rounded-xl border shadow-sm', report.approvalStatus === '반려' ? 'border-red-200' : report.approvalStatus === '승인' ? 'border-green-200' : 'border-gray-100')}>
      {/* 헤더 */}
      <div className="flex items-center justify-between px-5 py-4">
        <button onClick={onToggle} className="flex items-center gap-3 flex-1 text-left">
          <div>
            <p className="font-semibold text-gray-800">
              {report.department} {weekLabel(report.weekStart)} 주간 업무 보고
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              {report.author} · {report.department}
            </p>
          </div>
          <div className="flex items-center gap-1.5 ml-auto mr-4">
            <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', statusColors[report.status])}>
              {report.status}
            </span>
            {approvalBadge && (
              <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', approvalBadge)}>
                {report.approvalStatus}
              </span>
            )}
          </div>
          {isOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </button>
        <div className="flex items-center gap-1 ml-2">
          {/* 승인/반려 버튼 (관리자·팀장, 제출됨 상태) */}
          {canApprove && report.status === '제출됨' && (
            <button
              onClick={() => setShowApprovalForm((v) => !v)}
              className={clsx('p-1.5 rounded-lg text-gray-400', showApprovalForm ? 'bg-blue-50 text-blue-500' : 'hover:bg-gray-100')}
              title="승인/반려"
            >
              <MessageSquare size={15} />
            </button>
          )}
          <button
            onClick={handleAISummary}
            disabled={aiLoading}
            className="p-1.5 hover:bg-orange-50 rounded-lg text-gray-400 hover:text-orange-500 disabled:opacity-50"
            title="AI 요약 생성"
          >
            {aiLoading ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
          </button>
          <button onClick={onExport} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400" title="TXT 내보내기">
            <Download size={15} />
          </button>
          <button
            onClick={() => exportReportToExcel(report)}
            className="p-1.5 hover:bg-green-50 rounded-lg text-gray-400 hover:text-green-600"
            title="엑셀 내보내기"
          >
            <Sheet size={15} />
          </button>
          <button
            onClick={() => exportReportToPDF(report)}
            className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-500"
            title="PDF 내보내기"
          >
            <FileDown size={15} />
          </button>
          {confirmDelete ? (
            <>
              <button onClick={onDelete} className="p-1.5 bg-red-100 rounded-lg text-red-500">
                <Check size={15} />
              </button>
              <button onClick={() => setConfirmDelete(false)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400">
                <X size={15} />
              </button>
            </>
          ) : (
            <button onClick={() => setConfirmDelete(true)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400">
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </div>

      {/* 상세 내용 */}
      {isOpen && (
        <div className="border-t border-gray-100 px-5 py-5 space-y-5">

          {/* 승인 패널 (관리자·팀장 전용) */}
          {canApprove && report.status === '제출됨' && showApprovalForm && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
              <h4 className="text-sm font-semibold text-blue-700 flex items-center gap-1.5">
                <MessageSquare size={14} />
                승인 / 반려 처리
              </h4>
              <textarea
                value={approvalComment}
                onChange={(e) => setApprovalComment(e.target.value)}
                rows={2}
                className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none bg-white"
                placeholder="코멘트 (선택 사항)"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => handleApprove('approve')}
                  disabled={approving}
                  className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  <CheckCircle2 size={14} /> 승인
                </button>
                <button
                  onClick={() => handleApprove('reject')}
                  disabled={approving}
                  className="flex items-center gap-1.5 px-4 py-2 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600 disabled:opacity-50"
                >
                  <XCircle size={14} /> 반려
                </button>
                <button onClick={() => setShowApprovalForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-white rounded-lg">
                  취소
                </button>
              </div>
            </div>
          )}

          {/* 승인 결과 표시 */}
          {report.approvalStatus && (
            <div className={clsx('rounded-xl p-4', report.approvalStatus === '승인' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200')}>
              <div className="flex items-center gap-2 mb-1">
                {report.approvalStatus === '승인'
                  ? <CheckCircle2 size={15} className="text-green-600" />
                  : <XCircle size={15} className="text-red-500" />}
                <span className={clsx('text-sm font-semibold', report.approvalStatus === '승인' ? 'text-green-700' : 'text-red-600')}>
                  {report.approvalStatus} — {report.approvedBy}
                </span>
              </div>
              {report.approvalComment && (
                <p className="text-sm text-gray-600 ml-5 whitespace-pre-wrap">{report.approvalComment}</p>
              )}
            </div>
          )}

          {/* 상태 변경 */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700">보고서 상태:</span>
            <select
              value={report.status}
              onChange={(e) => onUpdate({ status: e.target.value as ReportStatus })}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {(['작성중', '완료', '제출됨'] as ReportStatus[]).map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* 업무 섹션들 */}
          {taskFields.map(({ field, label, color }) => (
            <div key={field}>
              <div className="flex items-center justify-between mb-2">
                <h4 className={clsx('text-sm font-semibold px-2 py-0.5 rounded', color)}>{label}</h4>
                <button
                  onClick={() => onAddTask(field)}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600"
                >
                  <Plus size={13} /> 항목 추가
                </button>
              </div>
              {report[field].length === 0 ? (
                <p className="text-xs text-gray-400 py-2 text-center">항목이 없습니다</p>
              ) : (
                <div className="space-y-3">
                  {report[field].map((task, idx) => (
                    <div key={task.id} className="bg-gray-50 rounded-lg p-3 space-y-2">
                      {/* 첫 줄: 번호 + 분류 + 삭제 */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 font-medium w-4 shrink-0">{idx + 1}.</span>
                        <input
                          type="text"
                          value={task.category}
                          onChange={(e) => onUpdateTask(field, task.id, { category: e.target.value })}
                          placeholder="분류 (예: 개발, 기획)"
                          className="flex-1 bg-white border border-gray-200 rounded px-2 py-1 text-xs text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        {field !== 'nextWeekTasks' && (
                          <div className="flex items-center gap-1 shrink-0">
                            <input
                              type="range"
                              min={0}
                              max={100}
                              step={10}
                              value={task.progress}
                              onChange={(e) => onUpdateTask(field, task.id, { progress: Number(e.target.value) })}
                              className="w-20"
                            />
                            <span className="text-xs text-gray-500 w-8 text-right">{task.progress}%</span>
                          </div>
                        )}
                        <button
                          onClick={() => onRemoveTask(field, task.id)}
                          className="text-gray-300 hover:text-red-400 shrink-0"
                        >
                          <X size={14} />
                        </button>
                      </div>
                      {/* 두 번째 줄: 상세 내용 textarea */}
                      <textarea
                        value={task.content}
                        onChange={(e) => onUpdateTask(field, task.id, { content: e.target.value })}
                        placeholder="업무 내용을 자세히 작성하세요 (줄바꿈 가능)"
                        rows={3}
                        className="w-full bg-white border border-gray-200 rounded px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* AI 요약 결과 */}
          {(aiSummary || aiError) && (
            <div className={clsx('rounded-lg p-4', aiError ? 'bg-red-50 border border-red-200' : 'bg-orange-50 border border-orange-200')}>
              <h4 className={clsx('text-sm font-semibold flex items-center gap-1.5 mb-2', aiError ? 'text-red-600' : 'text-orange-700')}>
                <Sparkles size={14} />
                {aiError ? 'AI 요약 오류' : 'AI 요약 결과'}
              </h4>
              {aiError ? (
                <div className="space-y-1">
                  <p className="text-xs text-red-500">{aiError}</p>
                  <ol className="pl-4 text-xs text-red-400 list-decimal space-y-0.5">
                    <li>ollama.com에서 Ollama 설치</li>
                    <li>터미널: <code className="bg-red-100 px-1 rounded">ollama pull qwen2.5:7b</code></li>
                    <li>터미널: <code className="bg-red-100 px-1 rounded">ollama serve</code></li>
                  </ol>
                </div>
              ) : (
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{aiSummary}</p>
              )}
            </div>
          )}

          {/* 이슈 */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">이슈 / 특이사항</label>
            <textarea
              value={report.issues}
              onChange={(e) => onUpdate({ issues: e.target.value })}
              rows={4}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
              placeholder="이번 주 이슈나 특이사항을 작성하세요"
            />
          </div>

          {/* 메모 */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">기타 메모</label>
            <textarea
              value={report.notes}
              onChange={(e) => onUpdate({ notes: e.target.value })}
              rows={4}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
              placeholder="기타 공유 사항이나 메모를 작성하세요"
            />
          </div>
        </div>
      )}
    </div>
  );
}
