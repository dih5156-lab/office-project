import { CalendarDays, Check, Clock, Edit3, MapPin, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import clsx from 'clsx';
import { Schedule } from '../../types';
import {
  CATEGORY_BADGE_COLORS,
  CATEGORY_COLORS,
} from '../../features/schedule/constants';
import { sortSchedulesByStart } from '../../features/schedule/calendar';

type Props = {
  schedules: Schedule[];
  deleteConfirm: string | null;
  onAdd: () => void;
  onEdit: (schedule: Schedule) => void;
  onDelete: (id: string) => void;
  onDeleteConfirmChange: (id: string | null) => void;
};

export function ScheduleListView({
  schedules,
  deleteConfirm,
  onAdd,
  onEdit,
  onDelete,
  onDeleteConfirmChange,
}: Props) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      {schedules.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <CalendarDays size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">일정이 없습니다</p>
          <button onClick={onAdd} className="mt-2 text-xs text-blue-500 hover:underline">
            일정 추가하기
          </button>
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          {[...schedules].sort(sortSchedulesByStart).map((schedule) => (
            <ScheduleListItem
              key={schedule.id}
              schedule={schedule}
              isConfirmingDelete={deleteConfirm === schedule.id}
              onEdit={onEdit}
              onDelete={onDelete}
              onDeleteConfirmChange={onDeleteConfirmChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}

type ItemProps = {
  schedule: Schedule;
  isConfirmingDelete: boolean;
  onEdit: (schedule: Schedule) => void;
  onDelete: (id: string) => void;
  onDeleteConfirmChange: (id: string | null) => void;
};

function ScheduleListItem({
  schedule,
  isConfirmingDelete,
  onEdit,
  onDelete,
  onDeleteConfirmChange,
}: ItemProps) {
  return (
    <div className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors">
      <div className={clsx('w-1 h-10 rounded-full shrink-0', CATEGORY_COLORS[schedule.category])} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-gray-800 truncate">{schedule.title}</p>
          <span
            className={clsx(
              'text-[11px] px-2 py-0.5 rounded-full font-medium shrink-0',
              CATEGORY_BADGE_COLORS[schedule.category]
            )}
          >
            {schedule.category}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
          <span className="text-xs text-gray-500 flex items-center gap-1">
            <Clock size={10} />
            {schedule.allDay
              ? format(new Date(schedule.startDate), 'M월 d일 (E) 종일', { locale: ko })
              : `${format(new Date(schedule.startDate), 'M월 d일 (E) HH:mm', { locale: ko })} ~ ${format(new Date(schedule.endDate), 'HH:mm')}`}
          </span>
          {schedule.location && (
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <MapPin size={10} /> {schedule.location}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => onEdit(schedule)}
          className="p-1.5 hover:bg-gray-100 rounded text-gray-400"
        >
          <Edit3 size={14} />
        </button>
        {isConfirmingDelete ? (
          <button
            onClick={() => onDelete(schedule.id)}
            className="p-1.5 bg-red-100 rounded text-red-500"
          >
            <Check size={14} />
          </button>
        ) : (
          <button
            onClick={() => onDeleteConfirmChange(schedule.id)}
            className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-red-500"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
