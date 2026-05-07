# Office Project

로컬 사무용 자동화 홈페이지 제작 프로젝트입니다. 사내 업무 자동화와 협업을 위한 React 기반 오피스 관리 시스템이며 일정, 주간 업무 보고, 문서 관리, AI 요약, 사용자 관리, 실시간 메신저 기능을 하나의 웹 애플리케이션에서 제공합니다.

## 기술 스택

- Frontend: React 18, TypeScript, Vite, Tailwind CSS, Zustand
- Backend: Node.js, Express, Socket.io
- Database: SQLite, better-sqlite3
- AI: Ollama, 기본 모델 `qwen2.5:7b`
- Export: jsPDF, xlsx

## 프로젝트 구조

```text
office-project/
├─ .github/agents/        # GitHub 에이전트 문서
├─ server/                # Express API, Socket.io, SQLite DB 초기화
│  ├─ auth.cjs            # JWT 인증 및 권한 미들웨어
│  ├─ db.cjs              # SQLite 테이블 생성 및 DB 연결
│  ├─ index.cjs           # REST API, AI API, 메신저 서버
│  └─ package.json        # 백엔드 의존성
├─ src/
│  ├─ components/Layout/  # 공통 레이아웃, 헤더, 사이드바
│  ├─ lib/                # API 클라이언트
│  ├─ pages/              # 주요 화면
│  ├─ store/              # Zustand 상태 관리
│  ├─ types/              # 공통 타입
│  └─ utils/              # Socket, PDF, Excel 유틸
├─ index.html
├─ package.json           # 프론트엔드 의존성 및 스크립트
├─ vite.config.ts         # Vite 서버 및 API 프록시 설정
└─ README.md
```

## 실행 방법

### 1. 프론트엔드 의존성 설치

```bash
npm install
```

### 2. 백엔드 의존성 설치

```bash
cd server
npm install
cd ..
```

### 3. 백엔드 서버 실행

```bash
node server/index.cjs
```

백엔드는 `http://localhost:3001`에서 실행됩니다. 실행 시 `server/office.db` 파일이 자동 생성되고 필요한 테이블도 함께 생성됩니다.

### 4. 프론트엔드 개발 서버 실행

새 터미널에서 실행합니다.

```bash
npm run dev
```

프론트엔드는 기본적으로 `http://localhost:5173`에서 실행됩니다. API와 WebSocket 요청은 Vite 프록시를 통해 백엔드로 전달됩니다.

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

### v1.0.0 (2026-05-07) - 로컬 사무용 자동화 홈페이지 초기 버전

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
