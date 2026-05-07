import DocumentPage from "@/components/DocumentPage";

const emailTypes = [
  "업무 요청",
  "안내 및 공지",
  "감사 인사",
  "일정 조율",
  "보고",
  "협조 요청",
  "사과",
  "제안",
  "거절",
  "기타",
];

const fields = [
  {
    name: "sender",
    label: "발신자",
    type: "text" as const,
    placeholder: "예) 홍길동 / 개발팀 대리",
    required: true,
  },
  {
    name: "recipient",
    label: "수신자",
    type: "text" as const,
    placeholder: "예) 김철수 부장님 / 거래처 담당자",
    required: true,
  },
  {
    name: "subject",
    label: "이메일 제목",
    type: "text" as const,
    placeholder: "예) [요청] 프로젝트 A 자료 전달 부탁드립니다.",
    required: true,
  },
  {
    name: "emailType",
    label: "이메일 유형",
    type: "select" as const,
    options: emailTypes,
    required: true,
  },
  {
    name: "mainMessage",
    label: "핵심 전달 내용",
    type: "textarea" as const,
    placeholder: "이메일로 전달하고자 하는 핵심 내용을 입력하세요.",
    required: true,
    rows: 4,
  },
  {
    name: "request",
    label: "요청 / 요구 사항",
    type: "textarea" as const,
    placeholder: "수신자에게 요청하는 사항이 있으면 입력하세요.",
    rows: 3,
  },
  {
    name: "deadline",
    label: "마감 기한",
    type: "text" as const,
    placeholder: "예) 2024년 1월 20일(금) 오전 10시까지",
  },
  {
    name: "attachments",
    label: "첨부 파일",
    type: "text" as const,
    placeholder: "예) 프로젝트 A 현황보고서.xlsx",
  },
  {
    name: "notes",
    label: "추가 메모",
    type: "textarea" as const,
    placeholder: "기타 전달할 내용이 있으면 입력하세요.",
    rows: 2,
  },
];

export default function EmailPage() {
  return (
    <DocumentPage
      type="email"
      pageTitle="이메일"
      pageIcon="✉️"
      formTitle="업무 이메일 작성"
      formDescription="이메일 정보를 입력하면 AI가 정중하고 전문적인 업무 이메일을 작성합니다."
      fields={fields}
    />
  );
}
