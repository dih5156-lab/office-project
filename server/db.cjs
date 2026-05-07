const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'office.db');
const db = new Database(DB_PATH);

// 성능 최적화
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    department TEXT NOT NULL DEFAULT '',
    role TEXT NOT NULL DEFAULT 'member',
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

  CREATE INDEX IF NOT EXISTS idx_schedules_date ON schedules(start_date);
  CREATE INDEX IF NOT EXISTS idx_reports_dept ON weekly_reports(department);
  CREATE INDEX IF NOT EXISTS idx_reports_week ON weekly_reports(week_start);
  CREATE INDEX IF NOT EXISTS idx_chat_room ON chat_messages(room);
`);

module.exports = db;
