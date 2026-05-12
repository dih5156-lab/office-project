/**
 * SQLite 자동 백업 모듈
 *
 * better-sqlite3의 .backup() API를 사용한 온라인 백업:
 * - DB 잠금 없이 운영 중 안전하게 백업 가능
 * - 서버 시작 30초 후 첫 백업, 이후 24시간 주기 자동 실행
 * - backups/ 폴더에 최근 MAX_BACKUPS(7)개만 유지
 */

const path = require('path');
const fs   = require('fs');

const BACKUP_DIR   = path.join(__dirname, 'backups');
const MAX_BACKUPS  = 7;

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

function getTimestamp() {
  // "2026-05-12T14-30-00" 형태 (파일명에 사용 가능)
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

/**
 * 온라인 백업 생성 (DB 잠금 없이 안전하게 복사)
 * @param {import('better-sqlite3').Database} db
 * @returns {Promise<{filename: string, path: string, createdAt: string}>}
 */
async function createBackup(db) {
  ensureBackupDir();
  const filename = `office-${getTimestamp()}.db`;
  const destPath = path.join(BACKUP_DIR, filename);
  await db.backup(destPath);
  console.log(`[Backup] 백업 생성 완료: ${filename}`);
  pruneOldBackups();
  return { filename, path: destPath, createdAt: new Date().toISOString() };
}

/** 오래된 백업 파일 삭제 (MAX_BACKUPS 초과분 제거) */
function pruneOldBackups() {
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('office-') && f.endsWith('.db'))
      .sort()
      .reverse();                   // 최신순 정렬
    files.slice(MAX_BACKUPS).forEach(f => {
      try {
        fs.unlinkSync(path.join(BACKUP_DIR, f));
        console.log(`[Backup] 오래된 백업 삭제: ${f}`);
      } catch (e) {
        console.error(`[Backup] 삭제 실패: ${f}`, e.message);
      }
    });
  } catch (e) {
    console.error('[Backup] pruneOldBackups 오류:', e.message);
  }
}

/**
 * 백업 파일 목록 반환
 * @returns {{ filename: string, sizeBytes: number, createdAt: string }[]}
 */
function listBackups() {
  ensureBackupDir();
  return fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('office-') && f.endsWith('.db'))
    .sort()
    .reverse()
    .map(f => {
      try {
        const stat = fs.statSync(path.join(BACKUP_DIR, f));
        return { filename: f, sizeBytes: stat.size, createdAt: stat.mtime.toISOString() };
      } catch {
        return { filename: f, sizeBytes: 0, createdAt: '' };
      }
    });
}

/**
 * 자동 백업 스케줄 등록
 * - 서버 시작 30초 후 첫 백업
 * - 이후 24시간 주기
 * @param {import('better-sqlite3').Database} db
 */
function scheduleBackups(db) {
  const safe = () => createBackup(db).catch(e => console.error('[Backup] 오류:', e.message));
  setTimeout(safe, 30_000);
  setInterval(safe, 24 * 60 * 60 * 1_000);
  console.log('[Backup] 자동 백업 등록 (24시간 주기, 최대 7개 유지)');
}

module.exports = { createBackup, scheduleBackups, listBackups };
