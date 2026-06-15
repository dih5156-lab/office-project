import { Schedule, WeeklyReport, Document } from '../types';
import { format } from 'date-fns';

type CsvValue = string | number;

function escapeCsv(value: CsvValue) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function downloadCsv(rows: CsvValue[][], fileName: string) {
  const csv = rows.map((row) => row.map(escapeCsv).join(',')).join('\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function rowsFromObjects(rows: Record<string, CsvValue>[]) {
  const headers = Object.keys(rows[0] ?? {});
  return [headers, ...rows.map((row) => headers.map((header) => row[header]))];
}

// 일정 데이터를 엑셀에서 열 수 있는 CSV 파일로 내보낸다.
export function exportSchedulesToExcel(schedules: Schedule[], fileName = '일정목록') {
  const rows = schedules.map((schedule) => ({
    제목: schedule.title,
    카테고리: schedule.category,
    우선순위: schedule.priority === 'high' ? '높음' : schedule.priority === 'medium' ? '보통' : '낮음',
    시작일시: format(new Date(schedule.startDate), 'yyyy-MM-dd HH:mm'),
    종료일시: format(new Date(schedule.endDate), 'yyyy-MM-dd HH:mm'),
    종일여부: schedule.allDay ? '예' : '아니오',
    장소: schedule.location || '',
    참석자: (schedule.attendees || []).join(', '),
    설명: schedule.description,
    등록일: format(new Date(schedule.createdAt), 'yyyy-MM-dd'),
  }));

  downloadCsv(rowsFromObjects(rows), `${fileName}_${format(new Date(), 'yyyyMMdd')}.csv`);
}

// 주간 보고서를 엑셀에서 열 수 있는 CSV 파일로 내보낸다.
export function exportReportToExcel(report: WeeklyReport) {
  const rows: CsvValue[][] = [
    ['주간 업무 보고서'],
    ['기간', `${report.weekStart} ~ ${report.weekEnd}`],
    ['작성자', report.author],
    ['부서', report.department],
    ['상태', report.status],
    [],
    ['완료 업무'],
    ['내용', '분류', '진행률'],
    ...report.completedTasks.map((task) => [task.content, task.category, `${task.progress}%`]),
    [],
    ['진행 중 업무'],
    ['내용', '분류', '진행률'],
    ...report.inProgressTasks.map((task) => [task.content, task.category, `${task.progress}%`]),
    [],
    ['다음 주 계획'],
    ['내용'],
    ...report.nextWeekTasks.map((task) => [task.content]),
    [],
    ['이슈 / 특이사항'],
    [report.issues || '없음'],
    [],
    ['기타 메모'],
    [report.notes || '없음'],
    ...(report.aiSummary ? [[], ['AI 요약'], [report.aiSummary]] : []),
  ];

  downloadCsv(rows, `주간보고_${report.author}_${report.weekStart}.csv`);
}

// 문서 목록을 엑셀에서 열 수 있는 CSV 파일로 내보낸다.
export function exportDocumentsToExcel(documents: Document[]) {
  const rows = documents.map((document) => ({
    제목: document.title,
    카테고리: document.category,
    태그: document.tags.join(', '),
    내용: document.content,
    등록일: format(new Date(document.createdAt), 'yyyy-MM-dd'),
    수정일: format(new Date(document.updatedAt), 'yyyy-MM-dd'),
  }));

  downloadCsv(rowsFromObjects(rows), `문서목록_${format(new Date(), 'yyyyMMdd')}.csv`);
}

// 단일 문서를 엑셀에서 열 수 있는 CSV 파일로 내보낸다.
export function exportDocumentToExcel(document: Document): void {
  const rows: CsvValue[][] = [
    ['문서 제목', document.title],
    ['카테고리', document.category],
    ['태그', document.tags.join(', ')],
    ['작성일', format(new Date(document.createdAt), 'yyyy-MM-dd HH:mm')],
    ['수정일', format(new Date(document.updatedAt), 'yyyy-MM-dd HH:mm')],
    [],
    ['내용'],
    ...document.content.split('\n').map((line) => [line]),
  ];
  const safeName = document.title.replace(/[\\/:*?"<>|]/g, '_').slice(0, 50);

  downloadCsv(rows, `${safeName}_${format(new Date(), 'yyyyMMdd')}.csv`);
}
