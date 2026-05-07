# Office Project

사내 업무 자동화와 협업을 위한 React 기반 오피스 관리 시스템입니다. 일정, 주간 업무 보고, 문서 관리, AI 요약, 사용자 관리, 실시간 메신저 기능을 하나의 웹 애플리케이션에서 제공합니다.

## Version 1.0

### 제작 내용

- 대시보드 기반 업무 현황 화면
- 일정 등록, 수정, 삭제 및 목록 관리
- 주간 업무 보고서 작성, 상태 관리, PDF/Excel 내보내기
- 문서 등록, 분류, 태그 기반 관리
- Ollama 연동 AI 문서 요약 및 보고서 요약
- 사용자 로그인, 관리자 사용자 관리, 비밀번호 변경
- Socket.io 기반 전체 채팅 및 1:1 메신저
- SQLite 기반 로컬 데이터 저장
- Vite 개발 서버 프록시를 통한 프론트엔드/백엔드 연동

### 변경 사항

- 신규 프로젝트 Git 저장소 구성
- 빌드 산출물, 의존성, 로컬 DB 파일 제외를 위한 `.gitignore` 추가
- v1.0 기준 프로젝트 구조와 실행 방법 문서화
- 운영 전 확인이 필요한 기본 계정과 AI 연동 조건 정리

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
