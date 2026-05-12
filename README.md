# Office Project

로컬 사무용 자동화 홈페이지 제작 프로젝트입니다. 사내 업무 자동화와 협업을 위한 React 기반 오피스 관리 시스템이며 일정, 주간 업무 보고, 문서 관리, AI 챗봇, 연락처, 공지사항, 결재, 사용자 관리, 실시간 메신저 기능을 하나의 웹 애플리케이션에서 제공합니다.

## 기술 스택

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Zustand
- **Backend**: Node.js, Express, Socket.io, pm2
- **Database**: SQLite, better-sqlite3, 자동 마이그레이션 시스템
- **AI**: Ollama (`qwen2.5:7b`), 플로팅 AI 챗봇 위젯
- **외부 연동**: Google Calendar OAuth2
- **Export**: jsPDF, xlsx, docx (Word)

## 주요 기능

| 메뉴 | 기능 |
|------|------|
| 대시보드 | 일정·보고서·문서·알림 현황 통합 뷰 |
| 일정 | 월간/목록 캘린더, 카테고리·우선순위·참석자·Google Calendar 연동 |
| 문서 | 파일 업로드/다운로드, 태그·카테고리 분류, 미리보기 |
| 주간 보고 | 주간 보고서 작성·상태 관리, PDF/Excel 내보내기 |
| AI 요약 | Ollama 기반 문서·보고서 요약, 플로팅 챗봇으로 일정 추가 |
| 메신저 | Socket.io 실시간 전체/DM 채팅 |
| 연락처 | 사내 주소록 관리 |
| 공지사항 | 공지 등록·조회 |
| 결재 | 전자결재 요청·승인 흐름 |
| 사용자 관리 | 계정 CRUD, 역할 관리 (관리자 전용) |

## 프로젝트 구조

```text
office-project/
├─ ecosystem.config.cjs   # pm2 프로세스 설정 (서버 + Ollama)
├─ server/
│  ├─ auth.cjs            # JWT 인증 및 권한 미들웨어
│  ├─ backup.cjs          # DB 자동 백업
│  ├─ db.cjs              # SQLite 테이블 생성 및 DB 연결
│  ├─ index.cjs           # REST API, AI API, Google OAuth, 메신저 서버
│  ├─ migrations.cjs      # DB 스키마 버전 마이그레이션
│  └─ package.json
├─ src/
│  ├─ components/
│  │  ├─ Approval/        # 전자결재 컴포넌트
│  │  ├─ Contacts/        # 연락처 컴포넌트
│  │  ├─ Documents/       # 문서 관리 컴포넌트
│  │  ├─ Layout/          # 공통 레이아웃, 헤더, 사이드바, 챗봇 위젯
│  │  └─ Schedule/        # 일정 컴포넌트 (월간/목록/모달)
│  ├─ features/           # 도메인별 상수·타입·유틸
│  ├─ lib/                # API 클라이언트
│  ├─ pages/              # 주요 화면 (10개 페이지)
│  ├─ store/              # Zustand 상태 관리
│  ├─ types/              # 공통 타입
│  └─ utils/              # Socket, PDF, Excel, Word, 인코딩 유틸
├─ index.html
├─ package.json
├─ vite.config.ts         # Vite 서버 및 API 프록시 설정
└─ README.md
```

## 실행 방법

### 1. 의존성 설치

```bash
npm install
cd server && npm install && cd ..
```

### 2. pm2로 서버 실행 (권장)

```bash
pm2 start ecosystem.config.cjs
```

백엔드(`http://localhost:3001`)와 Ollama가 pm2로 자동 관리됩니다.

### 3. 수동 실행 (개발용)

```bash
# 터미널 1 - 백엔드
cd server && node index.cjs

# 터미널 2 - 프론트엔드
npm run dev
```

프론트엔드는 `http://localhost:5173`에서 실행됩니다.

Vite 콘솔에 `http proxy error` 또는 `ECONNREFUSED`가 보이면 백엔드 서버가 꺼진 상태입니다. `cd server && node index.cjs`를 먼저 실행한 뒤 새로고침하세요.

## 기본 계정

서버 최초 실행 시 기본 관리자 계정이 자동 생성됩니다.

```text
이메일: admin@office.com
비밀번호: admin1234
```

운영 환경에서는 로그인 후 즉시 비밀번호를 변경하세요.

## AI 요약 사용 조건

AI 요약 기능은 로컬 Ollama 서버가 필요합니다.

```bash
ollama serve
ollama pull qwen2.5:7b
```

Ollama는 기본적으로 `http://localhost:11434`를 사용합니다. Ollama가 실행 중이 아니면 일반 업무 기능은 사용할 수 있지만 AI 요약 요청은 실패합니다.

## 테스트 및 빌드

프로덕션 빌드를 확인하려면 아래 명령을 실행합니다.

```bash
npm run build
```

빌드가 성공하면 `dist/` 폴더에 정적 파일이 생성됩니다. `dist/`는 빌드 산출물이므로 Git에는 포함하지 않습니다.

## Git 관리 기준

Git에는 소스 코드와 설정 파일만 포함합니다.

- 포함: `src/`, `server/*.cjs`, `package.json`, `package-lock.json`, 설정 파일, 문서
- 제외: `node_modules/`, `dist/`, `server/*.db`, `server/*.db-shm`, `server/*.db-wal`, 환경 변수 파일

## 배포 전 확인 사항

- 기본 관리자 비밀번호 변경
- JWT 비밀키와 비밀번호 salt 환경 변수화
- 운영 DB 백업 정책 수립
- HTTPS와 CORS 허용 도메인 제한
- AI 모델과 Ollama 실행 환경 확인

## 변경 이력

### v1.3.0 (2026-05-12) — UX 개선 및 버그 수정

**일정 폼 UX 개선**

- 시작일/시작시간을 변경하면 종료일/종료시간이 이전 값으로 남지 않고 자동으로 이후 시점으로 이동
  - 종일 모드: 종료 날짜가 시작 날짜보다 이전이면 시작 날짜와 동일하게 조정
  - 일반 모드: 종료 시간이 시작 시간 이하이면 시작 시간 +1시간으로 자동 이동
  - 적용 파일: `src/components/Layout/ChatbotWidget.tsx`

**Google Calendar RFC3339 날짜 포맷 오류 수정**

- Google Calendar API 동기화 시 `Bad Request` 400 오류 발생 문제 수정
- `toRFC3339` 함수가 초(seconds) 없이 `HH:mm+09:00` 형식을 전송하던 문제를 `HH:mm:00+09:00`으로 보정
- 적용 파일: `server/index.cjs`

---

### v1.2.0 (2026-05-11) — Google Calendar 연동 및 챗봇 개선

**Google Calendar OAuth2 연동**

- `server/.env` — Google OAuth2 자격증명 보관 (Client ID, Secret, Redirect URI)
- `server/migrations.cjs` — v8 마이그레이션: `users` 테이블에 Google 토큰 컬럼 추가
  (`google_access_token`, `google_refresh_token`, `google_token_expiry`, `google_email`)
- `server/index.cjs` — Google OAuth2 라우트 4개 추가
  - `GET /api/google/status` — 연동 상태 조회
  - `GET /api/google/auth` — OAuth 인증 URL 발급
  - `GET /api/google/callback` — 토큰 수신 및 DB 저장 (팝업 postMessage)
  - `POST /api/google/disconnect` — 연동 해제
  - `POST /api/google/sync-event` — 개별 일정 즉시 동기화
- `src/components/Layout/ProfileModal.tsx` — 프로필 탭 "외부 연동" 섹션에 Google Calendar 연동/해제 UI 추가
- `src/components/Layout/ChatbotWidget.tsx` — 챗봇으로 일정 추가 시 Google Calendar에 자동 동기화

**AI 챗봇 위젯 UX 개선**

- 회의/미팅/외근 빠른 추가 버튼이 채팅창에 텍스트 메시지를 보내는 대신 폼 카드를 직접 표시하도록 변경
  - `QUICK_SCHEDULE` 버튼 → `formData` 방식으로 전환
  - `showScheduleForm()` 함수로 채팅 스레드에 인라인 폼 카드 삽입
- 챗봇 버튼 및 패널을 드래그로 위치 이동 가능하도록 개선
  - 3px 이상 이동 시 드래그로 인식, 미만은 클릭으로 처리 (`didDrag` ref)
  - `right` / `bottom` 좌표 state로 위치 유지

**서버 안정화 (pm2)**

- `ecosystem.config.cjs` 추가 — `office-server`와 `ollama` 두 프로세스를 pm2로 관리
- 서버 재시작, 로그 수집, 자동 재시작 정책 통합

**KST 시간대 통일**

- `server/index.cjs` 상단에 `kstNow()`, `kstDateStr()`, `kstWeekRange()` 헬퍼 추가
- AI 일정 조회, 주간 범위 계산, 로그 타임스탬프를 KST 기준으로 통일

---

### v1.1.0 (2026-05-10) — 주요 기능 확장

**신규 페이지 추가**

- `src/pages/ContactsPage.tsx` — 사내 주소록 관리
- `src/pages/NoticePage.tsx` — 공지사항 등록 및 조회
- `src/pages/ApprovalPage.tsx` — 전자결재 요청·승인 흐름
- `src/pages/TrashPage.tsx` — 삭제된 항목 복원/영구 삭제

**일정 관리 컴포넌트 분리**

- `src/components/Schedule/` — 월간 캘린더, 목록 뷰, 사이드 패널, 모달, 카테고리 필터, 툴바로 분리
- 일정 우선순위, 참석자, 장소 필드 추가

**문서 관리 컴포넌트 분리**

- `src/components/Documents/` — 그리드 뷰, 파일 행, 검색 필터, 툴바, 보기/편집 모달로 분리
- Word(.docx) 내보내기 기능 추가 (`src/utils/exportWord.ts`)
- 파일 인코딩 처리 유틸 추가 (`src/utils/encoding.ts`)

**상태 관리 확장**

- `src/store/contactStore.ts` — 연락처 상태
- `src/store/noticeStore.ts` — 공지사항 상태
- `src/store/notificationStore.ts` — 알림 상태 (읽음 처리 포함)
- `src/store/themeStore.ts` — 다크/라이트 테마 전환
- `src/store/todoStore.ts` — 할 일 목록 상태
- `src/store/fileStore.ts` — 파일 업로드/목록 상태

**DB 마이그레이션 시스템 도입**

- `server/migrations.cjs` 추가 — 버전별 스키마 변경을 순차 적용
- `server/backup.cjs` 추가 — 주기적 DB 백업 기능

**Toast 알림 및 세션 처리**

- `src/components/Layout/Toast.tsx` — 전역 토스트 알림 컴포넌트
- `src/components/Layout/SessionExpiredModal.tsx` — JWT 만료 시 세션 만료 모달

---

### v1.0.0 (2026-05-07) — 초기 버전

오피스 업무 관리 UI 제작

- `src/pages/DashboardPage.tsx` 추가
- 대시보드에서 일정, 보고서, 문서, AI 요약, 메신저 현황을 한 화면에서 확인
- 일정 등록, 수정, 삭제 및 우선순위/참석자/장소 관리 기능 추가
- 주간 업무 보고서 작성, 상태 관리, PDF/Excel 내보내기 기능 추가
- 문서 등록, 분류, 태그 기반 관리 기능 추가

사용자 인증 및 관리자 기능 추가

- `server/auth.cjs` 추가
- JWT 기반 로그인 인증 처리
- 최초 실행 시 기본 관리자 계정 자동 생성
- 관리자 사용자 생성, 수정, 삭제 및 비밀번호 변경 기능 추가

실시간 메신저 기능 추가

- `server/index.cjs`에 Socket.io 서버 구성
- 전체 채팅방과 1:1 DM 지원
- 접속 사용자 목록, 입력 중 표시, 채팅 기록 저장 기능 추가
- `src/utils/socket.ts`로 프론트엔드 WebSocket 연결 관리

AI 요약 기능 추가

- Ollama 로컬 서버 연동
- 기본 모델 `qwen2.5:7b` 기준 문서 요약 및 주간 보고서 요약 API 추가
- Ollama 연결 상태 확인 API 추가
- AI 서버가 없을 때 일반 업무 기능은 유지하고 요약 요청만 실패하도록 처리

SQLite 기반 백엔드 구성

- `server/db.cjs` 추가
- 사용자, 일정, 주간 보고서, 문서, AI 요약, 채팅 메시지 테이블 자동 생성
- `better-sqlite3` 기반 로컬 DB 저장 구조 구성
- `server/office.db`, WAL, SHM 파일은 Git 제외 처리

프로젝트 실행 및 Git 관리 문서화

- `README.md` 추가
- 프로젝트 구조, 설치 방법, 프론트엔드/백엔드 실행 순서 정리
- 기본 계정, Ollama 실행 조건, 빌드 테스트 방법 정리
- `.gitignore` 추가
- `node_modules/`, `dist/`, 로컬 DB, 환경 변수 파일 제외
