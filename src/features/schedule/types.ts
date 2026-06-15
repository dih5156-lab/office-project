import { Schedule, ScheduleCategory } from '../../types';

export type ScheduleViewMode = 'calendar' | 'list';

export type RepeatType = 'none' | 'daily' | 'weekly' | 'monthly';

export type ScheduleForm = {
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  allDay: boolean;
  category: ScheduleCategory;
  location: string;
  attendees: string[];
  repeatType: RepeatType;
  repeatCount: number;
};

export type CalendarBar = {
  schedule: Schedule;
  colStart: number;
  span: number;
  lane: number;
};
