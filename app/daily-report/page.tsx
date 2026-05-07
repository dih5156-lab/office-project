import DocumentPage from "@/components/DocumentPage";

const fields = [
  { name: "date", label: "보고 날짜", type: "date" as const, required: true },
  { name: "author", label: "작성자", type: "text" as const, placeholder: "홍길동", required: true },
  { name: "department", label: "부서", type: "text" as const, placeholder: "개발팀", required: true },
  {
    name: "completed",
    label: "오늘 완료한 업무",
    type: "textarea" as const,
    placeholder: "예) 프로젝트 A 설계 문서 검토 완료\n예) 팀 회의 참석 및 업무 조율",
    required: true,
    rows: 4,
  },
  {
    name: "inProgress",
    label: "진행 중인 업무",
    type: "textarea" as const,
    placeholder: "예) 프로젝트 B API 개발 (60% 완료)",
    rows: 3,
  },
  {
    name: "planned",
    label: "내일 예정 업무",
    type: "textarea" as const,
    placeholder: "예) 프로젝트 B API 개발 완료 및 테스트",
    rows: 3,
  },
  {
    name: "notes",
    label: "특이사항 / 건의사항",
    type: "textarea" as const,
    placeholder: "특이사항이나 건의사항이 있으면 입력하세요.",
    rows: 2,
  },
];

export default function DailyReportPage() {
  return (
    <DocumentPage
      type="daily-report"
      pageTitle="일일 업무보고"
      pageIcon="📋"
      formTitle="일일 업무보고 작성"
      formDescription="오늘의 업무 내용을 입력하면 AI가 전문적인 일일 업무보고서를 작성합니다."
      fields={fields}
    />
  );
}
