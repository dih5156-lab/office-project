import { useState, useEffect } from 'react';
import { useScheduleStore } from '../store/scheduleStore';
import { exportSchedulesToExcel } from '../utils/exportExcel';
import { exportSchedulesToPDF } from '../utils/exportPDF';
import {
  Plus,
  CalendarDays,
  Clock,
  MapPin,
  Users,
  Trash2,
  Edit3,
  ChevronLeft,
  ChevronRight,
  X,
  Check,
  Sheet,
  FileDown,
} from 'lucide-react';
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
} from 'date-fns';
import { ko } from 'date-fns/locale';
import clsx from 'clsx';
import { Schedule, ScheduleCategory, Priority } from '../types';

const categoryColors: Record<ScheduleCategory, string> = {
  회의: 'bg-blue-500',
  업무: 'bg-green-500',
  교육: 'bg-purple-500',
  출장: 'bg-orange-500',
  개인: 'bg-pink-500',
  기타: 'bg-gray-500',
};

const priorityLabels: Record<Priority, string> = { high: '높음', medium: '보통', low: '낮음' };

const emptyForm = {
  title: '',
  description: '',
  startDate: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
  endDate: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
  allDay: false,
  category: '업무' as ScheduleCategory,
  priority: 'medium' as Priority,
  location: '',
  attendees: [] as string[],
};

export default function SchedulePage() {
  const { schedules, addSchedule, updateSchedule, deleteSchedule, fetchSchedules } = useScheduleStore();
  const [currentMonth, setCurrentMonth] = useState(new Date());

  useEffect(() => { fetchSchedules(); }, []);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Schedule | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [attendeeInput, setAttendeeInput] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // 달력 날짜 계산
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart, { locale: ko });
  const calEnd = endOfWeek(monthEnd, { locale: ko });
  const calDays = eachDayOfInterval({ start: calStart, end: calEnd });

  const selectedDaySchedules = schedules.filter((s) =>
    isSameDay(new Date(s.startDate), selectedDate)
  );

  function openAddModal(date?: Date) {
    const base = date || new Date();
    setEditTarget(null);
    setForm({
      ...emptyForm,
      startDate: format(base, "yyyy-MM-dd'T'09:00"),
      endDate: format(base, "yyyy-MM-dd'T'10:00"),
    });
    setShowModal(true);
  }

  function openEditModal(schedule: Schedule) {
    setEditTarget(schedule);
    setForm({
      title: schedule.title,
      description: schedule.description,
      startDate: format(new Date(schedule.startDate), "yyyy-MM-dd'T'HH:mm"),
      endDate: format(new Date(schedule.endDate), "yyyy-MM-dd'T'HH:mm"),
      allDay: schedule.allDay,
      category: schedule.category,
      priority: schedule.priority,
      location: schedule.location || '',
      attendees: schedule.attendees || [],
    });
    setShowModal(true);
  }

  function handleSubmit() {
    if (!form.title.trim()) return;
    const data = {
      ...form,
      startDate: new Date(form.startDate).toISOString(),
      endDate: new Date(form.endDate).toISOString(),
    };
    if (editTarget) {
      updateSchedule(editTarget.id, data);
    } else {
      addSchedule(data);
    }
    setShowModal(false);
  }

  function addAttendee() {
    const name = attendeeInput.trim();
    if (name && !form.attendees.includes(name)) {
      setForm((f) => ({ ...f, attendees: [...f.attendees, name] }));
    }
    setAttendeeInput('');
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">일정 관리</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportSchedulesToExcel(schedules)}
            className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700"
            title="엑셀로 내보내기"
          >
            <Sheet size={14} /> 엑셀
          </button>
          <button
            onClick={() => exportSchedulesToPDF(schedules)}
            className="flex items-center gap-1.5 px-3 py-2 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600"
            title="PDF로 내보내기"
          >
            <FileDown size={14} /> PDF
          </button>
          <button
            onClick={() => openAddModal()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={16} />
            일정 추가
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 달력 */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          {/* 월 이동 */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
              className="p-1.5 hover:bg-gray-100 rounded-lg"
            >
              <ChevronLeft size={18} />
            </button>
            <h3 className="font-semibold text-gray-800">
              {format(currentMonth, 'yyyy년 M월', { locale: ko })}
            </h3>
            <button
              onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
              className="p-1.5 hover:bg-gray-100 rounded-lg"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* 요일 헤더 */}
          <div className="grid grid-cols-7 mb-2">
            {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
              <div
                key={d}
                className={clsx(
                  'text-center text-xs font-medium py-1',
                  i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-500'
                )}
              >
                {d}
              </div>
            ))}
          </div>

          {/* 날짜 그리드 */}
          <div className="grid grid-cols-7 gap-0.5">
            {calDays.map((day) => {
              const daySchedules = schedules.filter((s) =>
                isSameDay(new Date(s.startDate), day)
              );
              const isSelected = isSameDay(day, selectedDate);
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const dayOfWeek = day.getDay();

              return (
                <button
                  key={day.toISOString()}
                  onClick={() => setSelectedDate(day)}
                  className={clsx(
                    'relative min-h-[64px] p-1 rounded-lg text-left transition-colors',
                    isSelected ? 'bg-blue-50 ring-1 ring-blue-400' : 'hover:bg-gray-50',
                    !isCurrentMonth && 'opacity-30'
                  )}
                >
                  <span
                    className={clsx(
                      'text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full',
                      isToday(day)
                        ? 'bg-blue-600 text-white'
                        : dayOfWeek === 0
                        ? 'text-red-500'
                        : dayOfWeek === 6
                        ? 'text-blue-500'
                        : 'text-gray-700'
                    )}
                  >
                    {format(day, 'd')}
                  </span>
                  <div className="mt-0.5 space-y-0.5">
                    {daySchedules.slice(0, 2).map((s) => (
                      <div
                        key={s.id}
                        className={clsx(
                          'text-[10px] px-1 py-0.5 rounded text-white truncate',
                          categoryColors[s.category]
                        )}
                      >
                        {s.title}
                      </div>
                    ))}
                    {daySchedules.length > 2 && (
                      <div className="text-[10px] text-gray-400 pl-1">
                        +{daySchedules.length - 2}개
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 선택된 날짜 일정 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">
              {format(selectedDate, 'M월 d일 (EEEE)', { locale: ko })}
            </h3>
            <button
              onClick={() => openAddModal(selectedDate)}
              className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500"
            >
              <Plus size={16} />
            </button>
          </div>

          {selectedDaySchedules.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <CalendarDays size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">일정이 없습니다</p>
              <button
                onClick={() => openAddModal(selectedDate)}
                className="mt-2 text-xs text-blue-500 hover:underline"
              >
                일정 추가하기
              </button>
            </div>
          ) : (
            <ul className="space-y-3">
              {selectedDaySchedules.map((s) => (
                <li key={s.id} className="border border-gray-100 rounded-lg p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={clsx('w-2 h-2 rounded-full shrink-0', categoryColors[s.category])} />
                      <p className="text-sm font-medium text-gray-800 truncate">{s.title}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => openEditModal(s)}
                        className="p-1 hover:bg-gray-100 rounded text-gray-400"
                      >
                        <Edit3 size={13} />
                      </button>
                      {deleteConfirm === s.id ? (
                        <button
                          onClick={() => { deleteSchedule(s.id); setDeleteConfirm(null); }}
                          className="p-1 bg-red-100 rounded text-red-500"
                        >
                          <Check size={13} />
                        </button>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirm(s.id)}
                          className="p-1 hover:bg-gray-100 rounded text-gray-400"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="mt-1.5 space-y-1">
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <Clock size={11} />
                      {s.allDay
                        ? '종일'
                        : `${format(new Date(s.startDate), 'HH:mm')} ~ ${format(new Date(s.endDate), 'HH:mm')}`}
                    </p>
                    {s.location && (
                      <p className="text-xs text-gray-500 flex items-center gap-1">
                        <MapPin size={11} />
                        {s.location}
                      </p>
                    )}
                    {s.attendees && s.attendees.length > 0 && (
                      <p className="text-xs text-gray-500 flex items-center gap-1">
                        <Users size={11} />
                        {s.attendees.join(', ')}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* 모달 */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-800">
                {editTarget ? '일정 수정' : '일정 추가'}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X size={18} />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">제목 *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="일정 제목을 입력하세요"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">카테고리</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as ScheduleCategory }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {(['회의', '업무', '교육', '출장', '개인', '기타'] as ScheduleCategory[]).map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">우선순위</label>
                  <select
                    value={form.priority}
                    onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as Priority }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {(['high', 'medium', 'low'] as Priority[]).map((p) => (
                      <option key={p} value={p}>{priorityLabels[p]}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="allDay"
                  checked={form.allDay}
                  onChange={(e) => setForm((f) => ({ ...f, allDay: e.target.checked }))}
                  className="rounded"
                />
                <label htmlFor="allDay" className="text-sm text-gray-700">종일 일정</label>
              </div>
              {!form.allDay && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">시작</label>
                    <input
                      type="datetime-local"
                      value={form.startDate}
                      onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">종료</label>
                    <input
                      type="datetime-local"
                      value={form.endDate}
                      onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">장소</label>
                <input
                  type="text"
                  value={form.location}
                  onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="회의실, 장소 등"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">참석자</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={attendeeInput}
                    onChange={(e) => setAttendeeInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addAttendee()}
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="이름 입력 후 Enter"
                  />
                  <button
                    type="button"
                    onClick={addAttendee}
                    className="px-3 py-2 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200"
                  >
                    추가
                  </button>
                </div>
                {form.attendees.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {form.attendees.map((a) => (
                      <span
                        key={a}
                        className="flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full"
                      >
                        {a}
                        <button
                          onClick={() => setForm((f) => ({ ...f, attendees: f.attendees.filter((x) => x !== a) }))}
                        >
                          <X size={10} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">설명</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={3}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="일정 상세 내용"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                취소
              </button>
              <button
                onClick={handleSubmit}
                disabled={!form.title.trim()}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {editTarget ? '수정 완료' : '일정 추가'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
