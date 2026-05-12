import { CalendarDays, Check, Edit3, MapPin, Plus, Trash2 } from 'lucide-react';
import { format, isSameDay } from 'date-fns';
import { ko } from 'date-fns/locale';
import clsx from 'clsx';
import { Schedule } from '../../types';
import { CATEGORY_COLORS } from '../../features/schedule/constants';

type Props = {
  thisWeekStart: Date;
  thisWeekEnd: Date;
  thisWeekSchedules: Schedule[];
  selectedDate: Date;
  selectedDaySchedules: Schedule[];
  deleteConfirm: string | null;
  onAdd: (date: Date) => void;
  onEdit: (schedule: Schedule) => void;
  onDelete: (id: string) => void;
  onDeleteConfirmChange: (id: string | null) => void;
};

export function ScheduleSidePanel({
  thisWeekStart,
  thisWeekEnd,
  thisWeekSchedules,
  selectedDate,
  selectedDaySchedules,
  deleteConfirm,
  onAdd,
  onEdit,
  onDelete,
  onDeleteConfirmChange,
}: Props) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex flex-col gap-4">
      <WeekList
        thisWeekStart={thisWeekStart}
        thisWeekEnd={thisWeekEnd}
        schedules={thisWeekSchedules}
        deleteConfirm={deleteConfirm}
        onEdit={onEdit}
        onDelete={onDelete}
        onDeleteConfirmChange={onDeleteConfirmChange}
      />
      {!isSameDay(selectedDate, new Date()) && (
        <SelectedDateList
          selectedDate={selectedDate}
          schedules={selectedDaySchedules}
          onAdd={onAdd}
        />
      )}
    </div>
  );
}

type WeekListProps = {
  thisWeekStart: Date;
  thisWeekEnd: Date;
  schedules: Schedule[];
  deleteConfirm: string | null;
  onEdit: (schedule: Schedule) => void;
  onDelete: (id: string) => void;
  onDeleteConfirmChange: (id: string | null) => void;
};

function WeekList({
  thisWeekStart,
  thisWeekEnd,
  schedules,
  deleteConfirm,
  onEdit,
  onDelete,
  onDeleteConfirmChange,
}: WeekListProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-800">이번 주 일정</h3>
        <span className="text-xs text-gray-400">
          {format(thisWeekStart, 'M/d', { locale: ko })} ~ {format(thisWeekEnd, 'M/d', { locale: ko })}
        </span>
      </div>
      {schedules.length === 0 ? (
        <div className="text-center py-6 text-gray-400">
          <CalendarDays size={28} className="mx-auto mb-1.5 opacity-30" />
          <p className="text-xs">이번 주 일정 없음</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {schedules.map((schedule) => (
            <WeekListItem
              key={schedule.id}
              schedule={schedule}
              isConfirmingDelete={deleteConfirm === schedule.id}
              onEdit={onEdit}
              onDelete={onDelete}
              onDeleteConfirmChange={onDeleteConfirmChange}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

type WeekListItemProps = {
  schedule: Schedule;
  isConfirmingDelete: boolean;
  onEdit: (schedule: Schedule) => void;
  onDelete: (id: string) => void;
  onDeleteConfirmChange: (id: string | null) => void;
};

function WeekListItem({
  schedule,
  isConfirmingDelete,
  onEdit,
  onDelete,
  onDeleteConfirmChange,
}: WeekListItemProps) {
  return (
    <li className="border border-gray-100 rounded-lg p-2.5 hover:border-gray-200 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={clsx('w-2 h-2 rounded-full shrink-0', CATEGORY_COLORS[schedule.category])} />
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-800 truncate">{schedule.title}</p>
            <p className="text-xs text-gray-400">
              {format(new Date(schedule.startDate), 'M/d (E) HH:mm', { locale: ko })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onEdit(schedule)}
            className="p-1 hover:bg-gray-100 rounded text-gray-400"
          >
            <Edit3 size={12} />
          </button>
          {isConfirmingDelete ? (
            <button
              onClick={() => onDelete(schedule.id)}
              className="p-1 bg-red-100 rounded text-red-500"
            >
              <Check size={12} />
            </button>
          ) : (
            <button
              onClick={() => onDeleteConfirmChange(schedule.id)}
              className="p-1 hover:bg-gray-100 rounded text-gray-400"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </div>
      {schedule.location && (
        <p className="text-xs text-gray-500 flex items-center gap-1 mt-1 pl-4">
          <MapPin size={10} /> {schedule.location}
        </p>
      )}
    </li>
  );
}

type SelectedDateListProps = {
  selectedDate: Date;
  schedules: Schedule[];
  onAdd: (date: Date) => void;
};

function SelectedDateList({
  selectedDate,
  schedules,
  onAdd,
}: SelectedDateListProps) {
  return (
    <div className="border-t border-gray-100 pt-4">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold text-gray-700">
          {format(selectedDate, 'M월 d일 (E)', { locale: ko })}
        </h4>
        <button
          onClick={() => onAdd(selectedDate)}
          className="p-1 hover:bg-gray-100 rounded text-gray-400"
        >
          <Plus size={14} />
        </button>
      </div>
      {schedules.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-3">일정 없음</p>
      ) : (
        <ul className="space-y-1.5">
          {schedules.map((schedule) => (
            <li key={schedule.id} className="flex items-center gap-2 text-sm">
              <div className={clsx('w-1.5 h-1.5 rounded-full shrink-0', CATEGORY_COLORS[schedule.category])} />
              <span className="truncate text-gray-700 flex-1">{schedule.title}</span>
              <span className="text-xs text-gray-400 shrink-0">
                {schedule.allDay ? '종일' : format(new Date(schedule.startDate), 'HH:mm')}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
