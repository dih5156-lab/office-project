# AI 사무 자동화 (Office AI Assistant)

AI를 이용한 로컬 사무용 자동화 홈페이지 — 업무보고, 회의록, 보고서, 이메일 등 사무적인 문서를 빠르고 간편하게 작성합니다.

## 주요 기능

| 기능 | 설명 |
|------|------|
| 📋 일일 업무보고 | 오늘의 완료/진행 중/예정 업무를 AI가 체계적으로 정리 |
| 📅 주간 업무보고 | 주간 실적과 다음 주 계획을 전문 보고서 형식으로 생성 |
| 📝 회의록 | 회의 내용, 결정 사항, 후속 조치를 공식 회의록으로 정리 |
| 📊 보고서 | 다양한 유형의 업무 보고서를 전문적으로 작성 |
| ✉️ 이메일 | 정중하고 전문적인 업무 이메일 자동 작성 |

## 기술 스택

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **AI**: OpenAI GPT-4o-mini

## 시작하기

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수 설정

`.env.local.example` 파일을 복사하여 `.env.local` 파일을 생성하고 OpenAI API 키를 입력합니다.

```bash
cp .env.local.example .env.local
```

`.env.local` 파일을 열고 `OPENAI_API_KEY` 값을 설정합니다:

```env
OPENAI_API_KEY=your_openai_api_key_here
```

> API 키는 [OpenAI 플랫폼](https://platform.openai.com/api-keys)에서 발급받을 수 있습니다.

### 3. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 열어 확인합니다.

## 프로젝트 구조

```
office-project/
├── app/
│   ├── api/generate/route.ts   # AI 문서 생성 API
│   ├── daily-report/page.tsx   # 일일 업무보고
│   ├── weekly-report/page.tsx  # 주간 업무보고
│   ├── meeting-minutes/page.tsx # 회의록
│   ├── report/page.tsx         # 보고서
│   ├── email/page.tsx          # 이메일
│   ├── layout.tsx              # 공통 레이아웃
│   └── page.tsx                # 메인 홈페이지
├── components/
│   ├── Navbar.tsx              # 네비게이션 바
│   ├── DocumentForm.tsx        # 문서 입력 폼
│   ├── DocumentPage.tsx        # 문서 페이지 공통 컴포넌트
│   └── ResultDisplay.tsx       # 결과 표시 컴포넌트
└── lib/
    └── openai.ts               # OpenAI 클라이언트 설정
```
