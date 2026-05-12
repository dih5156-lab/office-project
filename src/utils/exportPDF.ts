import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Schedule, WeeklyReport, Document } from '../types';
import { format } from 'date-fns';

// jsPDF에 한글 지원을 위해 기본 폰트 사용 (영문/숫자는 정상, 한글은 유니코드 처리)
// 완전한 한글 지원이 필요하면 NanumGothic 폰트를 base64로 embed 필요

function addKoreanHeader(doc: jsPDF, title: string) {
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 14, 20);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(150);
  doc.text(`Generated: ${format(new Date(), 'yyyy-MM-dd HH:mm')}`, 14, 28);
  doc.setTextColor(0);
  doc.setLineWidth(0.3);
  doc.line(14, 31, 196, 31);
}

// ── 일정 PDF ────────────────────────────────────────────────────
export function exportSchedulesToPDF(schedules: Schedule[], title = 'Schedule List') {
  const doc = new jsPDF();
  addKoreanHeader(doc, title);

  const rows = schedules.map(s => [
    s.title,
    s.category,
    s.priority === 'high' ? 'High' : s.priority === 'medium' ? 'Mid' : 'Low',
    format(new Date(s.startDate), 'MM/dd HH:mm'),
    format(new Date(s.endDate), 'MM/dd HH:mm'),
    s.location || '-',
  ]);

  autoTable(doc, {
    startY: 35,
    head: [['Title', 'Category', 'Priority', 'Start', 'End', 'Location']],
    body: rows,
    headStyles: { fillColor: [37, 99, 235], fontSize: 9, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 55 },
      1: { cellWidth: 22 },
      2: { cellWidth: 18 },
      3: { cellWidth: 28 },
      4: { cellWidth: 28 },
      5: { cellWidth: 35 },
    },
  });

  doc.save(`schedules_${format(new Date(), 'yyyyMMdd')}.pdf`);
}

// ── 주간 보고서 PDF ──────────────────────────────────────────────
export function exportReportToPDF(report: WeeklyReport) {
  const doc = new jsPDF();
  addKoreanHeader(doc, 'Weekly Work Report');

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(`Period: ${report.weekStart} ~ ${report.weekEnd}`, 14, 40);
  doc.text(`Author: ${report.author}  |  Dept: ${report.department}  |  Status: ${report.status}`, 14, 47);

  let y = 55;

  function addSection(label: string, rows: string[][], cols: string[]) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setFillColor(239, 246, 255);
    doc.rect(14, y, 182, 7, 'F');
    doc.text(label, 16, y + 5);
    y += 7;

    if (rows.length === 0) {
      autoTable(doc, {
        startY: y,
        body: [['No items']],
        bodyStyles: { fontSize: 8, textColor: [150, 150, 150] },
        margin: { left: 14, right: 14 },
        theme: 'plain',
      });
    } else {
      autoTable(doc, {
        startY: y,
        head: [cols],
        body: rows,
        headStyles: { fillColor: [59, 130, 246], fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        margin: { left: 14, right: 14 },
      });
    }
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  addSection('Completed Tasks', report.completedTasks.map(t => [t.content, t.category, `${t.progress}%`]), ['Content', 'Category', 'Progress']);
  addSection('In Progress Tasks', report.inProgressTasks.map(t => [t.content, t.category, `${t.progress}%`]), ['Content', 'Category', 'Progress']);
  addSection('Next Week Plan', report.nextWeekTasks.map(t => [t.content]), ['Content']);

  // 이슈/메모
  if (y > 250) { doc.addPage(); y = 20; }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Issues / Notes', 14, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const issueLines = doc.splitTextToSize(report.issues || 'None', 180);
  doc.text(issueLines, 14, y);
  y += issueLines.length * 5 + 4;
  const noteLines = doc.splitTextToSize(report.notes || 'None', 180);
  doc.text(noteLines, 14, y);
  y += noteLines.length * 5 + 6;

  // AI 요약
  if (report.aiSummary) {
    if (y > 240) { doc.addPage(); y = 20; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setFillColor(255, 237, 213); // 오렌지 배경
    doc.rect(14, y, 182, 7, 'F');
    doc.text('AI Summary', 16, y + 5);
    y += 10;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const aiLines = doc.splitTextToSize(report.aiSummary, 180);
    doc.text(aiLines, 14, y);
  }

  doc.save(`weekly_report_${report.author}_${report.weekStart}.pdf`);
}

// ── 문서 목록 PDF ───────────────────────────────────────────────
export function exportDocumentsToPDF(documents: Document[]) {
  const doc = new jsPDF();
  addKoreanHeader(doc, 'Document List');

  const rows = documents.map(d => [
    d.title,
    d.category,
    d.tags.join(', '),
    format(new Date(d.updatedAt), 'yyyy-MM-dd'),
  ]);

  autoTable(doc, {
    startY: 35,
    head: [['Title', 'Category', 'Tags', 'Updated']],
    body: rows,
    headStyles: { fillColor: [37, 99, 235], fontSize: 9, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 80 },
      1: { cellWidth: 28 },
      2: { cellWidth: 55 },
      3: { cellWidth: 27 },
    },
  });

  doc.save(`documents_${format(new Date(), 'yyyyMMdd')}.pdf`);
}

// ── 단일 문서 PDF (브라우저 인쇄 — 한글 완벽 지원) ──────────────
export function exportDocumentToPDF(document: Document): void {
  const lines = document.content.split('\n');
  const bodyHtml = lines
    .map((line) => {
      if (line.startsWith('## ')) {
        return `<h2>${line.slice(3)}</h2>`;
      }
      if (line.startsWith('### ')) {
        return `<h3>${line.slice(4)}</h3>`;
      }
      if (/^[•\-\*] /.test(line)) {
        const text = line.slice(2).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        return `<p class="bullet">• ${text}</p>`;
      }
      if (line.trim() === '') return '<div class="spacer"></div>';
      const text = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      return `<p>${text}</p>`;
    })
    .join('');

  const tagsHtml =
    document.tags.length > 0
      ? `<div class="tags">태그: ${document.tags.map((t) => `<span class="tag">#${t}</span>`).join(' ')}</div>`
      : '';

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>${document.title}</title>
<style>
  @page { margin: 20mm; }
  * { box-sizing: border-box; }
  body {
    font-family: 'Malgun Gothic','Apple SD Gothic Neo','Noto Sans KR',Helvetica,sans-serif;
    font-size: 10.5pt; line-height: 1.75; color: #1a1a2e;
  }
  h1 { font-size: 18pt; color: #1e3a5f; margin: 0 0 3mm; }
  h2 { font-size: 13pt; color: #1e3a5f; margin: 6mm 0 2mm;
       border-bottom: 1px solid #ddd; padding-bottom: 1mm; }
  h3 { font-size: 11pt; color: #2d5a8e; margin: 4mm 0 1.5mm; }
  p { margin: 1.5mm 0; }
  p.bullet { margin-left: 4mm; }
  .spacer { height: 3mm; }
  .meta { font-size: 9pt; color: #888; margin-bottom: 6mm;
          padding-bottom: 3mm; border-bottom: 1.5px solid #e5e7eb; }
  .badge { display:inline-block; padding:0.5mm 3mm; border-radius:4px;
           font-size:8pt; font-weight:700; background:#dbeafe; color:#1e40af; }
  .tags { margin-top:8mm; padding-top:3mm; border-top:1px solid #eee; font-size:9pt; color:#888; }
  .tag { margin-right: 2mm; }
  strong { color: #1a1a2e; }
</style>
</head>
<body>
  <h1>${document.title}</h1>
  <div class="meta">
    <span class="badge">${document.category}</span>
    &nbsp;&nbsp;작성일: ${format(new Date(document.createdAt), 'yyyy-MM-dd')}
    &nbsp;&nbsp;수정일: ${format(new Date(document.updatedAt), 'yyyy-MM-dd')}
  </div>
  ${bodyHtml}
  ${tagsHtml}
</body>
</html>`;

  const w = window.open('', '_blank', 'width=900,height=750');
  if (w) {
    w.document.write(html);
    w.document.close();
    // 폰트 로드 후 인쇄 다이얼로그 열기
    setTimeout(() => { w.focus(); w.print(); }, 600);
  }
}
