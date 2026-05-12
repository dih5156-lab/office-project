import { format } from 'date-fns';
import { ScheduleCategory } from '../../types';
import { ScheduleForm } from './types';

export const CATEGORY_COLORS: Record<ScheduleCategory, string> = {
  회의: 'bg-blue-500',
  업무: 'bg-green-500',
  교육: 'bg-purple-500',
  출장: 'bg-orange-500',
  개인: 'bg-pink-500',
  기타: 'bg-gray-500',
};

export const CATEGORY_BADGE_COLORS: Record<ScheduleCategory, string> = {
  회의: 'bg-blue-100 text-blue-700',
  업무: 'bg-green-100 text-green-700',
  교육: 'bg-purple-100 text-purple-700',
  출장: 'bg-orange-100 text-orange-700',
  개인: 'bg-pink-100 text-pink-700',
  기타: 'bg-gray-100 text-gray-700',
};

export const ALL_CATEGORIES: ScheduleCategory[] = [
  '회의',
  '업무',
  '교육',
  '출장',
  '개인',
  '기타',
];

export function createEmptyScheduleForm(): ScheduleForm {
  const now = format(new Date(), "yyyy-MM-dd'T'HH:mm");

  return {
    title: '',
    description: '',
    startDate: now,
    endDate: now,
    allDay: false,
    category: '업무',
    location: '',
    attendees: [],
  };
}
