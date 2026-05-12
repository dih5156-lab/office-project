import { Schedule, ScheduleCategory } from '../../types';

export type ScheduleViewMode = 'calendar' | 'list';

export type ScheduleForm = {
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  allDay: boolean;
  category: ScheduleCategory;
  location: string;
  attendees: string[];
};

export type CalendarBar = {
  schedule: Schedule;
  colStart: number;
  span: number;
  lane: number;
};
