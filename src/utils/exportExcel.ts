import * as XLSX from 'xlsx';
import { Schedule, WeeklyReport, Document } from '../types';
import { format } from 'date-fns';

// ── 일정 엑셀 내보내기 ──────────────────────────────────────────
export function exportSchedulesToExcel(schedules: Schedule[], fileName = '일정목록') {
  const rows = schedules.map(s => ({
    제목: s.title,
    카테고리: s.category,
    우선순위: s.priority === 'high' ? '높음' : s.priority === 'medium' ? '보통' : '낮음',
    시작일시: format(new Date(s.startDate), 'yyyy-MM-dd HH:mm'),
    종료일시: format(new Date(s.endDate), 'yyyy-MM-dd HH:mm'),
    종일여부: s.allDay ? '예' : '아니오',
    장소: s.location || '',
    참석자: (s.attendees || []).join(', '),
    설명: s.description,
    등록일: format(new Date(s.createdAt), 'yyyy-MM-dd'),
  }));

  const ws = XLSX.utils.json_to_sheet(rows);

  // 컬럼 너비
  ws['!cols'] = [
    { wch: 30 }, { wch: 8 }, { wch: 8 }, { wch: 18 }, { wch: 18 },
    { wch: 8 }, { wch: 20 }, { wch: 20 }, { wch: 40 }, { wch: 12 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '일정');
  XLSX.writeFile(wb, `${fileName}_${format(new Date(), 'yyyyMMdd')}.xlsx`);
}

// ── 주간 보고서 엑셀 내보내기 ───────────────────────────────────
export function exportReportToExcel(report: WeeklyReport) {
  const wb = XLSX.utils.book_new();

  // 요약 시트
  const summaryData = [
    ['주간 업무 보고서'],
    ['기간', `${report.weekStart} ~ ${report.weekEnd}`],
    ['작성자', report.author],
    ['부서', report.department],
    ['상태', report.status],
    [],
    ['완료 업무'],
    ['내용', '분류', '진행률'],
    ...report.completedTasks.map(t => [t.content, t.category, `${t.progress}%`]),
    [],
    ['진행 중 업무'],
    ['내용', '분류', '진행률'],
    ...report.inProgressTasks.map(t => [t.content, t.category, `${t.progress}%`]),
    [],
    ['다음 주 계획'],
    ['내용'],
    ...report.nextWeekTasks.map(t => [t.content]),
    [],
    ['이슈 / 특이사항'],
    [report.issues || '없음'],
    [],
    ['기타 메모'],
    [report.notes || '없음'],
    ...(report.aiSummary ? [[], ['AI 요약'], [report.aiSummary]] : []),
  ];

  const ws = XLSX.utils.aoa_to_sheet(summaryData);
  ws['!cols'] = [{ wch: 50 }, { wch: 15 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, ws, '주간보고');

  XLSX.writeFile(wb, `주간보고_${report.author}_${report.weekStart}.xlsx`);
}

// ── 문서 목록 엑셀 내보내기 ─────────────────────────────────────
export function exportDocumentsToExcel(documents: Document[]) {
  const rows = documents.map(d => ({
    제목: d.title,
    카테고리: d.category,
    태그: d.tags.join(', '),
    내용: d.content,
    등록일: format(new Date(d.createdAt), 'yyyy-MM-dd'),
    수정일: format(new Date(d.updatedAt), 'yyyy-MM-dd'),
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [{ wch: 40 }, { wch: 10 }, { wch: 20 }, { wch: 60 }, { wch: 12 }, { wch: 12 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '문서목록');
  XLSX.writeFile(wb, `문서목록_${format(new Date(), 'yyyyMMdd')}.xlsx`);
}

// ── 단일 문서 엑셀 내보내기 ─────────────────────────────────────
export function exportDocumentToExcel(doc: Document): void {
  const wb = XLSX.utils.book_new();

  // 문서 정보 시트
  const infoData: (string | number)[][] = [
    ['문서 제목', doc.title],
    ['카테고리', doc.category],
    ['태그', doc.tags.join(', ')],
    ['작성일', format(new Date(doc.createdAt), 'yyyy-MM-dd HH:mm')],
    ['수정일', format(new Date(doc.updatedAt), 'yyyy-MM-dd HH:mm')],
  ];
  const infoWs = XLSX.utils.aoa_to_sheet(infoData);
  infoWs['!cols'] = [{ wch: 12 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(wb, infoWs, '문서 정보');

  // 본문 시트
  const contentRows: string[][] = [['내용'], ...doc.content.split('\n').map((line) => [line])];
  const contentWs = XLSX.utils.aoa_to_sheet(contentRows);
  contentWs['!cols'] = [{ wch: 80 }];
  XLSX.utils.book_append_sheet(wb, contentWs, '본문');

  const safeName = doc.title.replace(/[\\/:*?"<>|]/g, '_').slice(0, 50);
  XLSX.writeFile(wb, `${safeName}_${format(new Date(), 'yyyyMMdd')}.xlsx`);
}
