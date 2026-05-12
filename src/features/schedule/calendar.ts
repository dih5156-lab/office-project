import {
  addMonths,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { ko } from 'date-fns/locale';
import { Schedule } from '../../types';
import { CalendarBar, ScheduleForm } from './types';

export function getPreviousMonth(month: Date) {
  return subMonths(month, 1);
}

export function getNextMonth(month: Date) {
  return addMonths(month, 1);
}

export function getCalendarWeeks(month: Date) {
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const calStart = startOfWeek(monthStart, { locale: ko });
  const calEnd = endOfWeek(monthEnd, { locale: ko });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  return Array.from({ length: Math.ceil(days.length / 7) }, (_, index) =>
    days.slice(index * 7, index * 7 + 7)
  );
}

export function isScheduleOnDate(schedule: Schedule, date: Date) {
  const start = startOfDay(new Date(schedule.startDate));
  const end = endOfDay(new Date(schedule.endDate));
  const day = startOfDay(date);

  return day >= start && day <= end;
}

export function isScheduleInRange(schedule: Schedule, start: Date, end: Date) {
  const scheduleStart = startOfDay(new Date(schedule.startDate));
  const scheduleEnd = endOfDay(new Date(schedule.endDate));

  return scheduleStart <= endOfDay(end) && scheduleEnd >= startOfDay(start);
}

export function getWeekBars(schedules: Schedule[], weekDays: Date[]) {
  const weekStart = startOfDay(weekDays[0]);
  const weekEnd = endOfDay(weekDays[6]);
  const laneEnds: number[] = [];

  return schedules
    .filter((schedule) => isScheduleInRange(schedule, weekStart, weekEnd))
    .sort(sortSchedulesByStart)
    .map((schedule): CalendarBar => {
      const start = startOfDay(new Date(schedule.startDate));
      const end = startOfDay(new Date(schedule.endDate));
      const colStart = Math.max(0, differenceInCalendarDays(start, weekStart));
      const colEnd = Math.min(6, differenceInCalendarDays(end, weekStart));
      const lane = laneEnds.findIndex((laneEnd) => laneEnd < colStart);
      const nextLane = lane === -1 ? laneEnds.length : lane;

      laneEnds[nextLane] = colEnd;

      return {
        schedule,
        colStart: colStart + 1,
        span: colEnd - colStart + 1,
        lane: nextLane,
      };
    });
}

export function sortSchedulesByStart(a: Schedule, b: Schedule) {
  const startDiff = new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
  if (startDiff !== 0) return startDiff;

  return new Date(b.endDate).getTime() - new Date(a.endDate).getTime();
}

export function getSchedulePayload(form: ScheduleForm) {
  const startValue = form.allDay
    ? new Date(`${form.startDate.slice(0, 10)}T00:00:00`)
    : new Date(form.startDate);
  const endValue = form.allDay
    ? new Date(`${form.endDate.slice(0, 10)}T23:59:59`)
    : new Date(form.endDate);
  const safeEndValue = endValue < startValue ? startValue : endValue;

  return {
    ...form,
    startDate: startValue.toISOString(),
    endDate: safeEndValue.toISOString(),
    priority: 'medium' as const,
    attendees: form.attendees ?? [],
  };
}

export function getScheduleForm(schedule: Schedule): ScheduleForm {
  return {
    title: schedule.title,
    description: schedule.description,
    startDate: format(new Date(schedule.startDate), "yyyy-MM-dd'T'HH:mm"),
    endDate: format(new Date(schedule.endDate), "yyyy-MM-dd'T'HH:mm"),
    allDay: schedule.allDay,
    category: schedule.category,
    location: schedule.location || '',
    attendees: schedule.attendees ?? [],
  };
}
