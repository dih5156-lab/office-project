import { useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import {
  format,
  isSameDay,
  isSameMonth,
  isToday,
} from 'date-fns';
import { ko } from 'date-fns/locale';
import clsx from 'clsx';
import { Schedule } from '../../types';
import { CATEGORY_COLORS } from '../../features/schedule/constants';
import {
  getCalendarWeeks,
  getNextMonth,
  getPreviousMonth,
  getWeekBars,
  isScheduleOnDate,
} from '../../features/schedule/calendar';

const MAX_LANES = 3;
const DATE_AREA_H = 34;  // px: 날짜 숫자 영역 (pt-1=4 + h-7=28 + gap=2)
const LANE_H = 22;       // px: 바 1개 높이 + gap
const WEEK_ROW_H = DATE_AREA_H + MAX_LANES * LANE_H + 32; // = 132px

type Props = {
  currentMonth: Date;
  selectedDate: Date;
  schedules: Schedule[];
  onMonthChange: (month: Date) => void;
  onSelectedDateChange: (date: Date) => void;
  onEdit: (schedule: Schedule) => void;
};

export function ScheduleMonthCalendar({
  currentMonth,
  selectedDate,
  schedules,
  onMonthChange,
  onSelectedDateChange,
  onEdit,
}: Props) {
  return (
    <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <CalendarHeader
        currentMonth={currentMonth}
        onMonthChange={onMonthChange}
        onSelectedDateChange={onSelectedDateChange}
      />
      <WeekdayHeader />
      <div className="rounded-lg border border-gray-100">
        {getCalendarWeeks(currentMonth).map((weekDays) => (
          <CalendarWeek
            key={weekDays[0].toISOString()}
            currentMonth={currentMonth}
            selectedDate={selectedDate}
            schedules={schedules}
            weekDays={weekDays}
            onSelectedDateChange={onSelectedDateChange}
            onEdit={onEdit}
          />
        ))}
      </div>
    </div>
  );
}

type HeaderProps = {
  currentMonth: Date;
  onMonthChange: (month: Date) => void;
  onSelectedDateChange: (date: Date) => void;
};

function CalendarHeader({
  currentMonth,
  onMonthChange,
  onSelectedDateChange,
}: HeaderProps) {
  function moveToday() {
    const today = new Date();
    onMonthChange(today);
    onSelectedDateChange(today);
  }

  return (
    <div className="flex items-center justify-between mb-4">
      <button
        onClick={() => onMonthChange(getPreviousMonth(currentMonth))}
        className="p-1.5 hover:bg-gray-100 rounded-lg"
      >
        <ChevronLeft size={14} />
      </button>
      <div className="flex items-center gap-2">
        <h3 className="font-semibold text-gray-800">
          {format(currentMonth, 'yyyy년 M월', { locale: ko })}
        </h3>
        <button
          onClick={moveToday}
          className="px-2 py-0.5 text-xs bg-blue-100 text-blue-600 rounded-full font-medium hover:bg-blue-200 transition-colors"
        >
          오늘
        </button>
      </div>
      <button
        onClick={() => onMonthChange(getNextMonth(currentMonth))}
        className="p-1.5 hover:bg-gray-100 rounded-lg"
      >
        <ChevronRight size={14} />
      </button>
    </div>
  );
}

function WeekdayHeader() {
  return (
    <div className="grid grid-cols-7 mb-2">
      {['일', '월', '화', '수', '목', '금', '토'].map((day, index) => (
        <div
          key={day}
          className={clsx(
            'text-center text-xs font-medium py-1',
            index === 0 ? 'text-red-500' : index === 6 ? 'text-blue-500' : 'text-gray-500'
          )}
        >
          {day}
        </div>
      ))}
    </div>
  );
}

type WeekProps = {
  currentMonth: Date;
  selectedDate: Date;
  schedules: Schedule[];
  weekDays: Date[];
  onSelectedDateChange: (date: Date) => void;
  onEdit: (schedule: Schedule) => void;
};

function CalendarWeek({
  currentMonth,
  selectedDate,
  schedules,
  weekDays,
  onSelectedDateChange,
  onEdit,
}: WeekProps) {
  const [expandedDay, setExpandedDay] = useState<Date | null>(null);
  const [tooltip, setTooltip] = useState<{
    id: string; x: number; y: number;
    title: string; description: string;
    location?: string; attendees?: string[];
  } | null>(null);

  // 종일 일정만 bar 형태로 렌더링
  const allDayBars = getWeekBars(schedules.filter((s) => s.allDay), weekDays);
  const visibleAllDayBars = allDayBars.filter((bar) => bar.lane < MAX_LANES);

  // 날짜별: 시간 지정 일정 배치 + 숨김 수 계산
  const perDayData = weekDays.map((day, idx) => {
    const col = idx + 1;
    // 이 컬럼에서 종일 bar가 점유한 lane 집합
    const occupiedLanes = new Set(
      visibleAllDayBars
        .filter((b) => col >= b.colStart && col < b.colStart + b.span)
        .map((b) => b.lane)
    );
    const availableSlots = Array.from({ length: MAX_LANES }, (_, i) => i).filter(
      (l) => !occupiedLanes.has(l)
    );
    const timedForDay = schedules
      .filter((s) => !s.allDay && isScheduleOnDate(s, day))
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
    const visibleTimed = timedForDay
      .slice(0, availableSlots.length)
      .map((s, i) => ({ schedule: s, lane: availableSlots[i] }));
    const hiddenAllDay = allDayBars.filter(
      (b) => b.lane >= MAX_LANES && col >= b.colStart && col < b.colStart + b.span
    ).length;
    const hiddenTimed = Math.max(0, timedForDay.length - availableSlots.length);
    return { visibleTimed, hiddenCount: hiddenAllDay + hiddenTimed };
  });

  const expandedColIdx = expandedDay
    ? weekDays.findIndex((d) => isSameDay(d, expandedDay))
    : -1;

  return (
    <div
      className="relative grid grid-cols-7 border-b border-gray-100 last:border-b-0"
      style={{ minHeight: WEEK_ROW_H }}
    >
      {weekDays.map((day, idx) => (
        <CalendarDay
          key={day.toISOString()}
          day={day}
          currentMonth={currentMonth}
          selectedDate={selectedDate}
          hiddenCount={perDayData[idx].hiddenCount}
          weekRowH={WEEK_ROW_H}
          onSelectedDateChange={onSelectedDateChange}
          onShowMore={() =>
            setExpandedDay((prev) =>
              prev && isSameDay(prev, day) ? null : day
            )
          }
        />
      ))}

      {/* 종일 일정: pill bar 형태, 여러 날짜에 걸침 */}
      {visibleAllDayBars.map(({ schedule, colStart, span, lane }) => (
        <button
          key={`bar-${schedule.id}-${weekDays[0].toISOString()}`}
          onClick={(event) => {
            event.stopPropagation();
            onSelectedDateChange(new Date(schedule.startDate));
            onEdit(schedule);
          }}
          style={{
            position: 'absolute',
            top: DATE_AREA_H + lane * LANE_H,
            left: `calc(${((colStart - 1) / 7) * 100}% + 2px)`,
            width: `calc(${(span / 7) * 100}% - 4px)`,
          }}
          className={clsx(
            'h-[18px] rounded-full px-2 text-left text-[10px] font-medium text-white z-10',
            'truncate hover:brightness-95 focus:outline-none',
            CATEGORY_COLORS[schedule.category]
          )}
          onMouseEnter={(e) => {
            if (schedule.description || schedule.location || schedule.attendees?.length) {
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
              setTooltip({ id: String(schedule.id), x: rect.left, y: rect.top, title: schedule.title, description: schedule.description, location: schedule.location, attendees: schedule.attendees });
            }
          }}
          onMouseLeave={() => setTooltip(null)}
        >
          {schedule.title}
        </button>
      ))}

      {/* 시간 지정 일정: 점 + 시간 + 장소 + 제목 형태 */}
      {weekDays.map((day, idx) =>
        perDayData[idx].visibleTimed.map(({ schedule, lane }) => {
          const startDate = new Date(schedule.startDate);
          const mins = startDate.getMinutes();
          const timeStr =
            mins === 0
              ? format(startDate, 'a h시', { locale: ko })
              : format(startDate, 'a h:mm', { locale: ko });
          const label = [timeStr, schedule.location, schedule.title]
            .filter(Boolean)
            .join(' ');
          return (
            <button
              key={`dot-${schedule.id}-${day.toISOString()}`}
              onClick={(event) => {
                event.stopPropagation();
                onSelectedDateChange(new Date(schedule.startDate));
                onEdit(schedule);
              }}
              style={{
                position: 'absolute',
                top: DATE_AREA_H + lane * LANE_H,
                left: `calc(${(idx / 7) * 100}% + 2px)`,
                width: `calc(${(1 / 7) * 100}% - 4px)`,
              }}
              className="h-[18px] flex items-center gap-1 px-1 z-10 hover:bg-gray-100 rounded-full focus:outline-none"
              onMouseEnter={(e) => {
                if (schedule.description || schedule.location || schedule.attendees?.length) {
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  setTooltip({ id: String(schedule.id), x: rect.left, y: rect.top, title: schedule.title, description: schedule.description, location: schedule.location, attendees: schedule.attendees });
                }
              }}
              onMouseLeave={() => setTooltip(null)}
            >
              <span
                className={clsx(
                  'w-1.5 h-1.5 rounded-full shrink-0',
                  CATEGORY_COLORS[schedule.category]
                )}
              />
              <span className="truncate text-[10px] text-gray-700 font-medium leading-none">
                {label}
              </span>
            </button>
          );
        })
      )}

      {/* 날짜별 전체보기 팝업 */}
      {expandedDay && expandedColIdx !== -1 && (
        <DayPopup
          day={expandedDay}
          schedules={schedules}
          colIdx={expandedColIdx}
          onClose={() => setExpandedDay(null)}
          onEdit={onEdit}
          onSelectedDateChange={onSelectedDateChange}
        />
      )}

      {/* 일정 hover 툴팁 */}
      {tooltip && (
        <div
          className="fixed z-[9999] bg-gray-900 text-white text-xs rounded-xl p-3 max-w-xs shadow-2xl pointer-events-none"
          style={{ left: tooltip.x, top: tooltip.y - 8, transform: 'translateY(-100%)' }}
        >
          <p className="font-semibold text-white mb-1 leading-snug">{tooltip.title}</p>
          {tooltip.description && (
            <p className="text-gray-300 whitespace-pre-wrap leading-relaxed">{tooltip.description}</p>
          )}
          {tooltip.location && (
            <p className="text-gray-400 mt-1.5 text-[11px]">📍 {tooltip.location}</p>
          )}
          {tooltip.attendees && tooltip.attendees.length > 0 && (
            <p className="text-gray-400 mt-1 text-[11px]">👥 {tooltip.attendees.join(', ')}</p>
          )}
        </div>
      )}
    </div>
  );
}

type DayProps = {
  day: Date;
  currentMonth: Date;
  selectedDate: Date;
  hiddenCount: number;
  weekRowH: number;
  onSelectedDateChange: (date: Date) => void;
  onShowMore: () => void;
};

function CalendarDay({
  day,
  currentMonth,
  selectedDate,
  hiddenCount,
  weekRowH,
  onSelectedDateChange,
  onShowMore,
}: DayProps) {
  const dayOfWeek = day.getDay();
  const isCurrentMonth = isSameMonth(day, currentMonth);

  return (
    <div
      onClick={() => onSelectedDateChange(day)}
      style={{ minHeight: weekRowH }}
      className={clsx(
        'border-r border-gray-100 last:border-r-0 flex flex-col items-center pt-1 pb-1 transition-colors cursor-pointer',
        isSameDay(day, selectedDate) ? 'bg-blue-50/70' : 'hover:bg-gray-50',
        !isCurrentMonth && 'bg-gray-50/70'
      )}
    >
      <span
        className={clsx(
          'font-inter text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full shrink-0',
          isToday(day)
            ? 'bg-blue-600 text-white'
            : dayOfWeek === 0
            ? isCurrentMonth ? 'text-red-500' : 'text-red-300'
            : dayOfWeek === 6
            ? isCurrentMonth ? 'text-blue-500' : 'text-blue-300'
            : isCurrentMonth ? 'text-gray-700' : 'text-gray-300'
        )}
      >
        {format(day, 'd')}
      </span>
      {/* 바 영역 공간 확보 (3레인 × 20px = 60px) */}
      <div className="flex-1" />
      {hiddenCount > 0 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onShowMore();
          }}
          className="w-full text-right pr-1.5 text-[10px] text-gray-400 hover:text-blue-500 hover:bg-blue-50 py-0.5 rounded transition-colors"
        >
          +{hiddenCount}개 더보기
        </button>
      )}
    </div>
  );
}

type DayPopupProps = {
  day: Date;
  schedules: Schedule[];
  colIdx: number;
  onClose: () => void;
  onEdit: (schedule: Schedule) => void;
  onSelectedDateChange: (date: Date) => void;
};

function DayPopup({
  day,
  schedules,
  colIdx,
  onClose,
  onEdit,
  onSelectedDateChange,
}: DayPopupProps) {
  const daySchedules = schedules.filter((s) => isScheduleOnDate(s, day));
  const isRightAligned = colIdx >= 4;

  return (
    <>
      {/* 배경 클릭 닫기 */}
      <div
        className="fixed inset-0 z-40"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      />
      {/* 팝업 */}
      <div
        className="absolute top-0 z-50 w-52 bg-white rounded-xl shadow-xl border border-gray-200 p-3"
        style={
          isRightAligned
            ? { right: `${((7 - colIdx - 1) / 7) * 100}%` }
            : { left: `${(colIdx / 7) * 100}%` }
        }
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-gray-800">
            {format(day, 'M월 d일 (EEE)', { locale: ko })}
          </span>
          <button
            onClick={onClose}
            className="p-0.5 hover:bg-gray-100 rounded-md transition-colors"
          >
            <X size={14} className="text-gray-500" />
          </button>
        </div>
        <div className="space-y-1 max-h-56 overflow-y-auto">
          {daySchedules.map((schedule) => (
            <button
              key={schedule.id}
              onClick={() => {
                onSelectedDateChange(new Date(schedule.startDate));
                onEdit(schedule);
                onClose();
              }}
              className={clsx(
                'w-full text-left px-2 py-1 rounded-md text-[11px] font-medium text-white truncate',
                'hover:brightness-95 focus:outline-none',
                CATEGORY_COLORS[schedule.category]
              )}
              title={schedule.title}
            >
              {schedule.title}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
