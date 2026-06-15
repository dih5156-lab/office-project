import { useEffect, useState } from 'react';
import { addDays, addMonths, addWeeks, endOfWeek, format, startOfWeek } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useScheduleStore } from '../store/scheduleStore';
import { Schedule, ScheduleCategory } from '../types';
import { ScheduleToolbar } from '../components/Schedule/ScheduleToolbar';
import { ScheduleCategoryFilter } from '../components/Schedule/ScheduleCategoryFilter';
import { ScheduleMonthCalendar } from '../components/Schedule/ScheduleMonthCalendar';
import { ScheduleSidePanel } from '../components/Schedule/ScheduleSidePanel';
import { ScheduleListView } from '../components/Schedule/ScheduleListView';
import { ScheduleModal } from '../components/Schedule/ScheduleModal';
import {
  createEmptyScheduleForm,
} from '../features/schedule/constants';
import {
  getScheduleForm,
  getSchedulePayload,
  isScheduleInRange,
  isScheduleOnDate,
  sortSchedulesByStart,
} from '../features/schedule/calendar';
import { ScheduleForm, ScheduleViewMode } from '../features/schedule/types';

export default function SchedulePage() {
  const {
    schedules,
    addSchedule,
    updateSchedule,
    deleteSchedule,
    fetchSchedules,
  } = useScheduleStore();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [viewMode, setViewMode] = useState<ScheduleViewMode>('calendar');
  const [filterCategory, setFilterCategory] = useState<ScheduleCategory | 'all'>('all');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Schedule | null>(null);
  const [form, setForm] = useState<ScheduleForm>(() => createEmptyScheduleForm());
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  const filteredSchedules = filterSchedules(schedules, filterCategory);
  const selectedDaySchedules = filteredSchedules
    .filter((schedule) => isScheduleOnDate(schedule, selectedDate))
    .sort(sortSchedulesByStart);
  const thisWeekStart = startOfWeek(new Date(), { locale: ko });
  const thisWeekEnd = endOfWeek(new Date(), { locale: ko });
  const thisWeekSchedules = filteredSchedules
    .filter((schedule) => isScheduleInRange(schedule, thisWeekStart, thisWeekEnd))
    .sort(sortSchedulesByStart);

  function openAddModal(date?: Date) {
    const base = date || new Date();

    setEditTarget(null);
    setForm({
      ...createEmptyScheduleForm(),
      startDate: format(base, "yyyy-MM-dd'T'09:00"),
      endDate: format(base, "yyyy-MM-dd'T'10:00"),
    });
    setShowModal(true);
  }

  function openEditModal(schedule: Schedule) {
    setEditTarget(schedule);
    setForm(getScheduleForm(schedule));
    setShowModal(true);
  }

  async function handleSubmit() {
    if (!form.title.trim()) return;

    if (editTarget) {
      await updateSchedule(editTarget.id, getSchedulePayload(form));
    } else if (form.repeatType !== 'none') {
      const count = Math.max(2, Math.min(52, form.repeatCount));
      for (let i = 0; i < count; i++) {
        const offsetStart = applyRepeatOffset(form.startDate, form.repeatType, i);
        const offsetEnd = applyRepeatOffset(form.endDate, form.repeatType, i);
        const repeated: ScheduleForm = { ...form, startDate: offsetStart, endDate: offsetEnd };
        await addSchedule(getSchedulePayload(repeated));
      }
    } else {
      await addSchedule(getSchedulePayload(form));
    }
    setShowModal(false);
  }

  async function handleBulkSubmit(forms: ScheduleForm[]) {
    for (const f of forms) {
      if (f.title.trim()) {
        await addSchedule(getSchedulePayload(f));
      }
    }
    setShowModal(false);
  }

  async function handleDelete(id: string) {
    await deleteSchedule(id);
    setDeleteConfirm(null);
  }

  async function exportSchedulesAsCsv() {
    const { exportSchedulesToExcel } = await import('../utils/exportExcel');
    exportSchedulesToExcel(schedules);
  }

  async function exportSchedulesAsPdf() {
    const { exportSchedulesToPDF } = await import('../utils/exportPDF');
    exportSchedulesToPDF(schedules);
  }

  return (
    <div className="space-y-5">
      <ScheduleToolbar
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onAdd={() => openAddModal()}
        onExcel={exportSchedulesAsCsv}
        onPdf={exportSchedulesAsPdf}
      />
      <ScheduleCategoryFilter
        value={filterCategory}
        onChange={setFilterCategory}
      />
      {viewMode === 'calendar' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <ScheduleMonthCalendar
            currentMonth={currentMonth}
            selectedDate={selectedDate}
            schedules={filteredSchedules}
            onMonthChange={setCurrentMonth}
            onSelectedDateChange={setSelectedDate}
            onEdit={openEditModal}
          />
          <ScheduleSidePanel
            thisWeekStart={thisWeekStart}
            thisWeekEnd={thisWeekEnd}
            thisWeekSchedules={thisWeekSchedules}
            selectedDate={selectedDate}
            selectedDaySchedules={selectedDaySchedules}
            deleteConfirm={deleteConfirm}
            onAdd={openAddModal}
            onEdit={openEditModal}
            onDelete={handleDelete}
            onDeleteConfirmChange={setDeleteConfirm}
          />
        </div>
      )}
      {viewMode === 'list' && (
        <ScheduleListView
          schedules={filteredSchedules}
          deleteConfirm={deleteConfirm}
          onAdd={() => openAddModal()}
          onEdit={openEditModal}
          onDelete={handleDelete}
          onDeleteConfirmChange={setDeleteConfirm}
        />
      )}
      {showModal && (
        <ScheduleModal
          editTarget={editTarget}
          form={form}
          setForm={setForm}
          onClose={() => setShowModal(false)}
          onSubmit={handleSubmit}
          onBulkSubmit={handleBulkSubmit}
        />
      )}
    </div>
  );
}

function filterSchedules(
  schedules: Schedule[],
  category: ScheduleCategory | 'all'
) {
  if (category === 'all') return schedules;

  return schedules.filter((schedule) => schedule.category === category);
}

function applyRepeatOffset(dateStr: string, type: 'daily' | 'weekly' | 'monthly', i: number): string {
  const d = new Date(dateStr);
  if (type === 'daily') return format(addDays(d, i), "yyyy-MM-dd'T'HH:mm");
  if (type === 'weekly') return format(addWeeks(d, i), "yyyy-MM-dd'T'HH:mm");
  return format(addMonths(d, i), "yyyy-MM-dd'T'HH:mm");
}
