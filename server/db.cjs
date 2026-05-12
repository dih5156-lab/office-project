const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'office.db');
const db = new Database(DB_PATH);

// 성능 최적화
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('synchronous = NORMAL'); // WAL 모드에서 안전하면서 빠름

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    department TEXT NOT NULL DEFAULT '',
    role TEXT NOT NULL DEFAULT 'member',
    phone TEXT DEFAULT '',
    position TEXT DEFAULT '',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS schedules (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    all_day INTEGER NOT NULL DEFAULT 0,
    category TEXT NOT NULL DEFAULT '기타',
    priority TEXT NOT NULL DEFAULT 'medium',
    location TEXT DEFAULT '',
    attendees TEXT DEFAULT '[]',
    created_by TEXT DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS weekly_reports (
    id TEXT PRIMARY KEY,
    week_start TEXT NOT NULL,
    week_end TEXT NOT NULL,
    author TEXT NOT NULL,
    department TEXT NOT NULL,
    completed_tasks TEXT NOT NULL DEFAULT '[]',
    in_progress_tasks TEXT NOT NULL DEFAULT '[]',
    next_week_tasks TEXT NOT NULL DEFAULT '[]',
    issues TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT '작성중',
    ai_summary TEXT DEFAULT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT DEFAULT '',
    category TEXT NOT NULL DEFAULT '기타',
    tags TEXT NOT NULL DEFAULT '[]',
    created_by TEXT DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS ai_summaries (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    original_text TEXT NOT NULL,
    summary_text TEXT NOT NULL DEFAULT '',
    keywords TEXT NOT NULL DEFAULT '[]',
    action_items TEXT NOT NULL DEFAULT '[]',
    type TEXT NOT NULL DEFAULT '기타',
    created_by TEXT DEFAULT '',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    from_id TEXT NOT NULL,
    from_name TEXT NOT NULL,
    from_dept TEXT DEFAULT '',
    to_id TEXT DEFAULT NULL,
    room TEXT NOT NULL,
    content TEXT NOT NULL,
    timestamp TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY,
    original_name TEXT NOT NULL,
    stored_name TEXT NOT NULL,
    mime_type TEXT NOT NULL DEFAULT '',
    size INTEGER NOT NULL DEFAULT 0,
    related_id TEXT DEFAULT NULL,
    related_type TEXT DEFAULT NULL,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS notices (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    author_id TEXT NOT NULL,
    author_name TEXT NOT NULL,
    department TEXT NOT NULL DEFAULT '',
    is_pinned INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS todos (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    completed INTEGER NOT NULL DEFAULT 0,
    priority TEXT NOT NULL DEFAULT 'medium',
    due_date TEXT DEFAULT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_todos_user ON todos(user_id);

  CREATE TABLE IF NOT EXISTS contacts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    company TEXT DEFAULT '',
    department TEXT DEFAULT '',
    position TEXT DEFAULT '',
    email TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    type TEXT NOT NULL DEFAULT 'external',
    memo TEXT DEFAULT '',
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_contacts_type ON contacts(type);

  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    link TEXT NOT NULL DEFAULT '',
    is_read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, is_read);

  CREATE INDEX IF NOT EXISTS idx_schedules_date ON schedules(start_date);
  CREATE INDEX IF NOT EXISTS idx_reports_dept ON weekly_reports(department);
  CREATE INDEX IF NOT EXISTS idx_reports_week ON weekly_reports(week_start);
  CREATE INDEX IF NOT EXISTS idx_chat_room ON chat_messages(room);
  CREATE INDEX IF NOT EXISTS idx_files_related ON files(related_id, related_type);
  CREATE INDEX IF NOT EXISTS idx_notices_created ON notices(created_at);
`);

// 기존 테이블에 승인 관련 컬럼 추가 (없을 경우에만)
const reportCols = db.prepare("PRAGMA table_info(weekly_reports)").all().map(c => c.name);
if (!reportCols.includes('approval_status')) {
  db.prepare("ALTER TABLE weekly_reports ADD COLUMN approval_status TEXT DEFAULT NULL").run();
}
if (!reportCols.includes('approval_comment')) {
  db.prepare("ALTER TABLE weekly_reports ADD COLUMN approval_comment TEXT DEFAULT NULL").run();
}
if (!reportCols.includes('approved_by')) {
  db.prepare("ALTER TABLE weekly_reports ADD COLUMN approved_by TEXT DEFAULT NULL").run();
}

// WAL 파일을 메인 DB로 즉시 병합 (시작 시 잔여 WAL 정리)
try {
  db.pragma('wal_checkpoint(TRUNCATE)');
} catch (e) {
  console.warn('[DB] 시작 시 WAL 체크포인트 실패 (무시):', e.message);
}

// 기존 users 중 contacts에 없는 내부 직원 자동 동기화
try {
  const allUsers = db.prepare('SELECT * FROM users').all();
  for (const u of allUsers) {
    const exists = db.prepare('SELECT id FROM contacts WHERE email = ? AND type = ?').get(u.email, 'internal');
    if (!exists) {
      const cid = 'contact_' + Date.now() + '_' + Math.random().toString(36).slice(2);
      const now = u.created_at || new Date().toISOString();
      db.prepare(`INSERT INTO contacts (id,name,company,department,position,email,phone,type,memo,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
        .run(cid, u.name, '', u.department || '', '', u.email, '', 'internal', '', u.id, now, now);
    }
  }
  console.log('[DB] 주소록 내부 직원 동기화 완료');
} catch (e) {
  console.warn('[DB] 주소록 동기화 실패:', e.message);
}

// users 테이블 컬럼 마이그레이션 (기존 DB 대응)
try { db.exec("ALTER TABLE users ADD COLUMN phone TEXT DEFAULT ''"); } catch {}
try { db.exec("ALTER TABLE users ADD COLUMN position TEXT DEFAULT ''"); } catch {}

// 5분마다 WAL 체크포인트 (데이터 유실 방지)
const walCheckpointInterval = setInterval(() => {
  if (!db.open) { clearInterval(walCheckpointInterval); return; }
  try {
    db.pragma('wal_checkpoint(PASSIVE)');
  } catch (e) {
    console.error('[DB] WAL 체크포인트 오류:', e.message);
  }
}, 5 * 60 * 1000);

// 프로세스 종료 시 WAL을 메인 DB에 완전히 반영하고 DB 닫기
function closeDb() {
  if (!db.open) return;   // 이미 닫힌 경우 중복 실행 방지
  try {
    clearInterval(walCheckpointInterval);
    db.pragma('wal_checkpoint(TRUNCATE)');
    db.close();
    console.log('[DB] 데이터베이스 안전하게 종료됨');
  } catch (e) {
    console.error('[DB] 종료 중 오류:', e.message);
  }
}

process.on('exit', closeDb);

module.exports = { db, closeDb };
