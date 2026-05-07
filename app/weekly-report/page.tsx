import DocumentPage from "@/components/DocumentPage";

const fields = [
  {
    name: "week",
    label: "보고 주차",
    type: "text" as const,
    placeholder: "예) 2024년 1월 3주차 (1/15 ~ 1/19)",
    required: true,
  },
  { name: "author", label: "작성자", type: "text" as const, placeholder: "홍길동", required: true },
  { name: "department", label: "부서", type: "text" as const, placeholder: "개발팀", required: true },
  {
    name: "achievements",
    label: "이번 주 주요 업무 실적",
    type: "textarea" as const,
    placeholder: "예) 프로젝트 A 개발 완료 및 QA 테스트 진행\n예) 신규 기능 설계 및 개발 착수",
    required: true,
    rows: 5,
  },
  {
    name: "goalStatus",
    label: "목표 대비 달성 현황",
    type: "textarea" as const,
    placeholder: "예) 주간 목표 3건 중 2건 완료, 1건 진행 중 (90% 달성)",
    rows: 3,
  },
  {
    name: "nextWeekPlan",
    label: "다음 주 업무 계획",
    type: "textarea" as const,
    placeholder: "예) 프로젝트 B 기획 완료 및 개발 착수\n예) 고객사 미팅 준비",
    required: true,
    rows: 4,
  },
  {
    name: "issues",
    label: "이슈 / 리스크 사항",
    type: "textarea" as const,
    placeholder: "이슈나 리스크가 있으면 입력하세요.",
    rows: 2,
  },
];

export default function WeeklyReportPage() {
  return (
    <DocumentPage
      type="weekly-report"
      pageTitle="주간 업무보고"
      pageIcon="📅"
      formTitle="주간 업무보고 작성"
      formDescription="이번 주 업무 내용을 입력하면 AI가 체계적인 주간 업무보고서를 작성합니다."
      fields={fields}
    />
  );
}
