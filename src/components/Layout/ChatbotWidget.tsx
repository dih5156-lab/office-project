import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Sparkles, Send, Loader2, CalendarDays, FileText,
  Check, ChevronDown, Calendar,
  AlertCircle, Copy, CheckCheck, Minimize2,
  ClipboardList, Bell, RefreshCw,
} from 'lucide-react';
import { format } from 'date-fns';
import clsx from 'clsx';
import { useScheduleStore } from '../../store/scheduleStore';
import { useDocumentStore } from '../../store/documentStore';
import { useAuthStore } from '../../store/authStore';
import { useApprovalStore } from '../../store/approvalStore';
import { useNoticeStore } from '../../store/noticeStore';
import { api } from '../../lib/api';
import type { Schedule, ScheduleCategory, Priority, DocumentCategory } from '../../types';

/* ════════════════════════════════════════════
   Types
════════════════════════════════════════════ */
interface ChatAction {
  type: 'create_schedule' | 'create_document' | 'show_schedules' | 'show_approvals' | 'show_notices';
  data: Record<string, unknown>;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  action?: ChatAction | null;
  actionDone?: boolean;
  timestamp: Date;
}

/* ════════════════════════════════════════════
   Helpers
════════════════════════════════════════════ */
function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function todayStr() {
  return format(new Date(), 'yyyy-MM-dd');
}

const QUICK_SCHEDULE: { label: string; prompt?: string; formData?: Record<string, unknown> }[] = [
  { label: '📅 오늘 일정', prompt: '오늘 일정 알려줘' },
  { label: '📅 이번 주', prompt: '이번 주 일정 알려줘' },
  {
    label: '➕ 회의 추가',
    formData: { title: '팀 회의', category: '회의', location: '', description: '' },
  },
  {
    label: '➕ 미팅 추가',
    formData: { title: '고객 미팅', category: '회의', location: '', description: '' },
  },
  {
    label: '➕ 외근 추가',
    formData: { title: '외근', category: '출장', location: '', description: '' },
  },
];

const QUICK_DOCS: { label: string; template: string }[] = [
  {
    label: '📝 회의록',
    template:
      '회의록 작성해줘\n제목: \n일시: \n참석자: \n안건: \n주요 내용: \n결정 사항: \n비고: ',
  },
  {
    label: '📊 보고서',
    template:
      '업무 보고서 작성해줘\n제목: \n보고 기간: \n담당자: \n주요 업무 내용: \n성과: \n문제점 및 개선 사항: ',
  },
  {
    label: '📋 계획서',
    template:
      '프로젝트 계획서 작성해줘\n프로젝트명: \n목적: \n기간: \n담당자: \n주요 일정: \n예산: \n기대 효과: ',
  },
  {
    label: '💡 제안서',
    template:
      '제안서 작성해줘\n제목: \n제안 배경: \n제안 내용: \n기대 효과: \n소요 예산: \n추진 일정: ',
  },
  {
    label: '📖 매뉴얼',
    template:
      '업무 매뉴얼 작성해줘\n제목: \n대상: \n목적: \n주요 절차: \n주의 사항: ',
  },
  {
    label: '📧 이메일',
    template:
      '이메일 작성해줘\n수신: \n제목: \n인사말: \n본문 내용: \n마무리: ',
  },
];

const QUICK_WORK = [
  { label: '📨 결재 대기', prompt: '결재 대기 목록 알려줘' },
  { label: '📢 공지사항', prompt: '최근 공지사항 알려줘' },
  { label: '📅 오늘 일정', prompt: '오늘 일정 알려줘' },
  { label: '📅 이번 주', prompt: '이번 주 일정 알려줘' },
];

// period → 날짜 문자열(yyyy-MM-dd) 변환
function resolvePeriodDate(period: string): string | null {
  const now = new Date();
  const dow = now.getDay(); // 0=일,1=월,...,6=토
  const dayMap: Record<string, number> = {
    sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
    thursday: 4, friday: 5, saturday: 6,
  };
  if (dayMap[period] !== undefined) {
    const target = dayMap[period];
    const diff = target - dow;
    const d = new Date(now);
    d.setDate(now.getDate() + diff);
    return format(d, 'yyyy-MM-dd');
  }
  return null;
}

/* ════════════════════════════════════════════
   Custom DateTime Picker
════════════════════════════════════════════ */
function DateTimePicker({
  label, value, onChange,
}: {
  label: string;
  value: string; // "yyyy-MM-dd HH:mm"
  onChange: (v: string) => void;
}) {
  const parts = value.split(' ');
  const datePart = parts[0] || todayStr();
  const [hStr, mStr] = (parts[1] || '09:00').split(':');
  const h24 = parseInt(hStr || '9', 10);
  const rawMin = parseInt(mStr || '0', 10);
  const m = Math.round(rawMin / 10) * 10 % 60;
  const isPM = h24 >= 12;
  const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;

  const emit = (d: string, hour12: number, min: number, pm: boolean) => {
    const h = pm ? (hour12 === 12 ? 12 : hour12 + 12) : (hour12 === 12 ? 0 : hour12);
    onChange(`${d} ${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`);
  };

  const displayTime = `${isPM ? '오후' : '오전'} ${h12}:${String(m).padStart(2, '0')}`;

  return (
    <div>
      <label className="block text-xs font-semibold text-gray-400 mb-1.5">{label}</label>
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: 'rgba(255,255,255,0.95)',
          border: '1px solid rgba(99,102,241,0.15)',
          boxShadow: '0 2px 12px rgba(99,102,241,0.08)',
        }}
      >
        {/* 헤더: 날짜 + 시간 뱃지 */}
        <div
          className="flex items-center justify-between px-3 py-2"
          style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(59,130,246,0.06))' }}
        >
          <input
            type="date"
            value={datePart}
            onChange={e => emit(e.target.value, h12, m, isPM)}
            className="text-xs font-semibold text-gray-700 outline-none bg-transparent cursor-pointer"
          />
          <span
            className="text-xs font-bold px-2.5 py-1 rounded-full"
            style={{ background: 'linear-gradient(135deg,#6366f1,#3b82f6)', color: '#fff' }}
          >
            {displayTime}
          </span>
        </div>

        <div className="px-3 pt-2.5 pb-3 space-y-2.5">
          {/* 오전 / 오후 */}
          <div className="flex gap-2">
            {(['오전', '오후'] as const).map(lbl => {
              const active = lbl === '오전' ? !isPM : isPM;
              return (
                <button
                  key={lbl}
                  type="button"
                  onClick={() => emit(datePart, h12, m, lbl === '오후')}
                  className="flex-1 py-1.5 rounded-xl text-xs font-bold transition-all duration-150"
                  style={active ? {
                    background: 'linear-gradient(135deg,#6366f1,#3b82f6)',
                    color: '#fff',
                    boxShadow: '0 2px 8px rgba(99,102,241,0.35)',
                  } : {
                    background: 'rgba(243,244,246,0.8)',
                    color: '#9ca3af',
                    border: '1px solid rgba(229,231,235,0.8)',
                  }}
                >
                  {lbl}
                </button>
              );
            })}
          </div>

          {/* 시 (1 ~ 12) */}
          <div>
            <p className="text-[10px] font-semibold text-gray-300 uppercase tracking-wide mb-1.5">시</p>
            <div className="grid grid-cols-6 gap-1">
              {([1,2,3,4,5,6,7,8,9,10,11,12] as number[]).map(h => {
                const active = h12 === h;
                return (
                  <button
                    key={h}
                    type="button"
                    onClick={() => emit(datePart, h, m, isPM)}
                    className="py-1.5 rounded-xl text-xs font-bold transition-all duration-150"
                    style={active ? {
                      background: 'linear-gradient(135deg,#6366f1,#3b82f6)',
                      color: '#fff',
                      boxShadow: '0 2px 6px rgba(99,102,241,0.4)',
                    } : {
                      background: 'rgba(243,244,246,0.7)',
                      color: '#6b7280',
                    }}
                  >
                    {h}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 분 (10분 단위) */}
          <div>
            <p className="text-[10px] font-semibold text-gray-300 uppercase tracking-wide mb-1.5">분</p>
            <div className="grid grid-cols-6 gap-1">
              {([0,10,20,30,40,50] as number[]).map(min => {
                const active = m === min;
                return (
                  <button
                    key={min}
                    type="button"
                    onClick={() => emit(datePart, h12, min, isPM)}
                    className="py-1.5 rounded-xl text-xs font-bold transition-all duration-150"
                    style={active ? {
                      background: 'linear-gradient(135deg,#6366f1,#3b82f6)',
                      color: '#fff',
                      boxShadow: '0 2px 6px rgba(99,102,241,0.4)',
                    } : {
                      background: 'rgba(243,244,246,0.7)',
                      color: '#6b7280',
                    }}
                  >
                    {String(min).padStart(2,'0')}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════
   Schedule Action Card
════════════════════════════════════════════ */
function ScheduleActionCard({
  data,
  onConfirm,
  onCancel,
}: {
  data: Record<string, unknown>;
  onConfirm: (edited: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(String(data.title ?? ''));
  const [allDay, setAllDay] = useState(Boolean(data.allDay ?? false));
  const [startDate, setStartDate] = useState(String(data.startDate ?? todayStr() + ' 09:00'));
  const [endDate, setEndDate] = useState(String(data.endDate ?? todayStr() + ' 10:00'));
  const [startDateOnly, setStartDateOnly] = useState(String(data.startDate ?? todayStr()).slice(0, 10));
  const [endDateOnly, setEndDateOnly] = useState(String(data.endDate ?? todayStr()).slice(0, 10));
  const [category, setCategory] = useState(String(data.category ?? '회의') as ScheduleCategory);
  const [location, setLocation] = useState(String(data.location ?? ''));
  const [description, setDescription] = useState(String(data.description ?? ''));
  const [loading, setLoading] = useState(false);

  const inputCls = 'w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white';
  const categories: ScheduleCategory[] = ['회의', '업무', '교육', '출장', '개인', '기타'];

  const toggleAllDay = (v: boolean) => {
    setAllDay(v);
    if (v) {
      // 종일로 전환 시 날짜 부분만 추출
      setStartDateOnly(startDate.slice(0, 10));
      setEndDateOnly(endDate.slice(0, 10));
    }
  };

  return (
    <div className="rounded-xl border overflow-hidden text-sm" style={{ borderColor: 'rgba(99,102,241,0.25)', background: 'rgba(238,242,255,0.6)' }}>
      <div className="flex items-center justify-between px-3 py-2 border-b border-indigo-100/60" style={{ background: 'rgba(99,102,241,0.08)' }}>
        <div className="flex items-center gap-2">
          <CalendarDays size={14} className="text-indigo-500 shrink-0" />
          <span className="font-bold text-indigo-700 text-sm">일정 추가 미리보기</span>
        </div>
        {/* 종일 토글 */}
        <button
          type="button"
          onClick={() => toggleAllDay(!allDay)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition-all duration-150"
          style={allDay ? {
            background: 'linear-gradient(135deg,#6366f1,#3b82f6)',
            color: '#fff',
            boxShadow: '0 2px 8px rgba(99,102,241,0.35)',
          } : {
            background: 'rgba(243,244,246,0.9)',
            color: '#9ca3af',
            border: '1px solid rgba(229,231,235,0.8)',
          }}
        >
          <span>{allDay ? '☀️' : '🕐'}</span>
          종일
        </button>
      </div>
      <div className="p-3 space-y-3">
        <div>
          <label className="block text-xs font-semibold text-gray-400 mb-1">제목</label>
          <input className={inputCls} value={title} onChange={e => setTitle(e.target.value)} />
        </div>

        {allDay ? (
          /* 종일 모드: 날짜 input만 */
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5">시작 날짜</label>
              <input
                type="date"
                value={startDateOnly}
                onChange={e => {
                  const ns = e.target.value;
                  setStartDateOnly(ns);
                  if (endDateOnly < ns) setEndDateOnly(ns);
                }}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5">종료 날짜</label>
              <input
                type="date"
                value={endDateOnly}
                min={startDateOnly}
                onChange={e => setEndDateOnly(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>
        ) : (
          /* 일반 모드: DateTimePicker */
          <>
            <DateTimePicker
              label="시작"
              value={startDate}
              onChange={ns => {
                setStartDate(ns);
                if (endDate <= ns) {
                  // 시작보다 1시간 뒤로 종료 자동 이동
                  const [d, t] = ns.split(' ');
                  const [hh, mm] = t.split(':').map(Number);
                  const total = hh * 60 + mm + 60;
                  const nh = Math.floor(total / 60) % 24;
                  const nm = total % 60;
                  setEndDate(`${d} ${String(nh).padStart(2,'0')}:${String(nm).padStart(2,'0')}`);
                }
              }}
            />
            <DateTimePicker label="종료" value={endDate} onChange={setEndDate} />
          </>
        )}

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1">카테고리</label>
            <select className={inputCls} value={category} onChange={e => setCategory(e.target.value as ScheduleCategory)}>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1">장소</label>
            <input className={inputCls} value={location} onChange={e => setLocation(e.target.value)} placeholder="선택" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-400 mb-1">설명</label>
          <textarea
            className={inputCls + ' resize-none'}
            rows={2}
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="선택"
          />
        </div>
      </div>
      <div className="flex gap-2 px-3 pb-3">
        <button
          onClick={async () => {
            setLoading(true);
            const finalStart = allDay ? `${startDateOnly} 00:00` : startDate;
            const finalEnd   = allDay ? `${endDateOnly} 23:59`   : endDate;
            await onConfirm({ title, startDate: finalStart, endDate: finalEnd, allDay, category, location, description });
            setLoading(false);
          }}
          disabled={!title || loading}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-bold text-white rounded-lg disabled:opacity-50 transition-all"
          style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          일정 추가
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          취소
        </button>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════
   Document Action Card
════════════════════════════════════════════ */
function DocumentActionCard({
  data,
  onConfirm,
  onCancel,
}: {
  data: Record<string, unknown>;
  onConfirm: (edited: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(String(data.title ?? ''));
  const [content, setContent] = useState(String(data.content ?? ''));
  const [category, setCategory] = useState(String(data.category ?? '회의록'));
  const [tags, setTags] = useState((data.tags as string[] ?? []).join(', '));
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const inputCls = 'w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-400 bg-white';
  const categories = ['회의록', '보고서', '계획서', '제안서', '매뉴얼', '기타'];

  return (
    <div className="rounded-xl border overflow-hidden text-sm" style={{ borderColor: 'rgba(16,185,129,0.25)', background: 'rgba(236,253,245,0.7)' }}>
      <div className="flex items-center justify-between px-3 py-2 border-b border-emerald-100/60" style={{ background: 'rgba(16,185,129,0.08)' }}>
        <div className="flex items-center gap-2">
          <FileText size={14} className="text-emerald-600 shrink-0" />
          <span className="font-bold text-emerald-700 text-sm">문서 작성 미리보기</span>
        </div>
        <button onClick={() => setExpanded(v => !v)} className="text-emerald-500 hover:text-emerald-700">
          <ChevronDown size={13} className={clsx('transition-transform', expanded && 'rotate-180')} />
        </button>
      </div>
      <div className="p-3 space-y-2">
        <div>
          <label className="block text-xs font-semibold text-gray-400 mb-1">제목</label>
          <input className={inputCls} value={title} onChange={e => setTitle(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1">카테고리</label>
            <select className={inputCls} value={category} onChange={e => setCategory(e.target.value)}>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1">태그 (쉼표 구분)</label>
            <input className={inputCls} value={tags} onChange={e => setTags(e.target.value)} placeholder="태그1, 태그2" />
          </div>
        </div>
        {expanded && (
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1">내용 미리보기</label>
            <textarea
              className={inputCls + ' resize-none font-mono leading-relaxed'}
              rows={8}
              value={content}
              onChange={e => setContent(e.target.value)}
            />
          </div>
        )}
        {!expanded && (
          <button onClick={() => setExpanded(true)} className="w-full text-left text-xs text-gray-400 hover:text-gray-600 px-1">
            📄 내용 보기/편집...
          </button>
        )}
      </div>
      <div className="flex gap-2 px-3 pb-3">
        <button
          onClick={async () => {
            setLoading(true);
            await onConfirm({ title, content, category, tags: tags.split(',').map(t => t.trim()).filter(Boolean) });
            setLoading(false);
          }}
          disabled={!title || loading}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-bold text-white rounded-lg disabled:opacity-50 transition-all"
          style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          문서 저장
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          취소
        </button>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════
   Schedule List Card
════════════════════════════════════════════ */
function ScheduleListCard({ schedules }: { schedules: Array<Record<string, unknown>> }) {
  const [copied, setCopied] = useState(false);

  const fmtCardDate = (dateStr: string) => {
    if (!dateStr) return '';
    const datePart = dateStr.split('T')[0];
    const [, mo, dy] = datePart.split('-').map(Number);
    const DAYS = ['일','월','화','수','목','금','토'];
    const dow = DAYS[new Date(datePart + 'T00:00').getDay()];
    return `${mo}/${dy}(${dow})`;
  };

  const text = schedules.map(s =>
    `• ${s.title} — ${fmtCardDate(String(s.startDate ?? ''))}`
  ).join('\n');

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (schedules.length === 0) {
    return (
      <div className="rounded-xl border border-gray-100 p-3 text-sm text-gray-400 bg-white/60">
        해당 기간 일정이 없습니다.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-blue-100 overflow-hidden text-sm bg-blue-50/40">
      <div className="flex items-center justify-between px-3 py-2 border-b border-blue-100">
        <div className="flex items-center gap-1.5">
          <Calendar size={14} className="text-blue-500" />
          <span className="font-bold text-blue-700">일정 목록 ({schedules.length}건)</span>
        </div>
        <button onClick={handleCopy} className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-600">
          {copied ? <CheckCheck size={13} /> : <Copy size={13} />}
          {copied ? '복사됨' : '복사'}
        </button>
      </div>
      <div className="divide-y divide-blue-50">
        {schedules.slice(0, 8).map((s, i) => (
          <div key={i} className="flex items-center gap-2 px-3 py-2">
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ background: (s.color as string) ?? '#3b82f6' }}
            />
            <span className="flex-1 text-gray-700 truncate">{String(s.title)}</span>
            <span className="text-xs text-gray-400 shrink-0">
              {fmtCardDate(String(s.startDate ?? ''))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════
   Approval List Card
════════════════════════════════════════════ */
function ApprovalListCard({ approvals }: { approvals: Array<Record<string, unknown>> }) {
  const statusLabel: Record<string, string> = {
    pending: '대기', approved: '승인', rejected: '반려', cancelled: '취소',
  };
  const typeLabel: Record<string, string> = {
    '기안서': '기안서', '지출결의서': '지출결의서', '구매요청서': '구매요청서',
    '휴가신청서': '휴가신청서', '출장신청서': '출장신청서', '기타': '기타',
  };

  if (approvals.length === 0) {
    return (
      <div className="rounded-xl border border-gray-100 p-3 text-sm text-gray-400 bg-white/60">
        결재 대기 중인 문서가 없습니다.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-yellow-200 overflow-hidden text-sm bg-yellow-50/40">
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-yellow-100">
        <ClipboardList size={14} className="text-yellow-600" />
        <span className="font-bold text-yellow-700">결재 대기 ({approvals.length}건)</span>
      </div>
      <div className="divide-y divide-yellow-50">
        {approvals.slice(0, 6).map((a, i) => (
          <div key={i} className="flex items-center gap-2 px-3 py-2">
            <span className="flex-1 text-gray-700 truncate font-medium">{String(a.title)}</span>
            <span className="text-xs text-gray-400 shrink-0">{typeLabel[String(a.type)] ?? String(a.type)}</span>
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-semibold shrink-0">
              {statusLabel[String(a.status)] ?? '대기'}
            </span>
          </div>
        ))}
      </div>
      <div className="px-3 py-2 border-t border-yellow-100">
        <a href="/approval" className="text-xs text-yellow-700 font-semibold hover:underline">
          → 전자결재 페이지에서 처리하기
        </a>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════
   Notice List Card
════════════════════════════════════════════ */
function NoticeListCard({ notices }: { notices: Array<Record<string, unknown>> }) {
  if (notices.length === 0) {
    return (
      <div className="rounded-xl border border-gray-100 p-3 text-sm text-gray-400 bg-white/60">
        등록된 공지사항이 없습니다.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-blue-200 overflow-hidden text-sm bg-blue-50/40">
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-blue-100">
        <Bell size={14} className="text-blue-600" />
        <span className="font-bold text-blue-700">최근 공지사항 ({notices.length}건)</span>
      </div>
      <div className="divide-y divide-blue-50">
        {notices.map((n, i) => (
          <div key={i} className="flex items-center gap-2 px-3 py-2">
            {n.is_pinned ? (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 font-bold shrink-0">📌 고정</span>
            ) : (
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
            )}
            <span className="flex-1 text-gray-700 truncate">{String(n.title)}</span>
            <span className="text-xs text-gray-400 shrink-0">
              {String(n.created_at || '').slice(0, 10)}
            </span>
          </div>
        ))}
      </div>
      <div className="px-3 py-2 border-t border-blue-100">
        <a href="/notice" className="text-xs text-blue-700 font-semibold hover:underline">
          → 공지사항 페이지에서 전체 보기
        </a>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════
   Message Bubble
════════════════════════════════════════════ */
function MessageBubble({
  msg,
  onScheduleConfirm,
  onDocumentConfirm,
  onActionCancel,
  schedules,
  approvals,
  notices,
}: {
  msg: ChatMessage;
  onScheduleConfirm: (id: string, data: Record<string, unknown>) => void;
  onDocumentConfirm: (id: string, data: Record<string, unknown>) => void;
  onActionCancel: (id: string) => void;
  schedules: Array<Record<string, unknown>>;
  approvals: Array<Record<string, unknown>>;
  notices: Array<Record<string, unknown>>;
}) {
  const isUser = msg.role === 'user';

  return (
    <div className={clsx('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div className={clsx('max-w-[88%] space-y-2', isUser && 'items-end flex flex-col')}>
        <div
          className={clsx(
            'px-3 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words',
            isUser ? 'text-white rounded-tr-sm' : 'text-gray-800 rounded-tl-sm',
          )}
          style={
            isUser
              ? { background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }
              : {
                  background: 'rgba(255,255,255,0.85)',
                  border: '1px solid rgba(0,0,0,0.06)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                }
          }
        >
          {msg.content}
        </div>

        {msg.action && !msg.actionDone && msg.role === 'assistant' && (
          <div className="w-full">
            {msg.action.type === 'create_schedule' && (
              <ScheduleActionCard
                data={msg.action.data}
                onConfirm={(edited) => onScheduleConfirm(msg.id, edited)}
                onCancel={() => onActionCancel(msg.id)}
              />
            )}
            {msg.action.type === 'create_document' && (
              <DocumentActionCard
                data={msg.action.data}
                onConfirm={(edited) => onDocumentConfirm(msg.id, edited)}
                onCancel={() => onActionCancel(msg.id)}
              />
            )}
            {msg.action.type === 'show_schedules' && (
              <ScheduleListCard schedules={(msg.action.data?.scheduleList as Schedule[]) ?? []} />
            )}
            {msg.action.type === 'show_approvals' && (
              <ApprovalListCard approvals={approvals} />
            )}
            {msg.action.type === 'show_notices' && (
              <NoticeListCard notices={notices} />
            )}
          </div>
        )}

        {msg.actionDone && msg.action && (
          <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-semibold">
            <CheckCheck size={13} />
            {msg.action.type === 'create_schedule' ? '일정이 추가되었습니다' : '문서가 저장되었습니다'}
          </div>
        )}

        <span className="text-[11px] text-gray-300 px-1">
          {format(msg.timestamp, 'HH:mm')}
        </span>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════
   Main Widget
════════════════════════════════════════════ */
export default function ChatbotWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: uid(),
      role: 'assistant',
      content: '안녕하세요! 오피스 AI입니다 👋\n일정·문서 작성, 결재 현황, 공지사항 조회 등을 도와드릴게요.\n무엇을 도와드릴까요?',
      action: null,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [quickTab, setQuickTab] = useState<'work' | 'doc' | 'schedule'>('work');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  /* 양식을 입력창에 삽입하고 포커스 (문서용) */
  const fillTemplate = useCallback((template: string) => {
    setInput(template);
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const firstBlank = template.indexOf(': ') + 2;
        inputRef.current.setSelectionRange(firstBlank, firstBlank);
      }
    }, 50);
  }, []);

  /* 일정 추가 폼을 채팅에 바로 삽입 */
  const showScheduleForm = useCallback((formData: Record<string, unknown>) => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const defaults = {
      title: '',
      startDate: `${today} 09:00`,
      endDate: `${today} 10:00`,
      allDay: false,
      category: '회의',
      location: '',
      description: '',
      ...formData,
      // formData에 startDate/endDate 없으면 오늘 날짜 기본값
      startDate: formData.startDate ?? `${today} 09:00`,
      endDate: formData.endDate ?? `${today} 10:00`,
    };
    const msg: ChatMessage = {
      id: uid(),
      role: 'assistant',
      content: '아래 양식을 채워서 일정을 추가하세요.',
      action: { type: 'create_schedule', data: defaults },
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, msg]);
  }, []);
  const { addSchedule, schedules, fetchSchedules } = useScheduleStore();
  const { addDocument } = useDocumentStore();
  const { currentUser: _cu } = useAuthStore();
  const { pending: approvalPending, fetchPending: fetchApprovalPending } = useApprovalStore();
  const { notices, fetchNotices } = useNoticeStore();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
      // 챗봇 열 때 최신 데이터 로드
      fetchSchedules(true).catch(() => {});
      fetchApprovalPending().catch(() => {});
      fetchNotices().catch(() => {});
    }
  }, [open]);

  /* ── Send message ── */
  const sendMessage = useCallback(async (text: string) => {
    const userText = text.trim();
    if (!userText || loading) return;

    setInput('');
    setError('');

    const userMsg: ChatMessage = {
      id: uid(),
      role: 'user',
      content: userText,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const history = [...messages, userMsg]
        .filter(m => m.role !== 'system')
        .map(m => ({ role: m.role, content: m.content }));

      const result = await api.post<{ message: string; action: ChatAction | null }>(
        '/ai/chat',
        { messages: history, today: format(new Date(), 'yyyy-MM-dd') }
      );

      const assistantMsg: ChatMessage = {
        id: uid(),
        role: 'assistant',
        content: result.message || '응답을 받았습니다.',
        action: result.action ?? null,
        timestamp: new Date(),
      };

      // show_schedules: 서버에서 받은 scheduleList를 그대로 사용
      if (result.action?.type === 'show_schedules') {
        // 서버가 이미 정확한 기간 계산(타임존 보정, 기간 중첩 포함)으로 필터링한 결과를 사용
        // 프론트 store 재필터링 시 startDate만 보는 버그가 있어 서버 데이터 우선 사용
        assistantMsg.action = result.action;
      }

      // show_approvals: 서버에서 받은 approvals 데이터 사용
      if (result.action?.type === 'show_approvals') {
        const serverApprovals = result.action.data.approvals as Array<Record<string, unknown>> ?? [];
        assistantMsg.action = {
          ...result.action,
          data: { approvalList: serverApprovals },
        };
      }

      // show_notices: 서버에서 받은 notices 데이터 사용
      if (result.action?.type === 'show_notices') {
        const serverNotices = result.action.data.notices as Array<Record<string, unknown>> ?? [];
        assistantMsg.action = {
          ...result.action,
          data: { noticeList: serverNotices },
        };
      }

      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'AI 서버 연결 오류';
      if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('fetch')) {
        setError('서버에 연결할 수 없습니다. 서버가 실행 중인지 확인하세요.');
      } else if (msg.includes('Ollama') || msg.includes('503') || msg.includes('AI')) {
        setError('AI 엔진(Ollama)이 실행되지 않았습니다.\n터미널에서 ollama serve 를 실행 후 다시 시도하세요.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, [messages, loading, schedules, approvalPending, notices]);

  /* ── Schedule confirm ── */
  const handleScheduleConfirm = useCallback(async (msgId: string, data: Record<string, unknown>) => {
    try {
      const startISO = String(data.startDate ?? '').replace(' ', 'T');
      const endISO = String(data.endDate ?? '').replace(' ', 'T');
      const saved = await addSchedule({
        title: String(data.title ?? '새 일정'),
        description: String(data.description ?? ''),
        startDate: startISO || new Date().toISOString(),
        endDate: endISO || new Date().toISOString(),
        allDay: Boolean(data.allDay),
        category: (data.category as ScheduleCategory) ?? '기타',
        priority: 'medium' as Priority,
        location: String(data.location ?? ''),
        attendees: [],
      });
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, actionDone: true } : m));

      // Google Calendar 동기화 (연동된 경우)
      try {
        const token = localStorage.getItem('office_token');
        await fetch('/api/google/sync-event', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            title: data.title,
            description: data.description,
            startDate: startISO,
            endDate: endISO,
            allDay: data.allDay,
            location: data.location,
          }),
        });
      } catch (_) { /* 미연동이면 무시 */ }
    } catch {
      setError('일정 추가에 실패했습니다.');
    }
  }, [addSchedule]);

  /* ── Document confirm ── */
  const handleDocumentConfirm = useCallback(async (msgId: string, data: Record<string, unknown>) => {
    try {
      const catMap: Record<string, string> = {
        '회의록': '회의록', '업무보고': '보고서', '기획서': '계획서',
        '제안서': '제안서', '매뉴얼': '매뉴얼',
      };
      const rawCat = String(data.category ?? '기타');
      await addDocument({
        title: String(data.title ?? '새 문서'),
        content: String(data.content ?? ''),
        category: (catMap[rawCat] ?? '기타') as DocumentCategory,
        tags: data.tags as string[] ?? [],
      });
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, actionDone: true } : m));
    } catch {
      setError('문서 저장에 실패했습니다.');
    }
  }, [addDocument]);

  /* ── Action cancel ── */
  const handleActionCancel = useCallback((msgId: string) => {
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, action: null } : m));
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  /* ── 드래그 이동 ── */
  const [pos, setPos] = useState<{ right: number; bottom: number }>({ right: 24, bottom: 24 });
  const dragging = useRef(false);
  const didDrag = useRef(false);
  const dragStart = useRef({ mouseX: 0, mouseY: 0, right: 24, bottom: 24 });

  const onDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    didDrag.current = false;
    dragging.current = true;
    dragStart.current = { mouseX: e.clientX, mouseY: e.clientY, right: pos.right, bottom: pos.bottom };
    const onMove = (me: MouseEvent) => {
      if (!dragging.current) return;
      const dx = me.clientX - dragStart.current.mouseX;
      const dy = me.clientY - dragStart.current.mouseY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didDrag.current = true;
      setPos({
        right: Math.max(8, dragStart.current.right - dx),
        bottom: Math.max(8, dragStart.current.bottom - dy),
      });
    };
    const onUp = () => {
      dragging.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const btnPos: React.CSSProperties = { right: pos.right, bottom: pos.bottom };

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={(e) => { if (!didDrag.current) setOpen(true); e.stopPropagation(); }}
          onMouseDown={onDragStart}
          className="fixed w-14 h-14 rounded-full flex items-center justify-center z-50 transition-all duration-200 hover:scale-110 active:scale-95 cursor-grab active:cursor-grabbing"
          style={{
            ...btnPos,
            background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
            boxShadow: '0 4px 24px rgba(99,102,241,0.45), 0 2px 8px rgba(0,0,0,0.15)',
          }}
          title="AI 챗봇 열기 / 드래그로 이동"
        >
          <Sparkles size={22} className="text-white" />
          <span className="absolute w-full h-full rounded-full animate-ping opacity-20"
            style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }} />
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div
          className="fixed z-50 flex flex-col rounded-3xl overflow-hidden animate-slideUp"
          style={{
            ...btnPos,
            width: 420,
            height: 600,
            background: 'rgba(255,255,255,0.96)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(255,255,255,0.9)',
            boxShadow: '0 16px 48px rgba(0,0,0,0.18), 0 4px 16px rgba(99,102,241,0.15)',
          }}
        >
          {/* Header */}
          <div
            onMouseDown={onDragStart}
            className="flex items-center gap-3 px-4 py-3.5 shrink-0 cursor-grab active:cursor-grabbing select-none"
            style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)' }}
          >
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <Sparkles size={16} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white leading-tight">오피스 AI</p>
              <p className="text-xs text-blue-100 leading-tight">일정·문서·결재·공지 통합 어시스턴트</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="p-1.5 rounded-lg hover:bg-white/20 text-white/80 hover:text-white transition-colors shrink-0"
            >
              <Minimize2 size={15} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.map(msg => (
              <MessageBubble
                key={msg.id}
                msg={msg}
                onScheduleConfirm={handleScheduleConfirm}
                onDocumentConfirm={handleDocumentConfirm}
                onActionCancel={handleActionCancel}
                schedules={
                  msg.action?.type === 'show_schedules'
                    ? (msg.action.data.scheduleList as Array<Record<string, unknown>>) ?? []
                    : []
                }
                approvals={
                  msg.action?.type === 'show_approvals'
                    ? (msg.action.data.approvalList as Array<Record<string, unknown>>) ?? []
                    : []
                }
                notices={
                  msg.action?.type === 'show_notices'
                    ? (msg.action.data.noticeList as Array<Record<string, unknown>>) ?? []
                    : []
                }
              />
            ))}

            {loading && (
              <div className="flex justify-start">
                <div
                  className="px-4 py-2.5 rounded-2xl rounded-tl-sm flex items-center gap-2 text-sm text-gray-500"
                  style={{ background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(0,0,0,0.06)' }}
                >
                  <Loader2 size={14} className="animate-spin text-indigo-400 shrink-0" />
                  <span>
                    {/회의록|보고서|계획서|기획서|제안서|매뉴얼|가이드|작성|써줘|만들어/.test(messages.filter(m => m.role === 'user').at(-1)?.content ?? '')
                      ? 'AI가 문서 작성 중... (최대 2분 소요)'
                      : 'AI가 분석 중...'}
                  </span>
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-500 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                <AlertCircle size={14} className="shrink-0" />
                {error}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick prompts */}
          {!loading && (
            <div className="px-4 pb-2 shrink-0">
              {/* 탭 */}
              <div className="flex gap-1 mb-2">
                <button
                  onClick={() => setQuickTab('work')}
                  className={`flex-1 text-xs py-1 rounded-lg font-semibold transition-colors ${
                    quickTab === 'work'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  💼 업무 조회
                </button>
                <button
                  onClick={() => setQuickTab('doc')}
                  className={`flex-1 text-xs py-1 rounded-lg font-semibold transition-colors ${
                    quickTab === 'doc'
                      ? 'bg-emerald-500 text-white'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  📄 문서 작성
                </button>
                <button
                  onClick={() => setQuickTab('schedule')}
                  className={`flex-1 text-xs py-1 rounded-lg font-semibold transition-colors ${
                    quickTab === 'schedule'
                      ? 'bg-indigo-500 text-white'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  📅 일정
                </button>
              </div>
              {quickTab === 'work' && (
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_WORK.map(q => (
                    <button
                      key={q.prompt}
                      onClick={() => sendMessage(q.prompt)}
                      className="text-xs px-3 py-1.5 rounded-full border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 font-medium transition-colors"
                    >
                      {q.label}
                    </button>
                  ))}
                  <p className="w-full text-[10px] text-gray-400 mt-0.5">결재 대기, 공지사항, 일정을 빠르게 확인하세요</p>
                </div>
              )}
              {quickTab === 'doc' && (
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_DOCS.map(q => (
                    <button
                      key={q.label}
                      onClick={() => fillTemplate(q.template)}
                      className="text-xs px-3 py-1.5 rounded-full border border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 font-medium transition-colors"
                    >
                      {q.label}
                    </button>
                  ))}
                  <p className="w-full text-[10px] text-gray-400 mt-0.5">버튼을 누르면 양식이 입력창에 나타납니다. 내용을 채운 후 전송하세요.</p>
                </div>
              )}
              {quickTab === 'schedule' && (
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_SCHEDULE.map(q => (
                    <button
                      key={q.label}
                      onClick={() => q.formData ? showScheduleForm(q.formData) : sendMessage(q.prompt!)}
                      className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
                        q.formData
                          ? 'border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100'
                          : 'border-indigo-100 text-indigo-600 bg-indigo-50 hover:bg-indigo-100'
                      }`}
                    >
                      {q.label}
                    </button>
                  ))}
                  <p className="w-full text-[10px] text-gray-400 mt-0.5">📅 조회 버튼은 바로 검색, ➕ 추가 버튼은 채팅에 폼이 나타납니다.</p>
                </div>
              )}
            </div>
          )}

          {/* Input */}
          <div
            className="px-3 pb-3 pt-2 shrink-0 border-t"
            style={{ borderColor: 'rgba(0,0,0,0.06)' }}
          >
            <div
              className="flex items-end gap-2 rounded-2xl px-3 py-2"
              style={{ background: 'rgba(243,244,246,0.8)', border: '1px solid rgba(0,0,0,0.07)' }}
            >
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="메시지 입력... (Enter로 전송, Shift+Enter 줄바꿈)"
                rows={1}
                className="flex-1 bg-transparent outline-none text-[15px] text-gray-800 placeholder-gray-400 resize-none leading-relaxed"
                style={{ maxHeight: 80 }}
                onInput={e => {
                  const t = e.currentTarget;
                  t.style.height = 'auto';
                  t.style.height = Math.min(t.scrollHeight, 80) + 'px';
                }}
                disabled={loading}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || loading}
                className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-all disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}
              >
                {loading
                  ? <Loader2 size={14} className="animate-spin text-white" />
                  : <Send size={14} className="text-white" />
                }
              </button>
            </div>
            <p className="text-[11px] text-gray-300 text-center mt-1.5">AI 응답은 정확하지 않을 수 있습니다</p>
          </div>
        </div>
      )}
    </>
  );
}
