// 사용자 타입
export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  department: string;
  role: UserRole;
  phone?: string;
  position?: string;
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

// 직급 목록 (일반)
export const POSITIONS = ['사원', '대리', '과장', '차장', '부장', '팀장', '이사', '전무', '대표'] as const;
// 연구소 직급 목록
export const RESEARCH_POSITIONS = ['연구원', '선임연구원', '책임연구원', '수석연구원', '연구소장'] as const;

export function getPositionOptions(department: string): readonly string[] {
  return department === '연구소' ? RESEARCH_POSITIONS : POSITIONS;
}

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
  aiSummary?: string;
  approvalStatus?: '승인' | '반려' | null;
  approvalComment?: string | null;
  approvedBy?: string | null;
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

// 파일 첨부 타입
export interface UploadedFile {
  id: string;
  originalName: string;
  storedName: string;
  mimeType: string;
  size: number;
  relatedId: string | null;
  relatedType: 'document' | 'schedule' | 'report' | null;
  createdBy: string;
  createdAt: string;
}

// AI 자동 문서화 결과
export interface AutoDocResult {
  document: { id: string; title: string; content: string; category: string; tags: string[]; createdAt: string };
  file: UploadedFile;
  extractedLength: number;
}

// ────────────────────────────────────────────────────────────
// 전자결재 타입
// ────────────────────────────────────────────────────────────
export type ApprovalType = '품의서' | '지출결의서' | '휴가신청' | '출장신청' | '구매요청' | '기타';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
export type ApprovalStepStatus = 'pending' | 'approved' | 'rejected';

export const APPROVAL_TYPES: ApprovalType[] = ['품의서', '지출결의서', '휴가신청', '출장신청', '구매요청', '기타'];

export const ApprovalStatusLabel: Record<ApprovalStatus, string> = {
  pending: '결재 중',
  approved: '승인',
  rejected: '반려',
  cancelled: '취소',
};

export const ApprovalTypeColors: Record<ApprovalType, string> = {
  '품의서': 'blue',
  '지출결의서': 'orange',
  '휴가신청': 'green',
  '출장신청': 'purple',
  '구매요청': 'rose',
  '기타': 'gray',
};

export interface ApprovalStep {
  id: string;
  approval_id: string;
  step_order: number;
  approver_id: string;
  approver_name: string;
  status: ApprovalStepStatus;
  comment: string;
  acted_at: string | null;
}

export interface Approval {
  id: string;
  title: string;
  type: ApprovalType;
  content: string;
  amount: number;
  author_id: string;
  author_name: string;
  author_dept: string;
  status: ApprovalStatus;
  created_at: string;
  updated_at: string;
  steps: ApprovalStep[];
}
