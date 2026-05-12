import { Dispatch, SetStateAction, useEffect, useRef, useState } from 'react';
import { X, Plus, Trash2, UserPlus, ChevronDown } from 'lucide-react';
import clsx from 'clsx';
import { Schedule } from '../../types';
import {
  ALL_CATEGORIES,
  CATEGORY_COLORS,
  createEmptyScheduleForm,
} from '../../features/schedule/constants';
import { ScheduleForm } from '../../features/schedule/types';
import { useAuthStore } from '../../store/authStore';
import ContactPicker from '../Contacts/ContactPicker';

type BulkEntry = ScheduleForm & { _id: string };

type Props = {
  editTarget: Schedule | null;
  form: ScheduleForm;
  setForm: Dispatch<SetStateAction<ScheduleForm>>;
  onClose: () => void;
  onSubmit: () => void;
  onBulkSubmit: (forms: ScheduleForm[]) => Promise<void>;
};

function makeBulkEntry(): BulkEntry {
  return { ...createEmptyScheduleForm(), _id: String(Date.now() + Math.random()) };
}

export function ScheduleModal({
  editTarget,
  form,
  setForm,
  onClose,
  onSubmit,
  onBulkSubmit,
}: Props) {
  const [tab, setTab] = useState<'single' | 'bulk'>(editTarget ? 'single' : 'single');
  const [bulkEntries, setBulkEntries] = useState<BulkEntry[]>([makeBulkEntry(), makeBulkEntry()]);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);

  const isEdit = !!editTarget;

  async function handleBulkSubmit() {
    const valid = bulkEntries.filter((e) => e.title.trim());
    if (!valid.length) return;
    setBulkSubmitting(true);
    await onBulkSubmit(valid);
    setBulkSubmitting(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <h3 className="font-semibold text-gray-800">
              {isEdit ? '일정 수정' : '일정 추가'}
            </h3>
            {!isEdit && (
              <div className="flex bg-gray-100 rounded-lg p-0.5 text-sm">
                <button
                  onClick={() => setTab('single')}
                  className={clsx(
                    'px-3 py-1 rounded-md font-medium transition-colors',
                    tab === 'single' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  )}
                >
                  단일 추가
                </button>
                <button
                  onClick={() => setTab('bulk')}
                  className={clsx(
                    'px-3 py-1 rounded-md font-medium transition-colors',
                    tab === 'bulk' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  )}
                >
                  일괄 추가
                </button>
              </div>
            )}
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <X size={18} />
          </button>
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {tab === 'single' ? (
            <div className="space-y-4">
              <TitleField form={form} setForm={setForm} onSubmit={onSubmit} />
              <CategoryField form={form} setForm={setForm} />
              <DateFields form={form} setForm={setForm} />
              <LocationField form={form} setForm={setForm} />
              <AttendeeField form={form} setForm={setForm} />
              <DescriptionField form={form} setForm={setForm} />
            </div>
          ) : (
            <BulkForm entries={bulkEntries} setEntries={setBulkEntries} />
          )}
        </div>

        {/* 푸터 */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            취소
          </button>
          {tab === 'single' ? (
            <button
              onClick={onSubmit}
              disabled={!form.title.trim()}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isEdit ? '수정 완료' : '일정 추가'}
            </button>
          ) : (
            <button
              onClick={handleBulkSubmit}
              disabled={bulkSubmitting || !bulkEntries.some((e) => e.title.trim())}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {bulkSubmitting ? '추가 중...' : `${bulkEntries.filter((e) => e.title.trim()).length}개 일정 추가`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── 단일 추가 필드 컴포넌트 ─── */

type FieldProps = {
  form: ScheduleForm;
  setForm: Dispatch<SetStateAction<ScheduleForm>>;
};

type TitleFieldProps = FieldProps & { onSubmit: () => void };

function TitleField({ form, setForm, onSubmit }: TitleFieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">제목 *</label>
      <input
        type="text"
        value={form.title}
        onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
        onKeyDown={(event) => event.key === 'Enter' && onSubmit()}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder="일정 제목을 입력하세요"
        autoFocus
      />
    </div>
  );
}

function CategoryField({ form, setForm }: FieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">카테고리</label>
      <div className="flex flex-wrap gap-2">
        {ALL_CATEGORIES.map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => setForm((prev) => ({ ...prev, category }))}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
              form.category === category
                ? `${CATEGORY_COLORS[category]} text-white`
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}
          >
            {category}
          </button>
        ))}
      </div>
    </div>
  );
}

function DateFields({ form, setForm }: FieldProps) {
  return (
    <>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="allDay"
          checked={form.allDay}
          onChange={(event) => setForm((prev) => ({ ...prev, allDay: event.target.checked }))}
          className="rounded"
        />
        <label htmlFor="allDay" className="text-sm text-gray-700">종일 일정</label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <DateInput
          label="시작"
          value={form.startDate}
          allDay={form.allDay}
          onChange={(value) => {
            const newStart = form.allDay ? `${value}T00:00` : value;
            setForm((prev) => {
              const newEnd =
                new Date(prev.endDate) <= new Date(newStart)
                  ? addTenMinutes(newStart)
                  : prev.endDate;
              return { ...prev, startDate: newStart, endDate: newEnd };
            });
          }}
        />
        <DateInput
          label="종료"
          value={form.endDate}
          allDay={form.allDay}
          onChange={(value) => setForm((prev) => ({
            ...prev,
            endDate: form.allDay ? `${value}T23:59` : value,
          }))}
        />
      </div>
    </>
  );
}

type DateInputProps = {
  label: string;
  value: string;   // "yyyy-MM-ddTHH:mm" or "yyyy-MM-dd"
  allDay: boolean;
  onChange: (value: string) => void;
};

// value에서 날짜/시간 분해
function parseDateValue(value: string): { datePart: string; period: 'AM' | 'PM'; h12: number; min: number } {
  const datePart = value.slice(0, 10);
  const timePart = value.length >= 16 ? value.slice(11, 16) : '09:00';
  const [hStr, mStr] = timePart.split(':');
  const h24 = parseInt(hStr, 10) || 0;
  const min = parseInt(mStr, 10) || 0;
  const period: 'AM' | 'PM' = h24 < 12 ? 'AM' : 'PM';
  const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
  return { datePart, period, h12, min };
}

function buildDateValue(datePart: string, period: 'AM' | 'PM', h12: number, min: number) {
  let h24 = h12 % 12;
  if (period === 'PM') h24 += 12;
  return `${datePart}T${String(h24).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

function addTenMinutes(isoStr: string): string {
  const d = new Date(isoStr);
  d.setMinutes(d.getMinutes() + 10);
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-') + 'T' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

function DateInput({ label, value, allDay, onChange }: DateInputProps) {
  const { datePart, period, h12, min } = parseDateValue(value);

  function handleDate(e: React.ChangeEvent<HTMLInputElement>) {
    if (allDay) { onChange(e.target.value); return; }
    onChange(buildDateValue(e.target.value, period, h12, min));
  }
  function handlePeriod(p: 'AM' | 'PM') {
    onChange(buildDateValue(datePart, p, h12, min));
  }
  function handleHour(e: React.ChangeEvent<HTMLSelectElement>) {
    onChange(buildDateValue(datePart, period, parseInt(e.target.value, 10), min));
  }
  function handleMin(e: React.ChangeEvent<HTMLSelectElement>) {
    onChange(buildDateValue(datePart, period, h12, parseInt(e.target.value, 10)));
  }

  const selectCls = 'border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white';

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">{label}</label>

      {/* 날짜 */}
      <input
        type="date"
        value={allDay ? value.slice(0, 10) : datePart}
        onChange={handleDate}
        className={`w-full ${selectCls}`}
      />

      {/* 시간 (종일 아닐 때만) */}
      {!allDay && (
        <div className="flex items-center gap-1.5">
          {/* 오전/오후 — 좌측 상단 */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm font-medium shrink-0">
            {(['AM', 'PM'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => handlePeriod(p)}
                className={clsx(
                  'px-2.5 py-1.5 transition-colors',
                  period === p
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                )}
              >
                {p === 'AM' ? '오전' : '오후'}
              </button>
            ))}
          </div>

          {/* 시 */}
          <select value={h12} onChange={handleHour} className={selectCls}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
              <option key={h} value={h}>{h}시</option>
            ))}
          </select>

          {/* 분 */}
          <select value={min} onChange={handleMin} className={selectCls}>
            {[0, 10, 20, 30, 40, 50].map((m) => (
              <option key={m} value={m}>{String(m).padStart(2, '0')}분</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

function LocationField({ form, setForm }: FieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">장소</label>
      <input
        type="text"
        value={form.location}
        onChange={(event) => setForm((prev) => ({ ...prev, location: event.target.value }))}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder="회의실, 장소 등"
      />
    </div>
  );
}

function AttendeeField({ form, setForm }: FieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
        <UserPlus size={14} />
        참석자
      </label>
      <ContactPicker
        value={form.attendees}
        onChange={(v) => setForm((prev) => ({ ...prev, attendees: v }))}
        placeholder="주소록에서 참석자 선택..."
      />
    </div>
  );
}

function DescriptionField({ form, setForm }: FieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">설명</label>
      <textarea
        value={form.description}
        onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
        rows={3}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        placeholder="일정 상세 내용"
      />
    </div>
  );
}

/* ─── 일괄 추가 폼 ─── */

type BulkFormProps = {
  entries: BulkEntry[];
  setEntries: Dispatch<SetStateAction<BulkEntry[]>>;
};

function BulkForm({ entries, setEntries }: BulkFormProps) {
  function addRow() {
    setEntries((prev) => [...prev, makeBulkEntry()]);
  }

  function removeRow(id: string) {
    setEntries((prev) => prev.filter((e) => e._id !== id));
  }

  function updateEntry(id: string, patch: Partial<ScheduleForm>) {
    setEntries((prev) => prev.map((e) => (e._id === id ? { ...e, ...patch } : e)));
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">
        여러 일정을 한 번에 추가합니다. 제목이 비어있는 행은 건너뜁니다.
      </p>
      <div className="space-y-2">
        {entries.map((entry, idx) => (
          <BulkRow
            key={entry._id}
            entry={entry}
            index={idx}
            onUpdate={(patch) => updateEntry(entry._id, patch)}
            onRemove={() => removeRow(entry._id)}
            canRemove={entries.length > 1}
          />
        ))}
      </div>
      <button
        type="button"
        onClick={addRow}
        className="w-full flex items-center justify-center gap-1.5 py-2 border-2 border-dashed border-gray-200 rounded-lg text-sm text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-colors"
      >
        <Plus size={15} />
        행 추가
      </button>
    </div>
  );
}

type BulkRowProps = {
  entry: BulkEntry;
  index: number;
  onUpdate: (patch: Partial<ScheduleForm>) => void;
  onRemove: () => void;
  canRemove: boolean;
};

function BulkRow({ entry, index, onUpdate, onRemove, canRemove }: BulkRowProps) {
  const [openCat, setOpenCat] = useState(false);
  const catRef = useRef<HTMLDivElement>(null);
  const [attendeeInput, setAttendeeInput] = useState('');
  const [showAttendeeDropdown, setShowAttendeeDropdown] = useState(false);
  const attendeeRef = useRef<HTMLDivElement>(null);
  const { users, fetchUsers } = useAuthStore();

  useEffect(() => { fetchUsers().catch(() => {}); }, [fetchUsers]);

  useEffect(() => {
    function outside(e: MouseEvent) {
      if (catRef.current && !catRef.current.contains(e.target as Node)) setOpenCat(false);
      if (attendeeRef.current && !attendeeRef.current.contains(e.target as Node)) setShowAttendeeDropdown(false);
    }
    document.addEventListener('mousedown', outside);
    return () => document.removeEventListener('mousedown', outside);
  }, []);

  function addAttendee(name: string) {
    const trimmed = name.trim();
    if (!trimmed || entry.attendees.includes(trimmed)) return;
    onUpdate({ attendees: [...entry.attendees, trimmed] });
    setAttendeeInput('');
    setShowAttendeeDropdown(false);
  }

  function removeAttendee(name: string) {
    onUpdate({ attendees: entry.attendees.filter((a) => a !== name) });
  }

  const filteredUsers = users.filter(
    (u) => !entry.attendees.includes(u.name) && (u.name.includes(attendeeInput) || u.department.includes(attendeeInput))
  );

  const startParsed = parseDateValue(entry.startDate);
  const endParsed   = parseDateValue(entry.endDate);

  function updateStartDate(newStart: string) {
    const newEnd =
      new Date(entry.endDate) <= new Date(newStart)
        ? addTenMinutes(newStart)
        : entry.endDate;
    onUpdate({ startDate: newStart, endDate: newEnd });
  }

  function handleStartDate(e: React.ChangeEvent<HTMLInputElement>) {
    updateStartDate(entry.allDay ? `${e.target.value}T00:00` : buildDateValue(e.target.value, startParsed.period, startParsed.h12, startParsed.min));
  }
  function handleEndDate(e: React.ChangeEvent<HTMLInputElement>) {
    onUpdate({ endDate: entry.allDay ? `${e.target.value}T23:59` : buildDateValue(e.target.value, endParsed.period, endParsed.h12, endParsed.min) });
  }

  const selCls = 'border border-gray-200 rounded-lg px-1.5 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white';

  return (
    <div className="bg-gray-50 rounded-lg p-3 space-y-2">
      {/* 윗줄: 번호 · 제목 · 카테고리 · 종일 · 삭제 */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400 font-mono w-5 shrink-0">{index + 1}</span>

        <input
          type="text"
          value={entry.title}
          onChange={(e) => onUpdate({ title: e.target.value })}
          placeholder="제목 *"
          className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white min-w-0"
        />

        {/* 카테고리 */}
        <div ref={catRef} className="relative shrink-0">
          <button
            type="button"
            onClick={() => setOpenCat((v) => !v)}
            className={clsx(
              'flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium border text-white',
              CATEGORY_COLORS[entry.category]
            )}
          >
            {entry.category}
            <ChevronDown size={11} />
          </button>
          {openCat && (
            <div className="absolute top-full left-0 z-20 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
              {ALL_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); onUpdate({ category: cat }); setOpenCat(false); }}
                  className={clsx(
                    'block w-full px-3 py-1.5 text-xs text-left hover:bg-gray-50',
                    entry.category === cat ? 'font-bold text-blue-600' : 'text-gray-700'
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 종일 */}
        <label className="flex items-center gap-1 text-xs text-gray-600 shrink-0">
          <input
            type="checkbox"
            checked={entry.allDay}
            onChange={(e) => onUpdate({ allDay: e.target.checked })}
            className="rounded"
          />
          종일
        </label>

        {/* 삭제 */}
        <button
          type="button"
          onClick={onRemove}
          disabled={!canRemove}
          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30 shrink-0"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* 아랫줄: 시작 / 종료 날짜+시간 */}
      <div className="flex items-start gap-4 pl-7">
        {/* 시작 */}
        <div className="space-y-1">
          <span className="text-[11px] font-medium text-gray-500">시작</span>
          <input
            type="date"
            value={startParsed.datePart}
            onChange={handleStartDate}
            className={selCls}
          />
          {!entry.allDay && (
            <div className="flex items-center gap-1 mt-1">
              <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium shrink-0">
                {(['AM', 'PM'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() =>
                      updateStartDate(buildDateValue(startParsed.datePart, p, startParsed.h12, startParsed.min))
                    }
                    className={clsx(
                      'px-2 py-1 transition-colors',
                      startParsed.period === p ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                    )}
                  >
                    {p === 'AM' ? '오전' : '오후'}
                  </button>
                ))}
              </div>
              <select
                value={startParsed.h12}
                onChange={(e) =>
                  updateStartDate(buildDateValue(startParsed.datePart, startParsed.period, parseInt(e.target.value, 10), startParsed.min))
                }
                className={selCls}
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                  <option key={h} value={h}>{h}시</option>
                ))}
              </select>
              <select
                value={startParsed.min}
                onChange={(e) =>
                  updateStartDate(buildDateValue(startParsed.datePart, startParsed.period, startParsed.h12, parseInt(e.target.value, 10)))
                }
                className={selCls}
              >
                {[0, 10, 20, 30, 40, 50].map((m) => (
                  <option key={m} value={m}>{String(m).padStart(2, '0')}분</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <span className="text-gray-400 text-xs pt-6">~</span>

        {/* 종료 */}
        <div className="space-y-1">
          <span className="text-[11px] font-medium text-gray-500">종료</span>
          <input
            type="date"
            value={endParsed.datePart}
            onChange={handleEndDate}
            className={selCls}
          />
          {!entry.allDay && (
            <div className="flex items-center gap-1 mt-1">
              <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium shrink-0">
                {(['AM', 'PM'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() =>
                      onUpdate({ endDate: buildDateValue(endParsed.datePart, p, endParsed.h12, endParsed.min) })
                    }
                    className={clsx(
                      'px-2 py-1 transition-colors',
                      endParsed.period === p ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                    )}
                  >
                    {p === 'AM' ? '오전' : '오후'}
                  </button>
                ))}
              </div>
              <select
                value={endParsed.h12}
                onChange={(e) =>
                  onUpdate({ endDate: buildDateValue(endParsed.datePart, endParsed.period, parseInt(e.target.value, 10), endParsed.min) })
                }
                className={selCls}
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                  <option key={h} value={h}>{h}시</option>
                ))}
              </select>
              <select
                value={endParsed.min}
                onChange={(e) =>
                  onUpdate({ endDate: buildDateValue(endParsed.datePart, endParsed.period, endParsed.h12, parseInt(e.target.value, 10)) })
                }
                className={selCls}
              >
                {[0, 10, 20, 30, 40, 50].map((m) => (
                  <option key={m} value={m}>{String(m).padStart(2, '0')}분</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* 장소 */}
      <div className="pl-7">
        <input
          type="text"
          value={entry.location}
          onChange={(e) => onUpdate({ location: e.target.value })}
          placeholder="장소 (선택)"
          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        />
      </div>

      {/* 담당자 */}
      <div ref={attendeeRef} className="pl-7 relative">
        <div
          className="min-h-[34px] border border-gray-200 rounded-lg px-2 py-1 flex flex-wrap gap-1 items-center focus-within:ring-2 focus-within:ring-blue-500 cursor-text bg-white"
          onClick={() => setShowAttendeeDropdown(true)}
        >
          {entry.attendees.map((name) => (
            <span key={name} className="inline-flex items-center gap-0.5 bg-blue-100 text-blue-700 text-xs px-1.5 py-0.5 rounded-full">
              {name}
              <button type="button" onClick={(e) => { e.stopPropagation(); removeAttendee(name); }} className="hover:text-blue-900">
                <X size={9} />
              </button>
            </span>
          ))}
          <input
            type="text"
            value={attendeeInput}
            onChange={(e) => { setAttendeeInput(e.target.value); setShowAttendeeDropdown(true); }}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ',') && attendeeInput.trim()) { e.preventDefault(); addAttendee(attendeeInput); }
              else if (e.key === 'Backspace' && !attendeeInput && entry.attendees.length > 0) removeAttendee(entry.attendees[entry.attendees.length - 1]);
            }}
            onFocus={() => setShowAttendeeDropdown(true)}
            placeholder={entry.attendees.length === 0 ? '담당자 입력 (선택)' : ''}
            className="flex-1 min-w-[100px] text-xs outline-none bg-transparent"
          />
        </div>
        {showAttendeeDropdown && (filteredUsers.length > 0 || attendeeInput.trim()) && (
          <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
            {filteredUsers.map((u) => (
              <button key={u.id} type="button"
                onMouseDown={(e) => { e.preventDefault(); addAttendee(u.name); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-gray-50 text-left"
              >
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-bold shrink-0">{u.name[0]}</span>
                <span className="font-medium text-gray-800">{u.name}</span>
                <span className="text-gray-400 ml-auto">{u.department}</span>
              </button>
            ))}
            {attendeeInput.trim() && !users.some((u) => u.name === attendeeInput.trim()) && (
              <button type="button"
                onMouseDown={(e) => { e.preventDefault(); addAttendee(attendeeInput); }}
                className="w-full px-3 py-1.5 text-xs text-blue-600 hover:bg-blue-50 text-left flex items-center gap-1"
              >
                <Plus size={11} /> &quot;{attendeeInput.trim()}&quot; 직접 추가
              </button>
            )}
          </div>
        )}
      </div>

      {/* 설명 (메모) */}
      <div className="pl-7">
        <textarea
          value={entry.description}
          onChange={(e) => onUpdate({ description: e.target.value })}
          rows={2}
          placeholder="메모 — 달력에서 마우스를 올리면 표시됩니다"
          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none bg-white"
        />
      </div>
    </div>
  );
}

