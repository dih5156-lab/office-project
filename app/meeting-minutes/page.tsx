import DocumentPage from "@/components/DocumentPage";

const fields = [
  {
    name: "meetingTitle",
    label: "회의명",
    type: "text" as const,
    placeholder: "예) 2024년 1월 정기 팀 미팅",
    required: true,
  },
  {
    name: "meetingDate",
    label: "회의 일시",
    type: "text" as const,
    placeholder: "예) 2024-01-15 14:00 ~ 15:30",
    required: true,
  },
  {
    name: "location",
    label: "회의 장소",
    type: "text" as const,
    placeholder: "예) 3층 회의실 A / Zoom 화상회의",
    required: true,
  },
  {
    name: "attendees",
    label: "참석자",
    type: "text" as const,
    placeholder: "예) 김팀장, 이대리, 박주임, 최인턴 (총 4명)",
    required: true,
  },
  {
    name: "agenda",
    label: "회의 안건",
    type: "textarea" as const,
    placeholder: "예) 1. Q1 프로젝트 진행 현황 공유\n2. 신규 기능 도입 검토\n3. 일정 조율",
    required: true,
    rows: 3,
  },
  {
    name: "discussion",
    label: "주요 논의 내용",
    type: "textarea" as const,
    placeholder: "회의에서 논의된 주요 내용을 입력하세요.",
    required: true,
    rows: 5,
  },
  {
    name: "decisions",
    label: "결정 사항",
    type: "textarea" as const,
    placeholder: "회의에서 최종 결정된 사항을 입력하세요.",
    required: true,
    rows: 3,
  },
  {
    name: "actionItems",
    label: "후속 조치 사항",
    type: "textarea" as const,
    placeholder: "예) 이대리: API 명세서 작성 (1/20까지)\n박주임: 디자인 시안 준비 (1/22까지)",
    rows: 3,
  },
];

export default function MeetingMinutesPage() {
  return (
    <DocumentPage
      type="meeting-minutes"
      pageTitle="회의록"
      pageIcon="📝"
      formTitle="회의록 작성"
      formDescription="회의 정보와 내용을 입력하면 AI가 공식적인 회의록을 작성합니다."
      fields={fields}
    />
  );
}
