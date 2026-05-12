import {
  Document as DocxDoc,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
} from 'docx';
import { Document } from '../types';
import { format } from 'date-fns';

/** markdown-like 텍스트를 docx Paragraph 배열로 변환 */
function parseContent(content: string): Paragraph[] {
  return content.split('\n').map((line) => {
    if (line.startsWith('## ')) {
      return new Paragraph({
        children: [new TextRun({ text: line.slice(3), bold: true, size: 26, color: '1E3A5F' })],
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 280, after: 100 },
        border: {
          bottom: { style: BorderStyle.SINGLE, size: 4, color: 'DDDDDD', space: 2 },
        },
      });
    }
    if (line.startsWith('### ')) {
      return new Paragraph({
        children: [new TextRun({ text: line.slice(4), bold: true, size: 22, color: '2D5A8E' })],
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 200, after: 60 },
      });
    }
    if (/^[•\-\*] /.test(line)) {
      return new Paragraph({
        children: [new TextRun({ text: line.slice(2), size: 21 })],
        bullet: { level: 0 },
        spacing: { after: 40 },
      });
    }
    if (line.trim() === '') {
      return new Paragraph({ children: [new TextRun({ text: '' })], spacing: { after: 80 } });
    }
    // **bold** 처리
    const parts: TextRun[] = [];
    const boldPattern = /\*\*(.+?)\*\*/g;
    let lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = boldPattern.exec(line)) !== null) {
      if (m.index > lastIndex) {
        parts.push(new TextRun({ text: line.slice(lastIndex, m.index), size: 21 }));
      }
      parts.push(new TextRun({ text: m[1], bold: true, size: 21 }));
      lastIndex = m.index + m[0].length;
    }
    if (lastIndex < line.length) {
      parts.push(new TextRun({ text: line.slice(lastIndex), size: 21 }));
    }
    return new Paragraph({
      children: parts.length > 0 ? parts : [new TextRun({ text: line, size: 21 })],
      spacing: { after: 60 },
    });
  });
}

/** 단일 문서를 DOCX로 내보내기 */
export async function exportDocumentToWord(doc: Document): Promise<void> {
  const children: Paragraph[] = [
    // 제목
    new Paragraph({
      children: [new TextRun({ text: doc.title, bold: true, size: 40, color: '1E3A5F' })],
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 120 },
      alignment: AlignmentType.LEFT,
    }),
    // 메타 정보
    new Paragraph({
      children: [
        new TextRun({ text: `카테고리: ${doc.category}`, size: 18, color: '666666' }),
        new TextRun({ text: '   |   ', size: 18, color: 'AAAAAA' }),
        new TextRun({ text: `작성일: ${format(new Date(doc.createdAt), 'yyyy-MM-dd')}`, size: 18, color: '666666' }),
        new TextRun({ text: '   |   ', size: 18, color: 'AAAAAA' }),
        new TextRun({ text: `수정일: ${format(new Date(doc.updatedAt), 'yyyy-MM-dd')}`, size: 18, color: '666666' }),
      ],
      spacing: { after: 240 },
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 6, color: 'E5E7EB', space: 4 },
      },
    }),
    // 본문
    ...parseContent(doc.content),
  ];

  // 태그
  if (doc.tags.length > 0) {
    children.push(
      new Paragraph({ children: [new TextRun({ text: '' })], spacing: { before: 240 } }),
      new Paragraph({
        children: [
          new TextRun({ text: '태그: ', bold: true, size: 18, color: '555555' }),
          new TextRun({ text: doc.tags.map((t) => `#${t}`).join('  '), size: 18, color: '888888' }),
        ],
        border: {
          top: { style: BorderStyle.SINGLE, size: 4, color: 'EEEEEE', space: 3 },
        },
      })
    );
  }

  const docx = new DocxDoc({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
          },
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(docx);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeName = doc.title.replace(/[\\/:*?"<>|]/g, '_').slice(0, 60);
  a.download = `${safeName}_${format(new Date(), 'yyyyMMdd')}.docx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
