import DocumentPage from "@/components/DocumentPage";

const reportTypes = [
  "현황 보고서",
  "성과 보고서",
  "분석 보고서",
  "제안 보고서",
  "결과 보고서",
  "진행 상황 보고서",
  "기타",
];

const fields = [
  {
    name: "title",
    label: "보고서 제목",
    type: "text" as const,
    placeholder: "예) 2024년 1분기 마케팅 현황 보고서",
    required: true,
  },
  {
    name: "reportType",
    label: "보고서 유형",
    type: "select" as const,
    options: reportTypes,
    required: true,
  },
  { name: "date", label: "작성일", type: "date" as const, required: true },
  {
    name: "authorDept",
    label: "작성자 / 부서",
    type: "text" as const,
    placeholder: "예) 홍길동 / 마케팅팀",
    required: true,
  },
  {
    name: "recipient",
    label: "보고 대상",
    type: "text" as const,
    placeholder: "예) 대표이사, 임원진",
    required: true,
  },
  {
    name: "background",
    label: "배경 / 목적",
    type: "textarea" as const,
    placeholder: "보고서 작성 배경과 목적을 설명해주세요.",
    required: true,
    rows: 3,
  },
  {
    name: "mainContent",
    label: "주요 내용",
    type: "textarea" as const,
    placeholder: "보고서의 핵심 내용, 수치, 데이터 등을 입력하세요.",
    required: true,
    rows: 5,
  },
  {
    name: "analysis",
    label: "분석 및 시사점",
    type: "textarea" as const,
    placeholder: "현황 분석 결과와 시사점을 입력하세요.",
    rows: 4,
  },
  {
    name: "conclusion",
    label: "결론 및 건의사항",
    type: "textarea" as const,
    placeholder: "결론과 향후 건의사항을 입력하세요.",
    required: true,
    rows: 3,
  },
  {
    name: "attachments",
    label: "첨부 자료",
    type: "text" as const,
    placeholder: "예) 별첨1. 판매 실적 현황표, 별첨2. 시장 분석 자료",
  },
];

export default function ReportPage() {
  return (
    <DocumentPage
      type="report"
      pageTitle="보고서"
      pageIcon="📊"
      formTitle="보고서 작성"
      formDescription="보고서 정보와 내용을 입력하면 AI가 전문적인 보고서를 작성합니다."
      fields={fields}
    />
  );
}
