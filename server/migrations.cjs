/**
 * 데이터베이스 마이그레이션 시스템
 * - 각 마이그레이션은 version 번호로 식별되며 한 번만 실행됩니다.
 * - 서버 시작 시 schema_migrations 테이블을 기준으로 미적용 마이그레이션을 자동 실행합니다.
 */

const MIGRATIONS = [
  /* ── 소프트 딜리트: schedules / documents / weekly_reports / notices ──────── */
  {
    version: 4,
    name: 'add_soft_delete_columns',
    statements: [
      `ALTER TABLE schedules       ADD COLUMN deleted_at TEXT DEFAULT NULL`,
      `ALTER TABLE documents       ADD COLUMN deleted_at TEXT DEFAULT NULL`,
      `ALTER TABLE weekly_reports  ADD COLUMN deleted_at TEXT DEFAULT NULL`,
      `ALTER TABLE notices         ADD COLUMN deleted_at TEXT DEFAULT NULL`,
      // 조회 인덱스 (deleted_at IS NULL 필터가 빠르게 동작하도록)
      `CREATE INDEX IF NOT EXISTS idx_schedules_not_deleted  ON schedules(deleted_at)`,
      `CREATE INDEX IF NOT EXISTS idx_documents_not_deleted  ON documents(deleted_at)`,
      `CREATE INDEX IF NOT EXISTS idx_reports_not_deleted    ON weekly_reports(deleted_at)`,
      `CREATE INDEX IF NOT EXISTS idx_notices_not_deleted    ON notices(deleted_at)`,
    ],
  },
  /* ── 감사 로그 테이블 ───────────────────────────────────────────────────────── */
  {
    version: 5,
    name: 'create_audit_logs',
    statements: [
      `CREATE TABLE IF NOT EXISTS audit_logs (
         id          TEXT PRIMARY KEY,
         actor_id    TEXT NOT NULL,
         actor_name  TEXT NOT NULL,
         action      TEXT NOT NULL,
         target_type TEXT NOT NULL,
         target_id   TEXT NOT NULL,
         detail      TEXT DEFAULT '{}',
         ip          TEXT DEFAULT '',
         created_at  TEXT NOT NULL
       )`,
      `CREATE INDEX IF NOT EXISTS idx_audit_actor  ON audit_logs(actor_id)`,
      `CREATE INDEX IF NOT EXISTS idx_audit_target ON audit_logs(target_type, target_id)`,
      `CREATE INDEX IF NOT EXISTS idx_audit_date   ON audit_logs(created_at)`,
    ],
  },
  /* ── 파일 용량 쿼터 ─────────────────────────────────────────────────────────── */
  {
    version: 6,
    name: 'add_file_quota',
    statements: [
      // 기본 쿼터: 500 MB (bytes). NULL = 무제한
      `ALTER TABLE users ADD COLUMN file_quota_bytes INTEGER DEFAULT 524288000`,
    ],
  },
  {
    // weekly_reports 테이블에 승인 관련 컬럼 추가 (API 코드와 스키마 불일치 수정)
    version: 1,
    name: 'add_weekly_reports_approval_columns',
    statements: [
      `ALTER TABLE weekly_reports ADD COLUMN approval_status  TEXT DEFAULT NULL`,
      `ALTER TABLE weekly_reports ADD COLUMN approval_comment TEXT DEFAULT NULL`,
      `ALTER TABLE weekly_reports ADD COLUMN approved_by      TEXT DEFAULT NULL`,
    ],
  },
  {
    // 비밀번호 해시 알고리즘 버전 추적 컬럼 추가 (sha256 → bcrypt 투명 마이그레이션)
    version: 2,
    name: 'add_users_password_version',
    statements: [
      `ALTER TABLE users ADD COLUMN password_version TEXT NOT NULL DEFAULT 'sha256'`,
    ],
  },
  {
    // 문서 전문 검색(FTS5) 가상 테이블 + 자동 동기화 트리거
    version: 3,
    name: 'create_documents_fts',
    statements: [
      `CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
         id      UNINDEXED,
         title,
         content,
         tags,
         tokenize = 'unicode61'
       )`,
      // 기존 문서 데이터 초기 색인
      `INSERT OR IGNORE INTO documents_fts(id, title, content, tags)
         SELECT id,
                COALESCE(title,   ''),
                COALESCE(content, ''),
                COALESCE(tags,    '[]')
         FROM documents`,
      // INSERT 트리거
      `CREATE TRIGGER IF NOT EXISTS trg_docs_fts_insert
         AFTER INSERT ON documents BEGIN
           INSERT INTO documents_fts(id, title, content, tags)
           VALUES (new.id,
                   COALESCE(new.title,   ''),
                   COALESCE(new.content, ''),
                   COALESCE(new.tags,    '[]'));
         END`,
      // UPDATE 트리거
      `CREATE TRIGGER IF NOT EXISTS trg_docs_fts_update
         AFTER UPDATE ON documents BEGIN
           DELETE FROM documents_fts WHERE id = old.id;
           INSERT INTO documents_fts(id, title, content, tags)
           VALUES (new.id,
                   COALESCE(new.title,   ''),
                   COALESCE(new.content, ''),
                   COALESCE(new.tags,    '[]'));
         END`,
      // DELETE 트리거
      `CREATE TRIGGER IF NOT EXISTS trg_docs_fts_delete
         AFTER DELETE ON documents BEGIN
           DELETE FROM documents_fts WHERE id = old.id;
         END`,
    ],
  },
  /* ── 전자결재 테이블 ────────────────────────────────────────────────────────── */
  {
    version: 7,
    name: 'create_approvals',
    statements: [
      `CREATE TABLE IF NOT EXISTS approvals (
         id           TEXT PRIMARY KEY,
         title        TEXT NOT NULL,
         type         TEXT NOT NULL DEFAULT '품의서',
         content      TEXT NOT NULL DEFAULT '',
         amount       INTEGER DEFAULT 0,
         author_id    TEXT NOT NULL,
         author_name  TEXT NOT NULL,
         author_dept  TEXT NOT NULL DEFAULT '',
         status       TEXT NOT NULL DEFAULT 'pending',
         created_at   TEXT NOT NULL,
         updated_at   TEXT NOT NULL
       )`,
      `CREATE TABLE IF NOT EXISTS approval_steps (
         id            TEXT PRIMARY KEY,
         approval_id   TEXT NOT NULL REFERENCES approvals(id) ON DELETE CASCADE,
         step_order    INTEGER NOT NULL,
         approver_id   TEXT NOT NULL,
         approver_name TEXT NOT NULL,
         status        TEXT NOT NULL DEFAULT 'pending',
         comment       TEXT DEFAULT '',
         acted_at      TEXT DEFAULT NULL
       )`,
      `CREATE INDEX IF NOT EXISTS idx_approvals_author ON approvals(author_id)`,
      `CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status)`,
      `CREATE INDEX IF NOT EXISTS idx_approval_steps_approval ON approval_steps(approval_id)`,
      `CREATE INDEX IF NOT EXISTS idx_approval_steps_approver ON approval_steps(approver_id)`,
    ],
  },
  /* ── Google Calendar OAuth 토큰 ──────────────────────────────────────────── */
  {
    version: 8,
    name: 'add_google_calendar_tokens',
    statements: [
      `ALTER TABLE users ADD COLUMN google_access_token  TEXT DEFAULT NULL`,
      `ALTER TABLE users ADD COLUMN google_refresh_token TEXT DEFAULT NULL`,
      `ALTER TABLE users ADD COLUMN google_token_expiry  TEXT DEFAULT NULL`,
      `ALTER TABLE users ADD COLUMN google_email         TEXT DEFAULT NULL`,
    ],
  },
];

/**
 * 미적용 마이그레이션을 순서대로 실행합니다.
 * @param {import('better-sqlite3').Database} db
 */
function runMigrations(db) {
  // 마이그레이션 이력 테이블 생성
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    INTEGER PRIMARY KEY,
      name       TEXT    NOT NULL,
      applied_at TEXT    NOT NULL
    )
  `);

  const applied = new Set(
    db.prepare('SELECT version FROM schema_migrations').all().map(r => r.version)
  );

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.version)) continue;

    console.log(`[Migration] v${migration.version} 적용 중: ${migration.name}`);

    const run = db.transaction(() => {
      for (const stmt of migration.statements) {
        try {
          db.exec(stmt);
        } catch (e) {
          // 이미 존재하는 컬럼 / 테이블은 무시
          if (
            e.message.includes('duplicate column name') ||
            e.message.includes('already exists')
          ) {
            console.log(`[Migration]   이미 존재 (무시): ${e.message.split('\n')[0]}`);
          } else {
            throw e;
          }
        }
      }
      db.prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)')
        .run(migration.version, migration.name, new Date().toISOString());
    });

    run();
    console.log(`[Migration] v${migration.version} 완료`);
  }

  console.log('[Migration] 모든 마이그레이션 최신 상태');
}

module.exports = { runMigrations };
