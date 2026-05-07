// 사용자 타입
export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  department: string;
  role: UserRole;
  createdAt: string;
}

export type UserRole = 'admin' | 'manager' | 'member';

export const RoleLabels: Record<UserRole, string> = {
  admin: '관리자',
  manager: '팀장',
  member: '팀원',
};

// 부서 목록
export const DEPARTMENTS = ['경영지원팀', '고객서비스', '미래전략실', '연구소', '영업부'] as const;
export type Department = typeof DEPARTMENTS[number];

// 일정 타입
export interface Schedule {
  id: string;
  title: string;
  description: string;
  startDate: string; // ISO string
  endDate: string;   // ISO string
  allDay: boolean;
  category: ScheduleCategory;
  priority: Priority;
  location?: string;
  attendees?: string[];
  createdAt: string;
  updatedAt: string;
}

export type ScheduleCategory = '회의' | '업무' | '교육' | '출장' | '개인' | '기타';
export type Priority = 'low' | 'medium' | 'high';

// 주간 업무 보고 타입
export interface WeeklyReport {
  id: string;
  weekStart: string; // ISO string (월요일)
  weekEnd: string;   // ISO string (일요일)
  author: string;
  department: string;
  completedTasks: TaskItem[];
  inProgressTasks: TaskItem[];
  nextWeekTasks: TaskItem[];
  issues: string;
  notes: string;
  status: ReportStatus;
  aiSummary?: string; // AI 요약 결과 (저장됨)
  createdAt: string;
  updatedAt: string;
}

export interface TaskItem {
  id: string;
  content: string;
  progress: number; // 0-100
  category: string;
}

export type ReportStatus = '작성중' | '완료' | '제출됨';

// AI 요약 타입
export interface AISummaryItem {
  id: string;
  title: string;
  originalText: string;
  summaryText: string;
  keywords: string[];
  actionItems: string[];
  createdAt: string;
  type: SummaryType;
}

export type SummaryType = '회의록' | '보고서' | '이메일' | '문서' | '기타';

// 문서 타입
export interface Document {
  id: string;
  title: string;
  content: string;
  category: DocumentCategory;
  tags: string[];
  fileName?: string;
  fileSize?: number;
  createdAt: string;
  updatedAt: string;
}

export type DocumentCategory = '계획서' | '보고서' | '회의록' | '제안서' | '매뉴얼' | '기타';

// 알림 타입
export interface Notification {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  createdAt: string;
  read: boolean;
}
