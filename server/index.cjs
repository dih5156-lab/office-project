const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const nodeHttp = require('http');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const { db, closeDb } = require('./db.cjs');
const { signToken, authMiddleware, adminOnly } = require('./auth.cjs');
const { runMigrations } = require('./migrations.cjs');
const { scheduleBackups, createBackup, listBackups } = require('./backup.cjs');

/* ── .env 로드 ── */
try {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
      const [k, ...v] = line.split('=');
      if (k && v.length) process.env[k.trim()] = v.join('=').trim();
    });
  }
} catch (_) {}

/* ── Google OAuth2 ── */
const { google } = require('googleapis');
function makeOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/api/google/callback'
  );
}

/* ─────────────────────────────────────────
   자동 정리 크론 (채팅 90일, 읽은 알림 30일)
───────────────────────────────────────── */
function runCleanup() {
  try {
    const chat = db.prepare("DELETE FROM chat_messages WHERE timestamp < datetime('now','-90 days')").run();
    const notif = db.prepare("DELETE FROM notifications WHERE is_read=1 AND created_at < datetime('now','-30 days')").run();
    const audit = db.prepare("DELETE FROM audit_logs WHERE created_at < datetime('now','-180 days')").run();
    console.log(`[Cleanup] 채팅 ${chat.changes}건, 알림 ${notif.changes}건, 감사로그 ${audit.changes}건 삭제`);
  } catch (e) {
    console.error('[Cleanup] 오류:', e.message);
  }
}

const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24시간

function scheduleCleanup() {
  // 서버 시작 60초 후 첫 실행
  setTimeout(() => {
    runCleanup();
    setInterval(runCleanup, CLEANUP_INTERVAL_MS);
  }, 60_000);
  console.log('[Cleanup] 자동 정리 크론 등록 (60초 후 첫 실행, 이후 24시간 주기)');
}

// 마이그레이션: 서버 시작 시 미적용 마이그레이션을 자동 실행
runMigrations(db);

const app = express();
app.use(cors({ origin: process.env.ALLOWED_ORIGIN || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '10mb' }));

/* 로그인 rate limit: 15분 내 10회 초과 시 차단 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '로그인 시도가 너무 많습니다. 15분 후 다시 시도하세요.' },
});

/* ─────────────────────────────────────────
   파일 업로드 설정 (multer)
───────────────────────────────────────── */
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const unique = Date.now().toString(36) + Math.random().toString(36).slice(2);
    const ext = path.extname(file.originalname);
    cb(null, unique + ext);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'text/plain', 'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/x-hwp', 'application/haansofthwp', 'application/hwp',
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/zip', 'application/x-zip-compressed',
    ];
    if (
      allowed.includes(file.mimetype) ||
      file.originalname.match(/\.(txt|pdf|docx?|xlsx|pptx?|hwpx?|png|jpe?g|gif|webp|zip)$/i)
    ) {
      cb(null, true);
    } else {
      cb(new Error('지원하지 않는 파일 형식입니다.'));
    }
  },
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
    methods: ['GET', 'POST'],
  },
});

/* ─────────────────────────────────────────
   유틸
───────────────────────────────────────── */
function genId() {
  return crypto.randomUUID().replace(/-/g, '');
}

/* ── KST 날짜/시간 헬퍼 (UTC+9 고정) ──
 * new Date().toISOString() 은 항상 UTC → KST에서 날짜가 달라질 수 있음
 * 모든 일정 관련 날짜 계산은 이 헬퍼를 통해 KST 기준으로 처리 */
function kstNow() {
  // KST = UTC + 9시간
  const now = new Date();
  return new Date(now.getTime() + 9 * 60 * 60 * 1000);
}
/** YYYY-MM-DD (KST) */
function kstDateStr(d = new Date()) {
  const k = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const y = k.getUTCFullYear();
  const m = String(k.getUTCMonth() + 1).padStart(2, '0');
  const day = String(k.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
/** 이번 주 일요일~토요일 (KST) → { weekStart: 'YYYY-MM-DD', weekEnd: 'YYYY-MM-DD' } */
function kstWeekRange() {
  const k = kstNow();
  const dow = k.getUTCDay(); // 0=일
  const sunday = new Date(k);
  sunday.setUTCDate(k.getUTCDate() - dow);
  const saturday = new Date(sunday);
  saturday.setUTCDate(sunday.getUTCDate() + 6);
  return {
    weekStart: `${sunday.getUTCFullYear()}-${String(sunday.getUTCMonth()+1).padStart(2,'0')}-${String(sunday.getUTCDate()).padStart(2,'0')}`,
    weekEnd:   `${saturday.getUTCFullYear()}-${String(saturday.getUTCMonth()+1).padStart(2,'0')}-${String(saturday.getUTCDate()).padStart(2,'0')}`,
  };
}

// SHA-256 레거시 해시 (기존 계정 검증 전용)
function hashPasswordSha256(password) {
  return crypto.createHash('sha256').update(password + 'office_salt_2026').digest('hex');
}

const BCRYPT_ROUNDS = 10;

// bcrypt 해시 (신규 계정 및 업그레이드)
async function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

// 비밀번호 검증 (password_version에 따라 sha256 또는 bcrypt)
async function verifyPassword(inputPassword, storedHash, version) {
  if (version === 'bcrypt') return bcrypt.compare(inputPassword, storedHash);
  return hashPasswordSha256(inputPassword) === storedHash;
}

/* ─────────────────────────────────────────
   감사 로그 헬퍼
───────────────────────────────────────── */
function auditLog(req, action, targetType, targetId, detail = {}) {
  try {
    const id = genId();
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || '';
    db.prepare('INSERT INTO audit_logs (id,actor_id,actor_name,action,target_type,target_id,detail,ip,created_at) VALUES (?,?,?,?,?,?,?,?,?)')
      .run(id, req.user.id, req.user.name, action, targetType, targetId, JSON.stringify(detail), ip, new Date().toISOString());
  } catch (e) {
    console.error('[Audit] 기록 실패:', e.message);
  }
}

/* ─────────────────────────────────────────
   파일 쿼터 헬퍼
───────────────────────────────────────── */
const FILE_QUOTA_BYTES_DEFAULT = 524_288_000; // 500 MB

function getUserFileUsage(userId) {
  const row = db.prepare('SELECT COALESCE(SUM(size),0) as total FROM files WHERE created_by=?').get(userId);
  return row?.total ?? 0;
}

function checkFileQuota(userId, incomingBytes) {
  const user = db.prepare('SELECT file_quota_bytes FROM users WHERE id=?').get(userId);
  const quota = user?.file_quota_bytes ?? FILE_QUOTA_BYTES_DEFAULT;
  if (quota === null) return { ok: true }; // 무제한
  const used = getUserFileUsage(userId);
  if (used + incomingBytes > quota) {
    return { ok: false, used, quota, message: `저장 공간 초과 (사용 ${Math.round(used/1024/1024)}MB / ${Math.round(quota/1024/1024)}MB)` };
  }
  return { ok: true, used, quota };
}

/* ─────────────────────────────────────────
   알림 헬퍼
───────────────────────────────────────── */
function pushNotif(userId, type, title, body, link) {
  try {
    const id = genId();
    const now = new Date().toISOString();
    db.prepare('INSERT INTO notifications (id,user_id,type,title,body,link,is_read,created_at) VALUES (?,?,?,?,?,?,0,?)')
      .run(id, userId, type, title, body || '', link || '', now);
    const notif = { id, userId, type, title, body: body || '', link: link || '', isRead: false, createdAt: now };
    io.to('user:' + userId).emit('notification', notif);
    return notif;
  } catch (e) {
    console.error('[pushNotif] error:', e.message);
  }
}

function pushNotifAll(excludeUserId, type, title, body, link) {
  const users = db.prepare('SELECT id FROM users').all();
  for (const u of users) {
    if (u.id !== excludeUserId) pushNotif(u.id, type, title, body, link);
  }
}

/* ─────────────────────────────────────────
   기본 관리자 계정 초기화
───────────────────────────────────────── */
const existing = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@office.com');
if (!existing) {
  const adminHash = bcrypt.hashSync('admin1234', BCRYPT_ROUNDS);
  db.prepare('INSERT INTO users (id, name, email, password_hash, password_version, department, role, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run('admin-default', '관리자', 'admin@office.com', adminHash, 'bcrypt', '관리팀', 'admin', new Date().toISOString());
  console.log('[DB] 기본 관리자 계정 생성됨');
}

/* ═══════════════════════════════════════
   AUTH API
═══════════════════════════════════════ */
app.post('/api/auth/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: '이메일과 비밀번호를 입력하세요.' });
  const user = db.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)').get(email);
  if (!user) return res.status(401).json({ error: '등록되지 않은 이메일입니다.' });
  const version = user.password_version || 'sha256';
  const isValid = await verifyPassword(password, user.password_hash, version);
  if (!isValid) return res.status(401).json({ error: '비밀번호가 올바르지 않습니다.' });
  // SHA-256 → bcrypt 투명 업그레이드
  if (version === 'sha256') {
    const newHash = await hashPassword(password);
    db.prepare('UPDATE users SET password_hash=?, password_version=? WHERE id=?').run(newHash, 'bcrypt', user.id);
    console.log(`[Auth] 비밀번호 bcrypt 업그레이드: ${user.email}`);
  }
  const token = signToken(user);
  res.json({ token, user: mapUser(user) });
});

/* ═══════════════════════════════════════
   USERS API
═══════════════════════════════════════ */
function mapUser(u) {
  return { id: u.id, name: u.name, email: u.email, department: u.department, role: u.role, phone: u.phone || '', position: u.position || '', createdAt: u.created_at };
}

app.get('/api/users', authMiddleware, adminOnly, (_, res) => {
  res.json(db.prepare('SELECT * FROM users ORDER BY created_at').all().map(mapUser));
});

app.post('/api/users', authMiddleware, adminOnly, async (req, res) => {
  const { name, email, password, department, role, phone, position } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: '필수 항목을 입력하세요.' });
  if (password.length < 6) return res.status(400).json({ error: '비밀번호는 6자 이상이어야 합니다.' });
  if (db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)').get(email)) return res.status(400).json({ error: '이미 사용 중인 이메일입니다.' });
  const id = genId();
  const now = new Date().toISOString();
  const newHash = await hashPassword(password);
  db.prepare('INSERT INTO users (id, name, email, password_hash, password_version, department, role, phone, position, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, name, email, newHash, 'bcrypt', department || '', role || 'member', phone || '', position || '', now);
  // 주소록 자동 등록 (내부 직원)
  const existingContact = db.prepare('SELECT id FROM contacts WHERE email = ?').get(email);
  if (!existingContact) {
    const cid = 'contact_' + Date.now() + '_' + Math.random().toString(36).slice(2);
    db.prepare(`INSERT INTO contacts (id,name,company,department,position,email,phone,type,memo,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(cid, name, '', department || '', position || '', email, phone || '', 'internal', '', id, now, now);
  }
  res.json(mapUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id)));
});

app.put('/api/users/:id', authMiddleware, (req, res) => {
  const { id } = req.params;
  if (req.user.id !== id && req.user.role !== 'admin') return res.status(403).json({ error: '권한이 없습니다.' });
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
  const { name, department, role, phone, position } = req.body;
  db.prepare('UPDATE users SET name=?, department=?, role=?, phone=?, position=? WHERE id=?')
    .run(name ?? user.name, department ?? user.department, role ?? user.role, phone ?? user.phone ?? '', position ?? user.position ?? '', id);
  // 주소록도 동기화
  const now = new Date().toISOString();
  const contact = db.prepare('SELECT id FROM contacts WHERE email = ?').get(user.email);
  if (contact) {
    db.prepare('UPDATE contacts SET name=?, department=?, position=?, phone=?, updated_at=? WHERE id=?')
      .run(name ?? user.name, department ?? user.department, position ?? user.position ?? '', phone ?? user.phone ?? '', now, contact.id);
  }
  res.json(mapUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id)));
});

app.put('/api/users/:id/password', authMiddleware, async (req, res) => {
  const { id } = req.params;
  if (req.user.id !== id && req.user.role !== 'admin') return res.status(403).json({ error: '권한이 없습니다.' });
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
  const { oldPassword, newPassword } = req.body;
  if (req.user.role !== 'admin') {
    const version = user.password_version || 'sha256';
    const isValid = await verifyPassword(oldPassword, user.password_hash, version);
    if (!isValid) return res.status(401).json({ error: '현재 비밀번호가 올바르지 않습니다.' });
  }
  if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: '새 비밀번호는 6자 이상이어야 합니다.' });
  const newHash = await hashPassword(newPassword);
  db.prepare('UPDATE users SET password_hash=?, password_version=? WHERE id=?').run(newHash, 'bcrypt', id);
  res.json({ success: true });
});

app.delete('/api/users/:id', authMiddleware, adminOnly, (req, res) => {
  if (req.params.id === 'admin-default') return res.status(400).json({ error: '기본 관리자는 삭제할 수 없습니다.' });
  const user = db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id);
  if (user) db.prepare('DELETE FROM contacts WHERE email=? AND type=?').run(user.email, 'internal');
  db.prepare('DELETE FROM users WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

/* ═══════════════════════════════════════
   SCHEDULES API
═══════════════════════════════════════ */
function mapSchedule(s) {
  return {
    id: s.id, title: s.title, description: s.description || '',
    startDate: s.start_date, endDate: s.end_date, allDay: s.all_day === 1,
    category: s.category, priority: s.priority, location: s.location || '',
    attendees: JSON.parse(s.attendees || '[]'),
    createdAt: s.created_at, updatedAt: s.updated_at,
  };
}

app.get('/api/schedules', authMiddleware, (_, res) => {
  res.json(db.prepare('SELECT * FROM schedules WHERE deleted_at IS NULL ORDER BY start_date').all().map(mapSchedule));
});

app.post('/api/schedules', authMiddleware, (req, res) => {
  const { title, description, startDate, endDate, allDay, category, priority, location, attendees } = req.body;
  if (!title || !startDate || !endDate) return res.status(400).json({ error: '필수 항목을 입력하세요.' });
  const id = genId(); const now = new Date().toISOString();
  db.prepare('INSERT INTO schedules (id,title,description,start_date,end_date,all_day,category,priority,location,attendees,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .run(id, title, description || '', startDate, endDate, allDay ? 1 : 0, category || '기타', priority || 'medium', location || '', JSON.stringify(attendees || []), req.user.id, now, now);
  auditLog(req, 'create', 'schedule', id, { title });
  res.json(mapSchedule(db.prepare('SELECT * FROM schedules WHERE id=?').get(id)));
});

app.put('/api/schedules/:id', authMiddleware, (req, res) => {
  const { id } = req.params;
  const s = db.prepare('SELECT * FROM schedules WHERE id=? AND deleted_at IS NULL').get(id);
  if (!s) return res.status(404).json({ error: '일정을 찾을 수 없습니다.' });
  const now = new Date().toISOString();
  const b = req.body;
  db.prepare('UPDATE schedules SET title=?,description=?,start_date=?,end_date=?,all_day=?,category=?,priority=?,location=?,attendees=?,updated_at=? WHERE id=?')
    .run(b.title ?? s.title, b.description ?? s.description, b.startDate ?? s.start_date, b.endDate ?? s.end_date,
      b.allDay !== undefined ? (b.allDay ? 1 : 0) : s.all_day,
      b.category ?? s.category, b.priority ?? s.priority, b.location ?? s.location,
      JSON.stringify(b.attendees ?? JSON.parse(s.attendees || '[]')), now, id);
  auditLog(req, 'update', 'schedule', id, { title: b.title ?? s.title });
  res.json(mapSchedule(db.prepare('SELECT * FROM schedules WHERE id=?').get(id)));
});

app.delete('/api/schedules/:id', authMiddleware, (req, res) => {
  const row = db.prepare('SELECT * FROM schedules WHERE id=? AND deleted_at IS NULL').get(req.params.id);
  if (!row) return res.status(404).json({ error: '일정을 찾을 수 없습니다.' });
  db.prepare('UPDATE schedules SET deleted_at=? WHERE id=?').run(new Date().toISOString(), req.params.id);
  auditLog(req, 'delete', 'schedule', req.params.id, { title: row.title });
  res.json({ success: true });
});

/* ═══════════════════════════════════════
   GOOGLE CALENDAR API
═══════════════════════════════════════ */

/* Google 연동 상태 확인 */
app.get('/api/google/status', authMiddleware, (req, res) => {
  const user = db.prepare('SELECT google_email, google_access_token FROM users WHERE id=?').get(req.user.id);
  res.json({
    connected: !!(user && user.google_access_token),
    email: user?.google_email || null,
  });
});

/* OAuth 인증 URL 발급 (state에 JWT userId 인코딩) */
app.get('/api/google/auth', authMiddleware, (req, res) => {
  const oauth2 = makeOAuth2Client();
  const url = oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/calendar.events'],
    state: req.user.id,
  });
  res.json({ url });
});

/* OAuth 콜백 — 토큰 저장 후 팝업 닫기 */
app.get('/api/google/callback', async (req, res) => {
  const { code, state: userId } = req.query;
  if (!code || !userId) return res.status(400).send('잘못된 요청');

  try {
    const oauth2 = makeOAuth2Client();
    const { tokens } = await oauth2.getToken(code);
    oauth2.setCredentials(tokens);

    // 연결된 Google 계정 이메일 조회
    let googleEmail = null;
    try {
      const oauth2Api = google.oauth2({ version: 'v2', auth: oauth2 });
      const info = await oauth2Api.userinfo.get();
      googleEmail = info.data.email;
    } catch (_) {}

    db.prepare(`UPDATE users SET
      google_access_token  = ?,
      google_refresh_token = ?,
      google_token_expiry  = ?,
      google_email         = ?
      WHERE id = ?`)
      .run(
        tokens.access_token,
        tokens.refresh_token || null,
        tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
        googleEmail,
        userId
      );

    res.send(`<html><body><script>
      window.opener && window.opener.postMessage('google_connected','*');
      window.close();
    </script><p>Google Calendar 연동 완료! 창을 닫으세요.</p></body></html>`);
  } catch (e) {
    console.error('[Google OAuth]', e.message);
    res.status(500).send('인증 실패: ' + e.message);
  }
});

/* 연동 해제 */
app.post('/api/google/disconnect', authMiddleware, (req, res) => {
  db.prepare(`UPDATE users SET
    google_access_token=NULL, google_refresh_token=NULL,
    google_token_expiry=NULL, google_email=NULL
    WHERE id=?`).run(req.user.id);
  res.json({ success: true });
});

/* 일정 → Google Calendar 이벤트 동기화 헬퍼 */
async function syncToGoogleCalendar(userId, schedule) {
  const user = db.prepare('SELECT google_access_token, google_refresh_token, google_token_expiry FROM users WHERE id=?').get(userId);
  if (!user || !user.google_access_token) return; // 미연동이면 skip

  const oauth2 = makeOAuth2Client();
  oauth2.setCredentials({
    access_token:  user.google_access_token,
    refresh_token: user.google_refresh_token,
    expiry_date:   user.google_token_expiry ? new Date(user.google_token_expiry).getTime() : null,
  });

  // 토큰 갱신 시 DB 업데이트
  oauth2.on('tokens', (tokens) => {
    if (tokens.access_token) {
      db.prepare('UPDATE users SET google_access_token=?, google_token_expiry=? WHERE id=?')
        .run(tokens.access_token, tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null, userId);
    }
  });

  const calendar = google.calendar({ version: 'v3', auth: oauth2 });

  // 날짜 형식: "YYYY-MM-DD HH:mm" 또는 "YYYY-MM-DDTHH:mm" → RFC3339 (초 필수)
  const toRFC3339 = (s) => {
    if (!s) return null;
    // 공백을 T로 교체
    let clean = String(s).replace(' ', 'T');
    // 날짜만("YYYY-MM-DD")이면 그대로 반환
    if (clean.length === 10) return clean;
    // 이미 +timezone 포함이면 초만 보완
    if (clean.includes('+') || clean.includes('Z')) {
      // HH:mm+09:00 → HH:mm:00+09:00
      return clean.replace(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})(\+|Z)/, '$1:00$2');
    }
    // "YYYY-MM-DDTHH:mm" → "YYYY-MM-DDTHH:mm:00+09:00"
    if (clean.length === 16) clean = clean + ':00';
    return clean + '+09:00';
  };

  const event = {
    summary: schedule.title,
    location: schedule.location || '',
    description: schedule.description || '',
    start: schedule.allDay
      ? { date: String(schedule.startDate).slice(0, 10) }
      : { dateTime: toRFC3339(schedule.startDate), timeZone: 'Asia/Seoul' },
    end: schedule.allDay
      ? { date: String(schedule.endDate).slice(0, 10) }
      : { dateTime: toRFC3339(schedule.endDate), timeZone: 'Asia/Seoul' },
  };

  await calendar.events.insert({ calendarId: 'primary', requestBody: event });
}

/* 개별 일정을 Google Calendar에 즉시 동기화 (프론트에서 호출 가능) */
app.post('/api/google/sync-event', authMiddleware, async (req, res) => {
  try {
    await syncToGoogleCalendar(req.user.id, req.body);
    res.json({ success: true });
  } catch (e) {
    console.error('[Google Sync]', e.message);
    res.status(500).json({ error: 'Google Calendar 동기화 실패: ' + e.message });
  }
});

/* ═══════════════════════════════════════
   WEEKLY REPORTS API
═══════════════════════════════════════ */
function mapReport(r) {
  return {
    id: r.id, weekStart: r.week_start, weekEnd: r.week_end,
    author: r.author, department: r.department,
    completedTasks: JSON.parse(r.completed_tasks || '[]'),
    inProgressTasks: JSON.parse(r.in_progress_tasks || '[]'),
    nextWeekTasks: JSON.parse(r.next_week_tasks || '[]'),
    issues: r.issues || '', notes: r.notes || '',
    status: r.status, aiSummary: r.ai_summary || undefined,
    approvalStatus: r.approval_status || null,
    approvalComment: r.approval_comment || null,
    approvedBy: r.approved_by || null,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

app.get('/api/reports', authMiddleware, (_, res) => {
  res.json(db.prepare('SELECT * FROM weekly_reports WHERE deleted_at IS NULL ORDER BY week_start DESC').all().map(mapReport));
});

app.post('/api/reports', authMiddleware, (req, res) => {
  const { weekStart, weekEnd, author, department, completedTasks, inProgressTasks, nextWeekTasks, issues, notes, status } = req.body;
  if (!weekStart || !weekEnd || !author || !department) return res.status(400).json({ error: '필수 항목을 입력하세요.' });
  const id = genId(); const now = new Date().toISOString();
  db.prepare('INSERT INTO weekly_reports (id,week_start,week_end,author,department,completed_tasks,in_progress_tasks,next_week_tasks,issues,notes,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .run(id, weekStart, weekEnd, author, department,
      JSON.stringify(completedTasks || []), JSON.stringify(inProgressTasks || []), JSON.stringify(nextWeekTasks || []),
      issues || '', notes || '', status || '작성중', now, now);
  res.json(mapReport(db.prepare('SELECT * FROM weekly_reports WHERE id=?').get(id)));
});

app.put('/api/reports/:id', authMiddleware, (req, res) => {
  const { id } = req.params;
  const r = db.prepare('SELECT * FROM weekly_reports WHERE id=? AND deleted_at IS NULL').get(id);
  if (!r) return res.status(404).json({ error: '보고서를 찾을 수 없습니다.' });
  const now = new Date().toISOString(); const b = req.body;
  db.prepare('UPDATE weekly_reports SET week_start=?,week_end=?,author=?,department=?,completed_tasks=?,in_progress_tasks=?,next_week_tasks=?,issues=?,notes=?,status=?,ai_summary=?,updated_at=? WHERE id=?')
    .run(b.weekStart ?? r.week_start, b.weekEnd ?? r.week_end, b.author ?? r.author, b.department ?? r.department,
      JSON.stringify(b.completedTasks ?? JSON.parse(r.completed_tasks || '[]')),
      JSON.stringify(b.inProgressTasks ?? JSON.parse(r.in_progress_tasks || '[]')),
      JSON.stringify(b.nextWeekTasks ?? JSON.parse(r.next_week_tasks || '[]')),
      b.issues ?? r.issues, b.notes ?? r.notes, b.status ?? r.status,
      b.aiSummary !== undefined ? b.aiSummary : r.ai_summary, now, id);
  res.json(mapReport(db.prepare('SELECT * FROM weekly_reports WHERE id=?').get(id)));
});

app.delete('/api/reports/:id', authMiddleware, (req, res) => {
  const row = db.prepare('SELECT * FROM weekly_reports WHERE id=? AND deleted_at IS NULL').get(req.params.id);
  if (!row) return res.status(404).json({ error: '보고서를 찾을 수 없습니다.' });
  db.prepare('UPDATE weekly_reports SET deleted_at=? WHERE id=?').run(new Date().toISOString(), req.params.id);
  auditLog(req, 'delete', 'report', req.params.id, { weekStart: row.week_start, author: row.author });
  res.json({ success: true });
});

// 승인/반려 (관리자·팀장 전용)
app.post('/api/reports/:id/approve', authMiddleware, (req, res) => {
  if (!['admin', 'manager'].includes(req.user.role)) return res.status(403).json({ error: '권한이 없습니다.' });
  const r = db.prepare('SELECT * FROM weekly_reports WHERE id=?').get(req.params.id);
  if (!r) return res.status(404).json({ error: '보고서를 찾을 수 없습니다.' });
  const { action, comment } = req.body; // action: 'approve' | 'reject'
  if (!['approve', 'reject'].includes(action)) return res.status(400).json({ error: 'action은 approve 또는 reject여야 합니다.' });
  const now = new Date().toISOString();
  db.prepare('UPDATE weekly_reports SET approval_status=?, approval_comment=?, approved_by=?, updated_at=? WHERE id=?')
    .run(action === 'approve' ? '승인' : '반려', comment ?? null, req.user.name, now, req.params.id);
  // 작성자에게 알림 (작성자 id 조회)
  const authorUser = db.prepare('SELECT id FROM users WHERE name=?').get(r.author);
  if (authorUser) {
    const isApprove = action === 'approve';
    pushNotif(
      authorUser.id,
      isApprove ? 'report_approved' : 'report_rejected',
      isApprove ? '주간보고가 승인되었습니다' : '주간보고가 반려되었습니다',
      `${r.department} ${r.week_start}~${r.week_end}${comment ? ' · ' + comment : ''}`,
      '/weekly-report'
    );
  }
  res.json(mapReport(db.prepare('SELECT * FROM weekly_reports WHERE id=?').get(req.params.id)));
});

/* ═══════════════════════════════════════
   DOCUMENTS API
═══════════════════════════════════════ */
function mapDocument(d) {
  return {
    id: d.id, title: d.title, content: d.content || '',
    category: d.category, tags: JSON.parse(d.tags || '[]'),
    createdAt: d.created_at, updatedAt: d.updated_at,
  };
}

app.get('/api/documents', authMiddleware, (req, res) => {
  const { q, tag } = req.query;

  // FTS5 전문 검색
  if (q) {
    try {
      const safeQ = q.replace(/["*^()]/g, '').trim();
      const rows = db.prepare(
        'SELECT d.* FROM documents d JOIN documents_fts f ON d.id = f.id WHERE documents_fts MATCH ? AND d.deleted_at IS NULL ORDER BY rank'
      ).all(safeQ + '*');
      return res.json(rows.map(mapDocument));
    } catch {
      const p = `%${q}%`;
      return res.json(
        db.prepare('SELECT * FROM documents WHERE (title LIKE ? OR content LIKE ?) AND deleted_at IS NULL ORDER BY updated_at DESC').all(p, p).map(mapDocument)
      );
    }
  }

  // json_each 태그 필터링
  if (tag) {
    try {
      const rows = db.prepare(
        'SELECT DISTINCT d.* FROM documents d, json_each(d.tags) t WHERE t.value = ? AND d.deleted_at IS NULL ORDER BY d.updated_at DESC'
      ).all(tag);
      return res.json(rows.map(mapDocument));
    } catch {
      const p = `%"${tag}"%`;
      return res.json(
        db.prepare('SELECT * FROM documents WHERE tags LIKE ? AND deleted_at IS NULL ORDER BY updated_at DESC').all(p).map(mapDocument)
      );
    }
  }

  res.json(db.prepare('SELECT * FROM documents WHERE deleted_at IS NULL ORDER BY updated_at DESC').all().map(mapDocument));
});

app.post('/api/documents', authMiddleware, (req, res) => {
  const { title, content, category, tags } = req.body;
  if (!title) return res.status(400).json({ error: '제목을 입력하세요.' });
  const id = genId(); const now = new Date().toISOString();
  db.prepare('INSERT INTO documents (id,title,content,category,tags,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)')
    .run(id, title, content || '', category || '기타', JSON.stringify(tags || []), req.user.id, now, now);
  auditLog(req, 'create', 'document', id, { title });
  res.json(mapDocument(db.prepare('SELECT * FROM documents WHERE id=?').get(id)));
});

app.put('/api/documents/:id', authMiddleware, (req, res) => {
  const { id } = req.params;
  const d = db.prepare('SELECT * FROM documents WHERE id=? AND deleted_at IS NULL').get(id);
  if (!d) return res.status(404).json({ error: '문서를 찾을 수 없습니다.' });
  const now = new Date().toISOString(); const b = req.body;
  db.prepare('UPDATE documents SET title=?,content=?,category=?,tags=?,updated_at=? WHERE id=?')
    .run(b.title ?? d.title, b.content ?? d.content, b.category ?? d.category, JSON.stringify(b.tags ?? JSON.parse(d.tags || '[]')), now, id);
  auditLog(req, 'update', 'document', id, { title: b.title ?? d.title });
  res.json(mapDocument(db.prepare('SELECT * FROM documents WHERE id=?').get(id)));
});

app.delete('/api/documents/:id', authMiddleware, (req, res) => {
  const row = db.prepare('SELECT * FROM documents WHERE id=? AND deleted_at IS NULL').get(req.params.id);
  if (!row) return res.status(404).json({ error: '문서를 찾을 수 없습니다.' });
  db.prepare('UPDATE documents SET deleted_at=? WHERE id=?').run(new Date().toISOString(), req.params.id);
  auditLog(req, 'delete', 'document', req.params.id, { title: row.title });
  res.json({ success: true });
});

/* ═══════════════════════════════════════
   AI SUMMARIES API
═══════════════════════════════════════ */
function mapSummary(s) {
  return {
    id: s.id, title: s.title, originalText: s.original_text,
    summaryText: s.summary_text, keywords: JSON.parse(s.keywords || '[]'),
    actionItems: JSON.parse(s.action_items || '[]'), type: s.type, createdAt: s.created_at,
  };
}

app.get('/api/ai-summaries', authMiddleware, (req, res) => {
  res.json(db.prepare('SELECT * FROM ai_summaries WHERE created_by=? ORDER BY created_at DESC').all(req.user.id).map(mapSummary));
});

app.post('/api/ai-summaries', authMiddleware, (req, res) => {
  const { title, originalText, summaryText, keywords, actionItems, type } = req.body;
  if (!title || !originalText) return res.status(400).json({ error: '필수 항목을 입력하세요.' });
  const id = genId(); const now = new Date().toISOString();
  db.prepare('INSERT INTO ai_summaries (id,title,original_text,summary_text,keywords,action_items,type,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(id, title, originalText, summaryText || '', JSON.stringify(keywords || []), JSON.stringify(actionItems || []), type || '기타', req.user.id, now);
  res.json(mapSummary(db.prepare('SELECT * FROM ai_summaries WHERE id=?').get(id)));
});

app.delete('/api/ai-summaries/:id', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM ai_summaries WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

/* ═══════════════════════════════════════
   Ollama AI API
═══════════════════════════════════════ */
const OLLAMA_HOST = 'localhost';
const OLLAMA_PORT = 11434;
const DEFAULT_MODEL = 'qwen2.5:7b';

const KOREAN_SYSTEM = '당신은 한국어 전문 AI 어시스턴트입니다. 반드시 한국어(Korean)로만 답변하세요. 중국어(Chinese), 영어(English), 일본어(Japanese) 등 다른 언어는 절대 사용하지 마세요. 모든 출력은 한국어여야 합니다.';

const LANG_SYSTEM = {
  ko: KOREAN_SYSTEM,
  en: 'You are a professional AI assistant. You must respond ONLY in English. Do not use Chinese, Korean, or any other language. All output must be in English.',
  ja: 'あなたはプロのAIアシスタントです。必ず日本語のみで回答してください。他の言語は使用しないでください。',
  auto: null, // 모델이 입력 언어에 맞춰 자동 선택
};

const LANG_LABEL = { ko: '한국어', en: 'English', ja: '日本語', auto: '자동' };

function getLangSystem(lang) {
  return LANG_SYSTEM[lang] ?? KOREAN_SYSTEM;
}

function buildLangInstruction(lang) {
  if (lang === 'ko')   return '[언어 규칙] 반드시 한국어로만 작성하세요. 중국어 사용 금지.';
  if (lang === 'en')   return '[Language Rule] Respond ONLY in English. Do NOT use Chinese or Korean.';
  if (lang === 'ja')   return '[言語ルール] 必ず日本語のみで回答してください。中国語禁止。';
  if (lang === 'auto') return '[언어 규칙] 입력 언어에 맞는 언어로 자연스럽게 답변하세요.';
  return '[언어 규칙] 반드시 한국어로만 작성하세요. 중국어 사용 금지.';
}

function ollamaGenerate(model, prompt, system = KOREAN_SYSTEM, opts = {}) {
  return new Promise((resolve, reject) => {
    const timeout = opts.timeout || 300000;
    const bodyObj = { model, prompt, system, stream: false, keep_alive: -1 };
    if (opts.num_predict) bodyObj.options = { ...(bodyObj.options||{}), num_predict: opts.num_predict };
    if (opts.num_ctx) bodyObj.options = { ...(bodyObj.options||{}), num_ctx: opts.num_ctx };
    if (opts.temperature !== undefined) bodyObj.options = { ...(bodyObj.options||{}), temperature: opts.temperature };
    const body = JSON.stringify(bodyObj);
    const req = nodeHttp.request(
      { hostname: OLLAMA_HOST, port: OLLAMA_PORT, path: '/api/generate', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } },
      (res) => { let data = ''; res.on('data', (c) => { data += c; }); res.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { reject(e); } }); }
    );
    req.on('error', reject);
    req.setTimeout(timeout, () => { req.destroy(new Error('Ollama 요청 타임아웃')); });
    req.write(body); req.end();
  });
}

function ollamaGetTags() {
  return new Promise((resolve, reject) => {
    const req = nodeHttp.request(
      { hostname: OLLAMA_HOST, port: OLLAMA_PORT, path: '/api/tags', method: 'GET' },
      (res) => { let data = ''; res.on('data', (c) => { data += c; }); res.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { reject(e); } }); }
    );
    req.on('error', reject); req.setTimeout(5000, () => { req.destroy(new Error('Timeout')); }); req.end();
  });
}

function buildSummaryPrompt(type, title, text, lang = 'ko') {
  const guide = { '회의록': '회의에서 논의된 핵심 내용을 요약하고 결정사항과 액션 아이템을 추출하세요.', '보고서': '핵심 내용과 주요 성과/이슈를 요약하세요.', '이메일': '주요 요청 사항과 핵심 메시지를 요약하세요.', '문서': '핵심 내용을 간결하게 요약하세요.', '기타': '내용을 핵심 위주로 요약하세요.' };
  const langRule = buildLangInstruction(lang);
  const resultLabel = lang === 'en' ? '[Summary Result]:' : lang === 'ja' ? '[要約結果]:' : '[요약 결과]:';
  return `${langRule}\n\n아래 ${type}을 요약해주세요.\n\n[지침]\n- ${guide[type] || guide['문서']}\n- 3~5개의 핵심 포인트를 불릿 포인트(•)로 정리\n\n[제목] ${title}\n[원본 내용]\n${text}\n\n${resultLabel}`;
}

function buildReportSummaryPrompt(report) {
  const lines = [`[부서] ${report.department}`, `[기간] ${report.weekStart} ~ ${report.weekEnd}`];
  if (report.completedTasks?.length) { lines.push('\n[완료 업무]'); report.completedTasks.forEach((t, i) => lines.push(`${i + 1}. ${t.content}`)); }
  if (report.inProgressTasks?.length) { lines.push('\n[진행 중]'); report.inProgressTasks.forEach((t, i) => lines.push(`${i + 1}. ${t.content} (${t.progress}%)`)); }
  if (report.nextWeekTasks?.length) { lines.push('\n[다음 주]'); report.nextWeekTasks.forEach((t, i) => lines.push(`${i + 1}. ${t.content}`)); }
  if (report.issues) lines.push(`\n[이슈]\n${report.issues}`);
  return `[언어 규칙] 반드시 한국어로만 작성하세요. 중국어 사용 금지.\n\n아래 주간 업무 보고서를 한국어로 3~5줄로 요약해주세요.\n\n${lines.join('\n')}\n\n[요약 결과] (반드시 한국어로 작성):`;
}

app.get('/api/ai/status', async (_, res) => {
  try { const data = await ollamaGetTags(); res.json({ available: true, models: (data.models || []).map((m) => m.name) }); }
  catch { res.json({ available: false, models: [] }); }
});

app.post('/api/ai/summarize', async (req, res) => {
  const { text, type = '문서', title = '문서', lang = 'ko' } = req.body;
  if (!text || text.trim().length < 10) return res.status(400).json({ error: '내용이 너무 짧습니다.' });
  try {
    const data = await ollamaGenerate(DEFAULT_MODEL, buildSummaryPrompt(type, title, text, lang), getLangSystem(lang));
    res.json({ summary: data.response || '' });
  }
  catch { res.status(503).json({ error: 'Ollama 서버에 연결할 수 없습니다.', guide: 'ollama serve 명령으로 실행하세요.' }); }
});

app.post('/api/ai/report-summary', async (req, res) => {
  const { report } = req.body;
  if (!report) return res.status(400).json({ error: '보고서 데이터가 없습니다.' });
  try { const data = await ollamaGenerate(DEFAULT_MODEL, buildReportSummaryPrompt(report)); res.json({ summary: data.response || '' }); }
  catch { res.status(503).json({ error: 'Ollama 서버에 연결할 수 없습니다.', guide: 'ollama serve 명령으로 실행하세요.' }); }
});

/* ═══════════════════════════════════════
   AI CHATBOT
═══════════════════════════════════════ */

function buildDocumentContentPrompt(title, category, userRequest) {
  const templates = {
    '회의록': `# 회의록: ${title}

## 회의 개요
- **일시**: 
- **장소**: 
- **참석자**: 
- **작성자**: 

## 안건
1. 
2. 

## 논의 내용

### 안건 1

### 안건 2

## 결정 사항
- 

## 액션 아이템
| 담당자 | 내용 | 기한 |
|--------|------|------|
|  |  |  |

## 다음 회의 예정
- 일시: 
- 안건: `,

    '보고서': `# ${title}

## 1. 개요

## 2. 현황 분석

## 3. 주요 내용

### 3.1 세부 항목

### 3.2 관련 데이터

## 4. 문제점 및 개선 방안

## 5. 결론 및 제언

## 첨부 자료`,

    '계획서': `# ${title}

## 1. 목적 및 배경

## 2. 목표
- 정량 목표: 
- 정성 목표: 

## 3. 추진 계획

### 3.1 단계별 추진 내용
| 단계 | 내용 | 기간 | 담당 |
|------|------|------|------|
| 1단계 |  |  |  |
| 2단계 |  |  |  |

## 4. 예산 계획
| 항목 | 금액 | 비고 |
|------|------|------|

## 5. 기대 효과

## 6. 리스크 및 대응 방안`,

    '제안서': `# ${title}

## 1. 제안 배경

## 2. 현황 및 문제점

## 3. 제안 내용

### 3.1 핵심 제안

### 3.2 세부 내용

## 4. 기대 효과

## 5. 실행 방안 및 일정

## 6. 소요 예산

## 7. 결론`,

    '매뉴얼': `# ${title}

## 1. 개요
- **목적**: 
- **적용 범위**: 
- **작성일**: 

## 2. 용어 정의

## 3. 기본 절차

### 3.1 사전 준비

### 3.2 실행 단계

### 3.3 완료 처리

## 4. 주의사항

## 5. FAQ

## 6. 개정 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|`,
  };

  const baseTemplate = templates[category] || `# ${title}\n\n## 개요\n\n## 주요 내용\n\n## 결론`;

  return `아래 요청을 기반으로 "${category}" 문서를 한국어로 작성해주세요.

**사용자 요청**: ${userRequest}
**문서 제목**: ${title}
**문서 유형**: ${category}

템플릿 구조를 활용해 각 섹션에 요청 내용에 맞는 구체적이고 실용적인 내용을 채워서 완성된 마크다운 문서를 작성하세요.
불필요한 설명 없이 문서 내용만 출력하세요. 각 섹션은 최소 2~4문장 이상 충분히 작성하세요.

${baseTemplate}`;
}

// 카테고리 유사어 정규화
function normalizeDocCategory(raw) {
  const map = {
    '기획서': '계획서', '기획안': '계획서', '사업계획서': '계획서', '프로젝트계획서': '계획서',
    '업무보고': '보고서', '결과보고서': '보고서', '주간보고': '보고서', '월간보고': '보고서',
    '회의록': '회의록', '미팅노트': '회의록', '회의노트': '회의록',
    '제안서': '제안서', '사업제안서': '제안서', '서비스제안서': '제안서',
    '매뉴얼': '매뉴얼', '가이드': '매뉴얼', '운영매뉴얼': '매뉴얼', '사용설명서': '매뉴얼',
  };
  const key = (raw || '').replace(/\s/g, '');
  return map[key] || raw || '기타';
}

function buildChatSystemPrompt(today, dbCtx = {}) {
  // 오늘 기준 이번 주 날짜 계산
  const d = new Date(today);
  const dow = d.getDay(); // 0=일,1=월,...,6=토
  const weekDays = {};
  const dayNames = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  const dayNamesKo = ['일요일','월요일','화요일','수요일','목요일','금요일','토요일'];
  for (let i = 0; i < 7; i++) {
    const dd = new Date(d);
    dd.setDate(d.getDate() - dow + i);
    const fmt = dd.toISOString().slice(0, 10);
    weekDays[dayNames[i]] = fmt;
    weekDays[dayNamesKo[i]] = fmt;
  }
  const weekInfo = Object.entries(weekDays).map(([k,v]) => `  "${k}": "${v}"`).join('\n');

  // DB 컨텍스트 정보 구성
  let ctxSection = '\n[현재 사내 현황 — 이 정보를 활용해 자연스럽게 답변하세요]\n';
  if (dbCtx.todaySchedules && dbCtx.todaySchedules.length > 0) {
    ctxSection += `오늘 일정 (${today}): ${dbCtx.todaySchedules.length}건\n`;
    dbCtx.todaySchedules.forEach(s => {
      const time = (s.start_date || '').slice(11, 16) || '종일';
      ctxSection += `  - ${s.title} (${time})\n`;
    });
  } else {
    ctxSection += `오늘 일정 (${today}): 없음\n`;
  }
  if (dbCtx.pendingApprovals !== undefined) {
    ctxSection += `결재 대기: ${dbCtx.pendingApprovals}건\n`;
  }
  if (dbCtx.recentNotices && dbCtx.recentNotices.length > 0) {
    ctxSection += `최근 공지사항: ${dbCtx.recentNotices.length}건\n`;
    dbCtx.recentNotices.forEach(n => { ctxSection += `  - ${n.title}\n`; });
  }

  return `당신은 한국 회사의 오피스 AI 어시스턴트입니다. 오늘 날짜: ${today}
${ctxSection}
이번 주 요일별 날짜:
${weekInfo}

사용자의 메시지를 분석하여 아래 JSON 형식으로만 응답하세요. 다른 텍스트는 절대 추가하지 마세요.

{"message":"사용자에게 보낼 자연스러운 한국어 응답","action":null}

또는 액션이 필요한 경우:
{"message":"응답 메시지","action":{"type":"액션타입","data":{...}}}

[action.type 종류]
1. "create_schedule" - 회의/미팅/약속/일정 추가 감지 시
   data: {
     "title":"일정 제목",
     "startDate":"yyyy-MM-dd HH:mm",
     "endDate":"yyyy-MM-dd HH:mm",
     "category":"회의|업무|교육|출장|개인|기타",
     "location":"장소 (없으면 빈 문자열)",
     "description":"설명",
     "allDay":false
   }

2. "create_document" - 회의록/문서/보고서/기획서/계획서/제안서/매뉴얼 작성 요청 시
   data: {
     "title":"문서 제목 (구체적으로)",
     "content":"(비워도 됨 - 서버에서 별도 생성)",
     "category":"회의록|보고서|계획서|제안서|매뉴얼|기타",
     "tags":["관련태그1","관련태그2"]
   }
   - 키워드 예시: "신제품 출시 기획서" → title:"신제품 출시 기획서", category:"계획서"
   - 키워드 예시: "팀 회의록" → title:"팀 회의록", category:"회의록"

3. "show_schedules" - 일정 조회 요청 시
   data: {
     "period": "today|monday|tuesday|wednesday|thursday|friday|saturday|sunday|week|month",
     "date": "특정 날짜면 yyyy-MM-dd, 없으면 null"
   }
   - "오늘 일정" → period:"today"
   - "이번주 목요일" → period:"thursday"
   - "이번 주 일정" → period:"week"
   - "이번 달 일정" → period:"month"

4. "show_approvals" - 결재 현황/대기 조회 요청 시 (예: "결재 대기", "내 결재", "승인 대기")
   data: {}

5. "show_notices" - 공지사항 조회 요청 시 (예: "공지사항 알려줘", "최근 공지")
   data: {}

[날짜 파싱 규칙]
- "오늘"=${today}, "내일"=내일 날짜 계산
- "이번주 목요일", "목요일" → 이번 주 목요일 날짜 사용
- "다음주 월요일" → 다음 주 월요일 계산
- 시간 없으면 allDay:true, endDate=startDate+1시간
- "오후 2시"=14:00, "오전 10시"=10:00

[절대 규칙]
- 반드시 한국어로만 응답하세요. 중국어(한자) 사용 절대 금지.
- JSON 형식 외 다른 텍스트 출력 금지.
- message 필드의 내용은 반드시 한국어 문장이어야 합니다.
- 你必须只用韩语回答。禁止使用中文。(이 줄은 규칙 설명이며 응답에 포함 금지)`;
}

app.post('/api/ai/chat', authMiddleware, async (req, res) => {
  const { messages, today } = req.body;
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: '메시지가 없습니다.' });
  }

  const todayDate = today || kstDateStr(); // KST 기준 오늘 날짜 YYYY-MM-DD
  const userId = req.user.id;
  const lastUser = messages.filter(m => m.role === 'user').at(-1)?.content ?? '';

  // ── DB 컨텍스트 조회 (오늘 일정, 결재 대기 수, 최근 공지) ──
  let dbCtx = {};
  try {
    const todaySchedules = db.prepare(
      `SELECT title, start_date FROM schedules WHERE deleted_at IS NULL AND date(start_date) = ? ORDER BY start_date LIMIT 10`
    ).all(todayDate);
    const pendingRow = db.prepare(
      `SELECT COUNT(*) as cnt FROM approval_steps asp JOIN approvals a ON a.id = asp.approval_id
       WHERE asp.approver_id = ? AND asp.status = 'pending' AND a.status = 'pending'`
    ).get(userId);
    const recentNotices = db.prepare(
      `SELECT title FROM notices ORDER BY created_at DESC LIMIT 5`
    ).all();
    dbCtx = { todaySchedules, pendingApprovals: pendingRow?.cnt || 0, recentNotices };
  } catch (_) { /* DB 조회 실패 시 빈 컨텍스트 */ }

  // ── 일정 조회 패턴: LLM 없이 즉시 DB 데이터 반환 ──
  const SCHEDULE_TODAY_RE = /오늘\s*(일정|스케줄|약속|할\s*일)|today\s*(schedule|일정)/i;
  const SCHEDULE_WEEK_RE  = /이번\s*주\s*(일정|스케줄)|이번주\s*(일정|스케줄)|주간\s*일정|week\s*(schedule|일정)/i;
  if (SCHEDULE_TODAY_RE.test(lastUser) || SCHEDULE_WEEK_RE.test(lastUser)) {
    try {
      const isWeek = SCHEDULE_WEEK_RE.test(lastUser);
      let rows;
      if (isWeek) {
        // KST 기준 이번 주 일~토
        const { weekStart: monStr, weekEnd: sunStr } = kstWeekRange();
        rows = db.prepare(
          `SELECT id, title, start_date, end_date, category, location FROM schedules
           WHERE deleted_at IS NULL AND date(end_date) >= ? AND date(start_date) <= ?
           ORDER BY start_date LIMIT 30`
        ).all(monStr, sunStr);
      } else {
        rows = db.prepare(
          `SELECT id, title, start_date, end_date, category, location FROM schedules
           WHERE deleted_at IS NULL AND date(start_date) <= ? AND date(end_date) >= ?
           ORDER BY start_date LIMIT 20`
        ).all(todayDate, todayDate);
      }
      const label = isWeek ? '이번 주' : '오늘';
      const cnt = rows.length;
      // 날짜 가독성 포맷: "5월 17일(토)" 또는 "5월 17일(토) 오후 3:00"
      const fmtDate = (dateStr) => {
        if (!dateStr) return '';
        const [datePart, timePart] = dateStr.replace('Z','').split('T');
        const [, mo, dy] = datePart.split('-').map(Number);
        const DAYS = ['일','월','화','수','목','금','토'];
        const dow = DAYS[new Date(datePart + 'T00:00').getDay()];
        const t = timePart ? timePart.slice(0,5) : '';
        let timeStr = '';
        if (t && t !== '00:00') {
          const h = parseInt(t, 10);
          const m = t.slice(3);
          timeStr = ` ${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${m}`;
        }
        return `${mo}월 ${dy}일(${dow})${timeStr}`;
      };
      const listText = cnt > 0
        ? rows.map(r => `• ${r.title} (${fmtDate(r.start_date)})${r.location ? ' @ ' + r.location : ''}`).join('\n')
        : '';
      return res.json({
        message: cnt > 0
          ? `${label} 일정 ${cnt}건입니다:\n${listText}`
          : `${label} 등록된 일정이 없습니다.`,
        action: { type: 'show_schedules', data: { period: isWeek ? 'week' : 'today', scheduleList: rows.map(r => ({
          id: String(r.id), title: r.title,
          startDate: r.start_date, endDate: r.end_date,
          category: r.category, location: r.location ?? ''
        })) } },
      });
    } catch (_) { /* fallback to LLM */ }
  }

  // ── 결재 조회 패턴: LLM 없이 즉시 DB 데이터 반환 ──
  const APPROVAL_QUERY_RE = /결재\s*(대기|확인|조회|알려줘|보여줘|목록|현황)|내\s*결재|승인\s*(대기|목록|현황)/;
  if (APPROVAL_QUERY_RE.test(lastUser)) {
    try {
      const pending = db.prepare(
        `SELECT a.id, a.title, a.type, a.author_name, a.created_at
         FROM approvals a JOIN approval_steps asp ON a.id = asp.approval_id
         WHERE asp.approver_id = ? AND asp.status = 'pending' AND a.status = 'pending'
         ORDER BY a.created_at DESC LIMIT 10`
      ).all(userId);
      const cnt = pending.length;
      return res.json({
        message: cnt > 0
          ? `결재 대기 중인 문서가 ${cnt}건 있습니다. 확인이 필요합니다.`
          : '현재 결재 대기 중인 문서가 없습니다.',
        action: { type: 'show_approvals', data: { approvals: pending } },
      });
    } catch (_) {}
  }

  // ── 공지사항 조회 패턴: LLM 없이 즉시 DB 데이터 반환 ──
  const NOTICE_QUERY_RE = /공지\s*(사항|확인|조회|알려줘|보여줘|목록)|최근\s*공지|공지사항\s*(뭐|무엇|어떤)/;
  if (NOTICE_QUERY_RE.test(lastUser)) {
    try {
      const notices = db.prepare(
        `SELECT id, title, author_name, is_pinned, created_at FROM notices ORDER BY is_pinned DESC, created_at DESC LIMIT 5`
      ).all();
      const cnt = notices.length;
      return res.json({
        message: cnt > 0
          ? `최근 공지사항 ${cnt}건을 확인하세요.`
          : '등록된 공지사항이 없습니다.',
        action: { type: 'show_notices', data: { notices } },
      });
    } catch (_) {}
  }

  // ── 문서 키워드 감지: LLM 호출 없이 즉시 문서 작성으로 진행 ──
  const DOC_PATTERNS = [
    { re: /회의록|회의\s*내용\s*(작성|써|만들|정리)|미팅\s*노트/,         category: '회의록' },
    { re: /보고서|업무\s*보고|주간\s*보고|월간\s*보고|결과\s*보고/,        category: '보고서' },
    { re: /계획서|기획서|기획안|사업\s*계획|프로젝트\s*계획|추진\s*계획/,   category: '계획서' },
    { re: /제안서|사업\s*제안|서비스\s*제안|제안\s*문서/,                   category: '제안서' },
    { re: /매뉴얼|가이드|사용\s*설명서|운영\s*매뉴얼|절차서/,              category: '매뉴얼' },
  ];
  const WRITE_VERB = /작성|써|만들|초안|작성해|써줘|만들어|정리/;
  const matched = DOC_PATTERNS.find(p => p.re.test(lastUser));

  if (matched && WRITE_VERB.test(lastUser)) {
    // 제목 추출: 동사 앞 단어들을 제목으로
    const titleMatch = lastUser.replace(/작성해줘|작성해|써줘|만들어줘|만들어|초안|작성|써|만들/g, '').trim();
    const docTitle = titleMatch || matched.category;
    const docCategory = matched.category;

    try {
      const docRes = await ollamaGenerate(
        DEFAULT_MODEL,
        buildDocumentContentPrompt(docTitle, docCategory, lastUser),
        '당신은 한국 회사의 전문 문서 작성 AI입니다. 마크다운 형식으로 완성도 높은 문서를 작성합니다.',
        { num_predict: 2000, num_ctx: 4096, temperature: 0.6, timeout: 120000 }
      );
      const generated = (docRes.response || '').trim();
      return res.json({
        message: `${docCategory}을(를) 작성했습니다. 내용을 확인하고 저장하세요.`,
        action: {
          type: 'create_document',
          data: {
            title: docTitle,
            content: generated.length > 50 ? generated : `# ${docTitle}\n\n내용을 입력하세요.`,
            category: docCategory,
            tags: [docCategory],
          },
        },
      });
    } catch (e) {
      return res.status(503).json({ error: 'AI 문서 생성 실패: ' + e.message, guide: 'Ollama가 실행 중인지 확인하세요.' });
    }
  }

  // ── 일반 대화 / 일정 등 기존 LLM 처리 ──
  const historyLines = messages.slice(-10).map(m =>
    m.role === 'user' ? `사용자: ${m.content}` : `AI: ${m.content}`
  ).join('\n');

  const prompt = `[SYSTEM] You MUST respond in Korean only. Never use Chinese characters.\n[대화 히스토리]\n${historyLines}\n\n[현재 요청]\n${lastUser}\n\n[응답] (반드시 한국어 JSON만 출력, 중국어 절대 금지):`;

  try {
    const data = await ollamaGenerate(
      DEFAULT_MODEL, prompt,
      buildChatSystemPrompt(todayDate, dbCtx),
      { num_predict: 1000, num_ctx: 3072, temperature: 0.4, timeout: 120000 }
    );

    let raw = (data.response || '').trim();
    let parsed;
    try {
      raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
      const start = raw.indexOf('{');
      const end = raw.lastIndexOf('}');
      if (start !== -1 && end !== -1) raw = raw.slice(start, end + 1);
      parsed = JSON.parse(raw);
    } catch {
      parsed = { message: raw || '죄송합니다, 응답을 처리할 수 없었습니다.', action: null };
    }

    // 중국어 감지 시 fallback
    const hasChinese = (str) => /[\u4e00-\u9fff\u3400-\u4dbf]/.test(str);
    if (hasChinese(parsed.message || '')) {
      parsed.message = '안녕하세요! 무엇을 도와드릴까요?';
    }

    // create_document 액션이면 카테고리 정규화 + 내용 생성
    if (parsed.action?.type === 'create_document') {
      // 카테고리 유사어 정규화 (기획서→계획서 등)
      const rawCat = String(parsed.action.data?.category ?? '기타');
      parsed.action.data.category = normalizeDocCategory(rawCat);

      const docContent = String(parsed.action.data?.content ?? '');
      if (docContent.length < 200) {
        const docTitle = String(parsed.action.data?.title ?? '문서');
        const docCategory = parsed.action.data.category;
        try {
          const docRes = await ollamaGenerate(
            DEFAULT_MODEL,
            buildDocumentContentPrompt(docTitle, docCategory, lastUser),
            '당신은 한국 회사의 전문 문서 작성 AI입니다. 마크다운 형식으로 완성도 높은 문서를 작성합니다.',
            { num_predict: 2000, num_ctx: 4096, temperature: 0.6, timeout: 90000 }
          );
          const generated = (docRes.response || '').trim();
          if (generated.length > 100) {
            parsed.action.data.content = generated;
          }
        } catch (_) { /* Ollama 오류 시 기존 content 유지 */ }
      }
    }

    res.json(parsed);
  } catch (err) {
    res.status(503).json({ error: 'Ollama 서버에 연결할 수 없습니다.', guide: 'ollama serve 명령으로 실행하세요.' });
  }
});

/* ═══════════════════════════════════════
   FILES API
═══════════════════════════════════════ */
function mapFile(f) {
  return {
    id: f.id, originalName: f.original_name, storedName: f.stored_name,
    mimeType: f.mime_type, size: f.size,
    relatedId: f.related_id, relatedType: f.related_type,
    createdBy: f.created_by, createdAt: f.created_at,
  };
}

/** 파일 업로드 (최대 5개 동시) */
app.post('/api/files/upload', authMiddleware, upload.array('files', 5), (req, res) => {
  if (!req.files || req.files.length === 0) return res.status(400).json({ error: '파일을 선택하세요.' });

  // 파일 용량 쿼터 체크
  const totalIncoming = req.files.reduce((s, f) => s + f.size, 0);
  const quota = checkFileQuota(req.user.id, totalIncoming);
  if (!quota.ok) {
    // 이미 저장된 임시 파일 삭제
    req.files.forEach(f => { try { fs.unlinkSync(f.path); } catch {} });
    return res.status(413).json({ error: quota.message });
  }

  const { relatedId, relatedType } = req.body;
  const now = new Date().toISOString();
  const saved = req.files.map((f) => {
    const id = genId();
    const origName = Buffer.from(f.originalname, 'latin1').toString('utf8');
    db.prepare('INSERT INTO files (id,original_name,stored_name,mime_type,size,related_id,related_type,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?)')
      .run(id, origName, f.filename, f.mimetype, f.size, relatedId || null, relatedType || null, req.user.id, now);
    return mapFile(db.prepare('SELECT * FROM files WHERE id=?').get(id));
  });
  res.json(saved);
});

/** 특정 엔티티에 연결된 파일 목록 */
app.get('/api/files', authMiddleware, (req, res) => {
  const { relatedId, relatedType } = req.query;
  let rows;
  if (relatedId && relatedType) {
    rows = db.prepare('SELECT * FROM files WHERE related_id=? AND related_type=? ORDER BY created_at DESC').all(relatedId, relatedType);
  } else {
    rows = db.prepare('SELECT * FROM files WHERE created_by=? ORDER BY created_at DESC').all(req.user.id);
  }
  res.json(rows.map(mapFile));
});

/** 파일 다운로드 */
app.get('/api/files/:id/download', authMiddleware, (req, res) => {
  const file = db.prepare('SELECT * FROM files WHERE id=?').get(req.params.id);
  if (!file) return res.status(404).json({ error: '파일을 찾을 수 없습니다.' });
  const filePath = path.join(UPLOAD_DIR, file.stored_name);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: '파일이 서버에 존재하지 않습니다.' });
  const isImage = (file.mime_type || '').startsWith('image/');
  if (isImage) {
    res.setHeader('Content-Type', file.mime_type);
    res.sendFile(filePath);
  } else {
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.original_name)}`);
    res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
    res.sendFile(filePath);
  }
});

/** 파일 삭제 */
app.delete('/api/files/:id', authMiddleware, (req, res) => {
  const file = db.prepare('SELECT * FROM files WHERE id=?').get(req.params.id);
  if (!file) return res.status(404).json({ error: '파일을 찾을 수 없습니다.' });
  if (file.created_by !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: '권한이 없습니다.' });
  const filePath = path.join(UPLOAD_DIR, file.stored_name);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  db.prepare('DELETE FROM files WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

/* ═══════════════════════════════════════
   AI 자동 문서화 API
═══════════════════════════════════════ */

/** 파일에서 텍스트 추출 */
async function extractText(filePath, mimeType, originalName) {
  const ext = path.extname(originalName).toLowerCase();

  // TXT
  if (mimeType === 'text/plain' || ext === '.txt') {
    return fs.readFileSync(filePath, 'utf-8');
  }

  // PDF
  if (mimeType === 'application/pdf' || ext === '.pdf') {
    // 1단계: pdf-parse로 텍스트 추출 시도
    try {
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(fs.readFileSync(filePath));
      if (data.text && data.text.trim().length >= 10) {
        return data.text;
      }
    } catch (e) {
      console.warn('[extractText] pdf-parse 실패:', e.message);
    }

    // 2단계: OCR (스캔 이미지 PDF) — node-poppler + tesseract.js
    try {
      console.log('[extractText] 텍스트 레이어 없음, OCR 시도...');
      const { Poppler } = require('node-poppler');
      const { createWorker } = require('tesseract.js');

      const poppler = new Poppler();
      const ppmBase = filePath.replace(/\.pdf$/i, '_ocr_page');

      // PDF → PNG 이미지 변환 (최대 10페이지, 150dpi)
      await poppler.pdfToPpm(filePath, ppmBase, {
        pngFile: true,
        resolutionXYAxis: 150,
        firstPageToConvert: 1,
        lastPageToConvert: 10,
      });

      const dir = path.dirname(ppmBase);
      const base = path.basename(ppmBase);
      const images = fs.readdirSync(dir)
        .filter(f => f.startsWith(base) && f.endsWith('.png'))
        .sort()
        .map(f => path.join(dir, f));

      if (images.length === 0) throw new Error('OCR_NO_IMAGE');

      const worker = await createWorker('kor+eng');
      let ocrText = '';
      for (const imgPath of images) {
        const { data } = await worker.recognize(imgPath);
        ocrText += data.text + '\n';
        try { fs.unlinkSync(imgPath); } catch {}
      }
      await worker.terminate();

      if (!ocrText || ocrText.trim().length < 10) throw new Error('OCR_EMPTY');
      console.log('[extractText] OCR 완료, 추출 텍스트 길이:', ocrText.trim().length);
      return ocrText;
    } catch (ocrErr) {
      if (ocrErr.message === 'OCR_NO_IMAGE' || ocrErr.message === 'OCR_EMPTY') {
        throw new Error('이 PDF에서 텍스트를 추출할 수 없습니다. DOCX 또는 TXT 파일로 변환 후 다시 시도해주세요.');
      }
      console.error('[extractText] OCR 오류:', ocrErr.message);
      throw new Error('PDF OCR 처리 실패: ' + ocrErr.message);
    }
  }

  // DOCX / DOC
  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimeType === 'application/msword' || ext === '.docx' || ext === '.doc'
  ) {
    try {
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ path: filePath });
      return result.value;
    } catch { return ''; }
  }

  // XLSX (Excel)
  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    ext === '.xlsx'
  ) {
    try {
      const AdmZip = require('adm-zip');
      const zip = new AdmZip(filePath);
      const sharedEntry = zip.getEntry('xl/sharedStrings.xml');
      const sharedStrings = sharedEntry
        ? (sharedEntry.getData().toString('utf-8').match(/<t[^>]*>([\s\S]*?)<\/t>/g) || [])
          .map((item) => item.replace(/<[^>]+>/g, ''))
        : [];
      let text = '';
      zip.getEntries()
        .filter((entry) => /^xl\/worksheets\/sheet\d+\.xml$/.test(entry.entryName))
        .forEach((entry, idx) => {
          const xml = entry.getData().toString('utf-8');
          const rows = (xml.match(/<row[\s\S]*?<\/row>/g) || []).map((rowXml) => {
            const cells = rowXml.match(/<c[\s\S]*?<\/c>/g) || [];
            return cells.map((cellXml) => {
              const value = (cellXml.match(/<v>([\s\S]*?)<\/v>/) || [])[1] || '';
              return cellXml.includes(' t="s"') ? (sharedStrings[Number(value)] || '') : value;
            }).join(',');
          });
          const csv = rows.join('\n');
          if (csv.replace(/,/g, '').trim()) {
            text += `=== 시트: ${idx + 1} ===\n${csv}\n\n`;
          }
        });
      return text;
    } catch { return ''; }
  }

  // PPTX (PowerPoint — ZIP 기반 XML)
  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
    ext === '.pptx'
  ) {
    try {
      const AdmZip = require('adm-zip');
      const zip = new AdmZip(filePath);
      const slideEntries = zip.getEntries()
        .filter((e) => /^ppt\/slides\/slide\d+\.xml$/.test(e.entryName))
        .sort((a, b) => a.entryName.localeCompare(b.entryName));
      let text = '';
      slideEntries.forEach((entry, idx) => {
        const xml = entry.getData().toString('utf-8');
        const matches = xml.match(/<a:t[^>]*>([^<]*)<\/a:t>/g) || [];
        const slideText = matches.map((m) => m.replace(/<[^>]+>/g, '')).filter((t) => t.trim()).join(' ');
        if (slideText.trim()) text += `[슬라이드 ${idx + 1}]\n${slideText}\n\n`;
      });
      return text;
    } catch { return ''; }
  }

  // PPT (구형 바이너리) — 텍스트 추출 제한
  if (mimeType === 'application/vnd.ms-powerpoint' || ext === '.ppt') {
    return '[PPT 구형 형식] 텍스트 추출이 제한됩니다. PPTX 형식으로 저장 후 다시 업로드해주세요.';
  }

  // HWPX (한글 신형 — ZIP 기반 XML)
  if (ext === '.hwpx') {
    try {
      const AdmZip = require('adm-zip');
      const zip = new AdmZip(filePath);
      const sectionEntries = zip.getEntries()
        .filter((e) => /^Contents\/section\d+\.xml$/i.test(e.entryName))
        .sort((a, b) => a.entryName.localeCompare(b.entryName));
      let text = '';
      sectionEntries.forEach((entry) => {
        const xml = entry.getData().toString('utf-8');
        // <t> 태그에서 텍스트 추출
        const matches = xml.match(/<t[^>]*>([^<]+)<\/t>/g) || [];
        const t = matches.map((m) => m.replace(/<[^>]+>/g, '')).filter((s) => s.trim()).join('\n');
        if (t.trim()) text += t + '\n';
      });
      return text;
    } catch { return ''; }
  }

  // HWP (한글 구형 바이너리 OLE2) — 부분 지원
  if (ext === '.hwp') {
    try {
      // HWP 파일 내 UTF-16LE 텍스트 블록 스캔 (근사치 추출)
      const buf = fs.readFileSync(filePath);
      // HWP 헤더 시그니처 확인
      const sig = buf.slice(0, 4).toString('hex');
      if (sig !== 'd0cf11e0') {
        // 혹시 HWPX가 확장자만 .hwp인 경우
        throw new Error('not OLE2');
      }
      // UTF-16LE 문자열 스캔 (가독 텍스트 추출)
      let text = '';
      for (let i = 0; i < buf.length - 1; i++) {
        if (buf[i + 1] === 0x00 && buf[i] >= 0x20 && buf[i] < 0x7f) {
          let str = '';
          let j = i;
          while (j < buf.length - 1 && buf[j + 1] === 0x00 && buf[j] >= 0x20) {
            str += String.fromCharCode(buf[j]);
            j += 2;
          }
          if (str.length > 3) { text += str + ' '; i = j - 1; }
        }
      }
      return text.length > 50 ? text : '[HWP 구형 형식] 텍스트 추출이 제한됩니다. DOCX 또는 HWPX 형식으로 저장 후 다시 업로드해주세요.';
    } catch {
      return '[HWP 구형 형식] 텍스트 추출이 제한됩니다. DOCX 또는 HWPX 형식으로 저장 후 다시 업로드해주세요.';
    }
  }

  return '';
}

const AUTO_DOC_FORMATS = {
  '문서': `## 문서 개요\n(2~3줄 요약)\n\n## 주요 내용\n• (핵심 포인트 3~5개)\n\n## 세부 사항\n(상세 내용 정리)\n\n## 결론\n(결론 또는 다음 단계)`,
  '회의록': `## 회의 개요\n(일시, 참석자, 안건 요약)\n\n## 논의 내용\n• (주요 논의 사항 나열)\n\n## 결정 사항\n(합의된 내용)\n\n## 액션 아이템\n(담당자 / 기한 / 내용)`,
  '보고서': `## 요약\n(핵심 내용 2~3줄)\n\n## 현황 분석\n• (주요 현황)\n\n## 문제점 및 원인\n(분석 내용)\n\n## 개선 방안\n(제안 내용)\n\n## 결론\n(결론 및 기대 효과)`,
  '계획서': `## 추진 배경\n(배경 및 목적)\n\n## 추진 목표\n• (목표 항목)\n\n## 세부 추진 계획\n(단계별 계획)\n\n## 예상 일정\n(일정 및 마일스톤)\n\n## 기대 효과\n(효과 및 성과 지표)`,
  '제안서': `## 제안 배경\n(배경 및 필요성)\n\n## 제안 내용\n• (핵심 제안 사항)\n\n## 기대 효과\n(효과)\n\n## 추진 방안\n(실행 계획)\n\n## 결론\n(요약 및 요청 사항)`,
  '매뉴얼': `## 목적\n(문서 목적)\n\n## 적용 범위\n(적용 대상)\n\n## 주요 절차\n1. (단계별 설명)\n\n## 주의 사항\n• (주의 사항)\n\n## 참고 사항\n(추가 정보)`,
  '기타': `## 문서 개요\n(2~3줄 요약)\n\n## 주요 내용\n• (핵심 포인트 3~5개)\n\n## 세부 사항\n(상세 내용 정리)\n\n## 결론\n(결론 또는 다음 단계)`,
};

function buildAutoDocPrompt(fileName, text, category, lang = 'ko') {
  const format = AUTO_DOC_FORMATS[category] || AUTO_DOC_FORMATS['기타'];
  const langRule = buildLangInstruction(lang);
  const writeLang = lang === 'en' ? 'in English' : lang === 'ja' ? '日本語で' : '한국어로';
  return `${langRule}

아래 파일 내용을 분석하여 [${category}] 형식의 업무 문서로 변환해주세요.

[파일명] ${fileName}
[카테고리] ${category}
[원본 내용]
${text.slice(0, 4000)}

아래 형식 그대로 ${writeLang} 작성하세요:
${format}

규칙 (필수 준수):
- 반드시 ${writeLang} 작성 (다른 언어 사용 금지)
- 원본 내용을 기반으로 정확하게 작성
- 위 형식의 헤더(##)를 반드시 유지
- 내용이 없는 항목은 "해당 없음"으로 표시`;
}

/** 파일 업로드 → 텍스트 추출 → AI 자동 문서 생성 */
app.post('/api/ai/auto-document', authMiddleware, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: '파일을 선택하세요.' });
  const { category = '문서', relatedId, lang = 'ko' } = req.body;
  const filePath = path.join(UPLOAD_DIR, req.file.filename);

  try {
    // 텍스트 추출
    let rawText;
    try {
      rawText = await extractText(filePath, req.file.mimetype, req.file.originalname);
    } catch (extractErr) {
      return res.status(422).json({ error: extractErr.message });
    }
    if (!rawText || rawText.trim().length < 10) {
      return res.status(422).json({ error: '파일에서 텍스트를 추출할 수 없습니다. TXT, PDF, DOCX 형식을 지원합니다.' });
    }

    // 파일명 인코딩 수정 (multer는 latin-1로 저장 → UTF-8 변환)
    const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');

    // AI 문서화
    const aiData = await ollamaGenerate(DEFAULT_MODEL, buildAutoDocPrompt(originalName, rawText, category, lang), getLangSystem(lang));
    const docContent = (aiData.response || '').trim() || rawText.slice(0, 2000);

    // 키워드 추출
    const kwLangRule = buildLangInstruction(lang);
    const kwLangOut = lang === 'en' ? 'in English' : lang === 'ja' ? '日本語で' : '한국어로';
    const kwPrompt = `${kwLangRule}\n\n다음 텍스트에서 핵심 키워드 5개를 쉼표로 구분하여 ${kwLangOut} 출력하세요. 설명 없이 키워드만:\n${rawText.slice(0, 1000)}`;
    let keywords = [];
    try {
      const kwData = await ollamaGenerate(DEFAULT_MODEL, kwPrompt, getLangSystem(lang));
      keywords = (kwData.response || '').split(',').map(k => k.trim()).filter(Boolean).slice(0, 5);
    } catch { /* 키워드 추출 실패 시 무시 */ }

    // 문서 자동 저장
    const docId = genId();
    const now = new Date().toISOString();
    const title = originalName.replace(/\.[^.]+$/, ''); // 확장자 제거
    db.prepare('INSERT INTO documents (id,title,content,category,tags,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)')
      .run(docId, `[AI] ${title}`, docContent, category, JSON.stringify(keywords), req.user.id, now, now);

    // 파일 메타데이터 저장 (문서에 연결)
    const fileId = genId();
    db.prepare('INSERT INTO files (id,original_name,stored_name,mime_type,size,related_id,related_type,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?)')
      .run(fileId, originalName, req.file.filename, req.file.mimetype, req.file.size, docId, 'document', req.user.id, now);

    res.json({
      document: { id: docId, title: `[AI] ${title}`, content: docContent, category, tags: keywords, createdAt: now },
      file: mapFile(db.prepare('SELECT * FROM files WHERE id=?').get(fileId)),
      extractedLength: rawText.length,
    });
  } catch (e) {
    // 오류 시 업로드된 파일 정리
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    if (e.message && e.message.includes('Ollama')) {
      return res.status(503).json({ error: 'Ollama AI 서버에 연결할 수 없습니다. ollama serve 명령으로 실행하세요.' });
    }
    res.status(500).json({ error: e.message || '자동 문서화에 실패했습니다.' });
  }
});

/* ═══════════════════════════════════════
   오피스 문서 변환 API
═══════════════════════════════════════ */

/** JSON 블록 추출 (LLM이 앞뒤에 텍스트를 붙이는 경우 대비) */
function extractJSON(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('JSON 파싱 실패: 올바른 형식을 찾을 수 없습니다.');
  return JSON.parse(match[0]);
}

function buildWeeklyReportConvertPrompt(text, lang) {
  const langRule = buildLangInstruction(lang);
  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay() + 1); // 이번 주 월요일
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const fmt = (d) => d.toISOString().slice(0, 10);

  return `${langRule}

아래 문서를 분석하여 주간업무보고서 JSON 형식으로 변환하세요.
반드시 아래 JSON 형식만 출력하고, 다른 텍스트나 설명은 절대 포함하지 마세요.

[원본 문서]
${text.slice(0, 4000)}

[출력 형식] (이 JSON 구조 그대로, 다른 텍스트 없이 출력):
{
  "weekStart": "${fmt(weekStart)}",
  "weekEnd": "${fmt(weekEnd)}",
  "completedTasks": [
    {"category": "업무분류", "content": "완료한 업무 내용", "progress": 100}
  ],
  "inProgressTasks": [
    {"category": "업무분류", "content": "진행 중인 업무 내용", "progress": 60}
  ],
  "nextWeekTasks": [
    {"category": "업무분류", "content": "다음 주 예정 업무"}
  ],
  "issues": "이슈나 문제점 (없으면 빈 문자열)",
  "notes": "특이사항이나 메모 (없으면 빈 문자열)"
}

규칙:
- completedTasks: 완료된 업무 (progress는 반드시 100)
- inProgressTasks: 진행 중인 업무 (progress는 0~99 사이)
- nextWeekTasks: 다음 주 예정 업무 (progress 필드 없음)
- 날짜 정보가 없으면 이번 주 날짜 사용
- 반드시 순수 JSON만 출력 (마크다운 코드블록 금지, 설명 텍스트 금지)`;
}

function buildDocConvertPrompt(text, targetType, lang) {
  const langRule = buildLangInstruction(lang);
  const formats = {
    '회의록': `## 회의 개요\n- 일시: (날짜/시간)\n- 참석자: (참석자 목록)\n- 안건: (주요 안건)\n\n## 논의 내용\n- (주요 논의 사항)\n\n## 결정 사항\n- (합의된 내용)\n\n## 액션 아이템\n| 담당자 | 내용 | 기한 |\n|--------|------|------|\n| (담당자) | (내용) | (기한) |`,
    '보고서': `## 요약\n(핵심 내용 2~3줄)\n\n## 현황\n- (현황 항목)\n\n## 주요 내용\n(상세 내용)\n\n## 결론 및 제언\n(결론)`,
    '공지사항': `## 공지 제목\n(제목)\n\n## 공지 내용\n(주요 내용)\n\n## 일정 및 기한\n(해당 시 작성)\n\n## 문의\n(담당자 / 연락처)`,
  };
  return `${langRule}

아래 원본 문서를 [${targetType}] 형식으로 깔끔하게 변환해주세요.

[원본 문서]
${text.slice(0, 4000)}

[${targetType}] 형식으로 아래 템플릿에 맞게 작성하세요:
${formats[targetType] || formats['보고서']}

규칙:
- 원본 내용을 기반으로 정확하게 작성
- 마크다운 헤더(##)를 반드시 유지
- 원본에 없는 정보는 "(정보 없음)"으로 표시
- 내용은 간결하고 명확하게 정리`;
}

/** 오피스 문서 변환 */
app.post('/api/ai/convert-office', authMiddleware, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: '파일을 선택하세요.' });
  const { targetType = '회의록', lang = 'ko' } = req.body;
  const filePath = path.join(UPLOAD_DIR, req.file.filename);

  try {
    let rawText;
    try {
      rawText = await extractText(filePath, req.file.mimetype, req.file.originalname);
    } catch (extractErr) {
      return res.status(422).json({ error: extractErr.message });
    }
    if (!rawText || rawText.trim().length < 10) {
      return res.status(422).json({ error: '파일에서 텍스트를 추출할 수 없습니다. TXT, PDF, DOCX 형식을 지원합니다.' });
    }
    const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');

    if (targetType === '주간보고서') {
      // JSON 구조화 변환
      const aiData = await ollamaGenerate(DEFAULT_MODEL, buildWeeklyReportConvertPrompt(rawText, lang), getLangSystem(lang));
      const raw = (aiData.response || '').trim();
      let parsed;
      try { parsed = extractJSON(raw); }
      catch { return res.status(422).json({ error: 'AI가 올바른 형식으로 변환하지 못했습니다. 원본 문서를 확인해주세요.', rawResponse: raw.slice(0, 500) }); }

      // id 자동 부여
      const withIds = (tasks) => (tasks || []).map((t) => ({ ...t, id: genId() }));
      parsed.completedTasks = withIds(parsed.completedTasks);
      parsed.inProgressTasks = withIds(parsed.inProgressTasks);
      parsed.nextWeekTasks = withIds(parsed.nextWeekTasks);
      parsed.issues = parsed.issues || '';
      parsed.notes = parsed.notes || '';

      res.json({ type: '주간보고서', data: parsed, originalName });
    } else {
      // 마크다운 텍스트 변환
      const aiData = await ollamaGenerate(DEFAULT_MODEL, buildDocConvertPrompt(rawText, targetType, lang), getLangSystem(lang));
      const content = (aiData.response || '').trim();

      // 문서함 자동 저장
      const docId = genId();
      const now = new Date().toISOString();
      const title = originalName.replace(/\.[^.]+$/, '');
      db.prepare('INSERT INTO documents (id,title,content,category,tags,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)')
        .run(docId, `[변환] ${title}`, content, targetType === '공지사항' ? '기타' : targetType, JSON.stringify([]), req.user.id, now, now);

      res.json({ type: targetType, content, documentId: docId, originalName, title: `[변환] ${title}` });
    }
  } catch (e) {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    if (e.message?.includes('Ollama')) return res.status(503).json({ error: 'Ollama AI 서버에 연결할 수 없습니다.' });
    res.status(500).json({ error: e.message || '변환 중 오류가 발생했습니다.' });
  }
});

/* ═══════════════════════════════════════
   ADMIN: 스토리지 & 백업 관리 API
═══════════════════════════════════════ */

/** 스토리지 현황: 등록 파일 수, 고아 파일, 유령 레코드, 백업 목록 */
app.get('/api/admin/storage', authMiddleware, adminOnly, (_req, res) => {
  const dbFiles     = db.prepare('SELECT stored_name, size FROM files').all();
  const dbNameSet   = new Set(dbFiles.map(f => f.stored_name));
  const diskFiles   = fs.readdirSync(UPLOAD_DIR).filter(f => !f.startsWith('.'));
  const diskNameSet = new Set(diskFiles);

  const orphanFiles = diskFiles
    .filter(f => !dbNameSet.has(f))
    .map(f => {
      try { const s = fs.statSync(path.join(UPLOAD_DIR, f)); return { filename: f, sizeBytes: s.size }; }
      catch { return { filename: f, sizeBytes: 0 }; }
    });

  const ghostRecords = dbFiles
    .filter(f => !diskNameSet.has(f.stored_name))
    .map(f => ({ storedName: f.stored_name }));

  const totalDiskSize = diskFiles.reduce((acc, f) => {
    try { return acc + fs.statSync(path.join(UPLOAD_DIR, f)).size; } catch { return acc; }
  }, 0);

  res.json({
    registeredFiles:    dbFiles.length,
    diskFiles:          diskFiles.length,
    totalDiskSizeBytes: totalDiskSize,
    orphanCount:        orphanFiles.length,
    orphanFiles,
    ghostRecordCount:   ghostRecords.length,
    ghostRecords,
    backups:            listBackups(),
  });
});

/** 고아 파일 및 유령 레코드 일괄 정리 */
app.post('/api/admin/storage/cleanup', authMiddleware, adminOnly, (_req, res) => {
  const dbNameSet   = new Set(db.prepare('SELECT stored_name FROM files').all().map(f => f.stored_name));
  const diskFiles   = fs.readdirSync(UPLOAD_DIR).filter(f => !f.startsWith('.'));
  const diskNameSet = new Set(diskFiles);
  const log = [];

  // 고아 파일 삭제 (디스크에만 있고 DB에 없는 파일)
  diskFiles.filter(f => !dbNameSet.has(f)).forEach(f => {
    try {
      fs.unlinkSync(path.join(UPLOAD_DIR, f));
      log.push({ type: 'orphan_deleted', filename: f });
    } catch (e) {
      log.push({ type: 'error', filename: f, error: e.message });
    }
  });

  // 유령 레코드 삭제 (DB에만 있고 디스크에 없는 파일)
  db.prepare('SELECT id, stored_name FROM files').all()
    .filter(f => !diskNameSet.has(f.stored_name))
    .forEach(f => {
      db.prepare('DELETE FROM files WHERE id=?').run(f.id);
      log.push({ type: 'ghost_record_deleted', filename: f.stored_name });
    });

  res.json({ cleaned: log.length, log });
});

/** 수동 백업 생성 */
app.post('/api/admin/backup', authMiddleware, adminOnly, async (_req, res) => {
  try {
    const result = await createBackup(db);
    res.json({ success: true, ...result });
  } catch (e) {
    res.status(500).json({ error: '백업 실패: ' + e.message });
  }
});

app.post('/api/admin/backup', authMiddleware, adminOnly, async (_req, res) => {
  try {
    const result = await createBackup(db);
    res.json({ success: true, ...result });
  } catch (e) {
    res.status(500).json({ error: '백업 실패: ' + e.message });
  }
});

/* ═══════════════════════════════════════
   휴지통 API (소프트 딜리트된 항목 관리)
═══════════════════════════════════════ */
const TRASH_TABLES = {
  schedule: { table: 'schedules',      mapper: r => ({ id: r.id, title: r.title, deletedAt: r.deleted_at, type: 'schedule' }) },
  document: { table: 'documents',      mapper: r => ({ id: r.id, title: r.title, deletedAt: r.deleted_at, type: 'document' }) },
  report:   { table: 'weekly_reports', mapper: r => ({ id: r.id, title: r.week_start, deletedAt: r.deleted_at, type: 'report' }) },
  notice:   { table: 'notices',        mapper: r => ({ id: r.id, title: r.title, deletedAt: r.deleted_at, type: 'notice' }) },
};

// 휴지통 목록
app.get('/api/trash', authMiddleware, (req, res) => {
  const items = [];
  for (const [type, { table, mapper }] of Object.entries(TRASH_TABLES)) {
    const rows = db.prepare(`SELECT * FROM ${table} WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC`).all();
    rows.forEach(r => items.push(mapper(r)));
  }
  items.sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
  res.json(items);
});

// 복원
app.post('/api/trash/:type/:id/restore', authMiddleware, (req, res) => {
  const { type, id } = req.params;
  const meta = TRASH_TABLES[type];
  if (!meta) return res.status(400).json({ error: '잘못된 타입입니다.' });
  const row = db.prepare(`SELECT * FROM ${meta.table} WHERE id=? AND deleted_at IS NOT NULL`).get(id);
  if (!row) return res.status(404).json({ error: '항목을 찾을 수 없습니다.' });
  db.prepare(`UPDATE ${meta.table} SET deleted_at=NULL WHERE id=?`).run(id);
  auditLog(req, 'restore', type, id, { title: row.title || row.week_start });
  res.json({ success: true });
});

// 영구 삭제 (관리자 전용)
app.delete('/api/trash/:type/:id', authMiddleware, adminOnly, (req, res) => {
  const { type, id } = req.params;
  const meta = TRASH_TABLES[type];
  if (!meta) return res.status(400).json({ error: '잘못된 타입입니다.' });
  db.prepare(`DELETE FROM ${meta.table} WHERE id=? AND deleted_at IS NOT NULL`).run(id);
  auditLog(req, 'permanent_delete', type, id);
  res.json({ success: true });
});

// 휴지통 비우기 (30일 이상 된 항목 영구 삭제, 관리자 전용)
app.post('/api/trash/empty', authMiddleware, adminOnly, (req, res) => {
  const daysAgo = req.body?.days ?? 30;
  let count = 0;
  for (const { table } of Object.values(TRASH_TABLES)) {
    const info = db.prepare(`DELETE FROM ${table} WHERE deleted_at IS NOT NULL AND deleted_at < datetime('now', ?)`).run(`-${daysAgo} days`);
    count += info.changes;
  }
  auditLog(req, 'empty_trash', 'system', 'all', { daysAgo, deleted: count });
  res.json({ success: true, deleted: count });
});

/* ═══════════════════════════════════════
   감사 로그 API
═══════════════════════════════════════ */
app.get('/api/admin/audit-logs', authMiddleware, adminOnly, (req, res) => {
  const { actor, action, targetType, page = 1, limit = 50 } = req.query;
  const conditions = [];
  const params = [];
  if (actor)      { conditions.push('actor_id = ?');    params.push(actor); }
  if (action)     { conditions.push('action = ?');      params.push(action); }
  if (targetType) { conditions.push('target_type = ?'); params.push(targetType); }
  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  const offset = (Number(page) - 1) * Number(limit);
  const total = db.prepare(`SELECT COUNT(*) as c FROM audit_logs ${where}`).get(...params).c;
  const rows  = db.prepare(`SELECT * FROM audit_logs ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, Number(limit), offset);
  res.json({ total, page: Number(page), limit: Number(limit), rows });
});

/* ═══════════════════════════════════════
   DB 통계 API
═══════════════════════════════════════ */
app.get('/api/admin/stats', authMiddleware, adminOnly, (req, res) => {
  const tables = ['users','schedules','weekly_reports','documents','notices','files','chat_messages','notifications','todos','contacts','ai_summaries','audit_logs'];
  const rowCounts = {};
  for (const t of tables) {
    try { rowCounts[t] = db.prepare(`SELECT COUNT(*) as c FROM ${t}`).get().c; } catch { rowCounts[t] = 0; }
  }

  // 소프트 딜리트 현황
  const trash = {};
  for (const [type, { table }] of Object.entries(TRASH_TABLES)) {
    trash[type] = db.prepare(`SELECT COUNT(*) as c FROM ${table} WHERE deleted_at IS NOT NULL`).get().c;
  }

  // 사용자별 통계
  const usersByRole = db.prepare("SELECT role, COUNT(*) as c FROM users GROUP BY role").all();
  const usersByDept = db.prepare("SELECT department, COUNT(*) as c FROM users GROUP BY department").all();

  // 최근 30일 활성 사용자 (감사 로그 기준)
  const activeUsers = db.prepare("SELECT COUNT(DISTINCT actor_id) as c FROM audit_logs WHERE created_at > datetime('now','-30 days')").get().c;

  // 문서 카테고리 분포
  const docsByCategory = db.prepare("SELECT category, COUNT(*) as c FROM documents WHERE deleted_at IS NULL GROUP BY category").all();

  // DB 파일 크기
  let dbSizeBytes = 0;
  try {
    const dbPath = path.join(__dirname, 'office.db');
    if (fs.existsSync(dbPath)) dbSizeBytes = fs.statSync(dbPath).size;
  } catch {}

  // 업로드 폴더 크기
  let uploadsSizeBytes = 0;
  try {
    const files = fs.readdirSync(UPLOAD_DIR);
    for (const f of files) {
      try { uploadsSizeBytes += fs.statSync(path.join(UPLOAD_DIR, f)).size; } catch {}
    }
  } catch {}

  res.json({
    rowCounts,
    trash,
    usersByRole,
    usersByDept,
    activeUsers,
    docsByCategory,
    dbSizeBytes,
    uploadsSizeBytes,
  });
});

/* ═══════════════════════════════════════
   파일 쿼터 API
═══════════════════════════════════════ */
// 내 스토리지 사용량
app.get('/api/users/me/storage', authMiddleware, (req, res) => {
  const user = db.prepare('SELECT file_quota_bytes FROM users WHERE id=?').get(req.user.id);
  const quota = user?.file_quota_bytes ?? FILE_QUOTA_BYTES_DEFAULT;
  const used = getUserFileUsage(req.user.id);
  res.json({ used, quota, available: quota === null ? null : quota - used });
});

// 관리자가 특정 사용자 쿼터 설정
app.put('/api/admin/users/:id/quota', authMiddleware, adminOnly, (req, res) => {
  const { quotaBytes } = req.body;
  if (quotaBytes !== null && (typeof quotaBytes !== 'number' || quotaBytes < 0)) {
    return res.status(400).json({ error: 'quotaBytes는 양수 또는 null(무제한)이어야 합니다.' });
  }
  db.prepare('UPDATE users SET file_quota_bytes=? WHERE id=?').run(quotaBytes, req.params.id);
  auditLog(req, 'set_quota', 'user', req.params.id, { quotaBytes });
  res.json({ success: true });
});

/* ═══════════════════════════════════════
   Socket.io 메신저 (채팅 DB 저장)
═══════════════════════════════════════ */
const onlineUsers = {};

function getRoomMessages(room) {
  const rows = db.prepare('SELECT * FROM chat_messages WHERE room=? ORDER BY timestamp LIMIT 100').all(room);
  return rows.map((m) => ({ id: m.id, fromId: m.from_id, fromName: m.from_name, fromDept: m.from_dept, toId: m.to_id, room: m.room, content: m.content, timestamp: m.timestamp }));
}

function dmRoom(idA, idB) {
  return 'dm_' + [idA, idB].sort().join('__');
}

io.on('connection', (socket) => {
  console.log('[Socket] Connected:', socket.id);

  socket.on('user_join', (user) => {
    onlineUsers[socket.id] = { ...user, socketId: socket.id };
    io.emit('online_users', Object.values(onlineUsers));
    socket.join('general');
    socket.join('user:' + user.id); // 개인 알림 채널
    socket.emit('room_history', { room: 'general', messages: getRoomMessages('general') });
    console.log('[Socket] User joined:', user.name);
  });

  socket.on('join_dm', ({ myId, targetId }) => {
    const room = dmRoom(myId, targetId);
    socket.join(room);
    socket.emit('room_history', { room, messages: getRoomMessages(room) });
  });

  socket.on('send_message', (data) => {
    const { fromId, fromName, fromDept, toId, room, content } = data;
    if (!content || !content.trim()) return;
    const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const timestamp = new Date().toISOString();
    db.prepare('INSERT INTO chat_messages (id,from_id,from_name,from_dept,to_id,room,content,timestamp) VALUES (?,?,?,?,?,?,?,?)')
      .run(id, fromId, fromName, fromDept || '', toId || null, room, content.trim(), timestamp);
    io.to(room).emit('receive_message', { id, fromId, fromName, fromDept: fromDept || '', toId: toId || null, room, content: content.trim(), timestamp });
    // @멘션 알림
    const mentionReg = /@([^\s@]+)/g;
    let m;
    while ((m = mentionReg.exec(content)) !== null) {
      const mentionedName = m[1];
      const mentioned = db.prepare('SELECT id FROM users WHERE name = ?').get(mentionedName);
      if (mentioned && mentioned.id !== fromId) {
        pushNotif(mentioned.id, 'mention', `${fromName}님이 멘션했습니다`, content.trim().slice(0, 80), '/messenger');
      }
    }
    // DM 수신 알림 (1:1 채팅)
    if (toId && toId !== fromId) {
      pushNotif(toId, 'dm', `${fromName}님의 메시지`, content.trim().slice(0, 80), '/messenger');
    }
  });

  socket.on('typing', ({ room, name, isTyping }) => {
    socket.to(room).emit('user_typing', { name, isTyping });
  });

  socket.on('disconnect', () => {
    const user = onlineUsers[socket.id];
    if (user) { console.log('[Socket] Disconnected:', user.name); delete onlineUsers[socket.id]; io.emit('online_users', Object.values(onlineUsers)); }
  });
});

/* ═══════════════════════════════════════
   Health check
═══════════════════════════════════════ */
app.get('/health', (_, res) => res.json({ status: 'ok', db: 'sqlite', users: Object.keys(onlineUsers).length }));

/* ═══════════════════════════════════════
   NOTICES API (공지사항)
═══════════════════════════════════════ */
function mapNotice(n) {
  return {
    id: n.id,
    title: n.title,
    content: n.content,
    authorId: n.author_id,
    authorName: n.author_name,
    department: n.department,
    isPinned: n.is_pinned === 1,
    category: n.category || '일반',
    createdAt: n.created_at,
    updatedAt: n.updated_at,
  };
}

// 목록 조회 (인증 필요)
app.get('/api/notices', authMiddleware, (_, res) => {
  const rows = db.prepare('SELECT * FROM notices WHERE deleted_at IS NULL ORDER BY is_pinned DESC, created_at DESC').all();
  res.json(rows.map(mapNotice));
});

// 생성 (관리자/팀장만)
app.post('/api/notices', authMiddleware, (req, res) => {
  if (!['admin', 'manager'].includes(req.user.role)) return res.status(403).json({ error: '권한이 없습니다.' });
  const { title, content, isPinned, category } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: '제목을 입력하세요.' });
  const id = genId();
  const now = new Date().toISOString();
  db.prepare('INSERT INTO notices (id, title, content, author_id, author_name, department, is_pinned, category, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, title.trim(), content ?? '', req.user.id, req.user.name, req.user.department ?? '', isPinned ? 1 : 0, category || '일반', now, now);
  // 전체 사용자에게 공지 알림
  pushNotifAll(req.user.id, 'notice', `[공지] ${title.trim()}`, `${req.user.name} · ${req.user.department || ''}`, '/notices');
  auditLog(req, 'create', 'notice', id, { title: title.trim() });
  res.json(mapNotice(db.prepare('SELECT * FROM notices WHERE id = ?').get(id)));
});

// 수정 (작성자 or 관리자)
app.put('/api/notices/:id', authMiddleware, (req, res) => {
  const notice = db.prepare('SELECT * FROM notices WHERE id = ? AND deleted_at IS NULL').get(req.params.id);
  if (!notice) return res.status(404).json({ error: '공지를 찾을 수 없습니다.' });
  if (notice.author_id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: '권한이 없습니다.' });
  const { title, content, isPinned, category } = req.body;
  const now = new Date().toISOString();
  db.prepare('UPDATE notices SET title=?, content=?, is_pinned=?, category=?, updated_at=? WHERE id=?')
    .run(title ?? notice.title, content ?? notice.content, isPinned != null ? (isPinned ? 1 : 0) : notice.is_pinned, category ?? notice.category ?? '일반', now, req.params.id);
  auditLog(req, 'update', 'notice', req.params.id, { title: title ?? notice.title });
  res.json(mapNotice(db.prepare('SELECT * FROM notices WHERE id = ?').get(req.params.id)));
});

// 삭제 (작성자 or 관리자)
app.delete('/api/notices/:id', authMiddleware, (req, res) => {
  const notice = db.prepare('SELECT * FROM notices WHERE id = ? AND deleted_at IS NULL').get(req.params.id);
  if (!notice) return res.status(404).json({ error: '공지를 찾을 수 없습니다.' });
  if (notice.author_id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: '권한이 없습니다.' });
  db.prepare('UPDATE notices SET deleted_at=? WHERE id=?').run(new Date().toISOString(), req.params.id);
  auditLog(req, 'delete', 'notice', req.params.id, { title: notice.title });
  res.json({ success: true });
});

/* ─────────────────────────────────────────
   개인 TODO
───────────────────────────────────────── */
app.get('/api/todos', authMiddleware, (req, res) => {
  const rows = db.prepare('SELECT * FROM todos WHERE user_id=? ORDER BY created_at DESC').all(req.user.id);
  res.json(rows.map(r => ({
    id: r.id,
    userId: r.user_id,
    title: r.title,
    completed: !!r.completed,
    priority: r.priority,
    dueDate: r.due_date,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  })));
});

app.post('/api/todos', authMiddleware, (req, res) => {
  const { title, priority = 'medium', dueDate = null } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: '제목을 입력하세요.' });
  const id = genId();
  const now = new Date().toISOString();
  db.prepare(
    'INSERT INTO todos (id, user_id, title, completed, priority, due_date, created_at, updated_at) VALUES (?,?,?,0,?,?,?,?)'
  ).run(id, req.user.id, title.trim(), priority, dueDate, now, now);
  res.json({ id, userId: req.user.id, title: title.trim(), completed: false, priority, dueDate, createdAt: now, updatedAt: now });
});

app.put('/api/todos/:id', authMiddleware, (req, res) => {
  const todo = db.prepare('SELECT * FROM todos WHERE id=?').get(req.params.id);
  if (!todo) return res.status(404).json({ error: '할 일을 찾을 수 없습니다.' });
  if (todo.user_id !== req.user.id) return res.status(403).json({ error: '권한이 없습니다.' });
  const { title, completed, priority, dueDate } = req.body;
  const now = new Date().toISOString();
  db.prepare(
    'UPDATE todos SET title=?, completed=?, priority=?, due_date=?, updated_at=? WHERE id=?'
  ).run(
    title ?? todo.title,
    completed !== undefined ? (completed ? 1 : 0) : todo.completed,
    priority ?? todo.priority,
    dueDate !== undefined ? dueDate : todo.due_date,
    now,
    req.params.id
  );
  res.json({ success: true });
});

app.delete('/api/todos/:id', authMiddleware, (req, res) => {
  const todo = db.prepare('SELECT * FROM todos WHERE id=?').get(req.params.id);
  if (!todo) return res.status(404).json({ error: '할 일을 찾을 수 없습니다.' });
  if (todo.user_id !== req.user.id) return res.status(403).json({ error: '권한이 없습니다.' });
  db.prepare('DELETE FROM todos WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

/* ═══════════════════════════════════════
   NOTIFICATIONS API
═══════════════════════════════════════ */
app.get('/api/notifications', authMiddleware, (req, res) => {
  const rows = db.prepare(
    'SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 50'
  ).all(req.user.id);
  res.json(rows.map(n => ({
    id: n.id, userId: n.user_id, type: n.type,
    title: n.title, body: n.body, link: n.link,
    isRead: n.is_read === 1, createdAt: n.created_at,
  })));
});

app.put('/api/notifications/:id/read', authMiddleware, (req, res) => {
  db.prepare('UPDATE notifications SET is_read=1 WHERE id=? AND user_id=?').run(req.params.id, req.user.id);
  res.json({ success: true });
});

app.put('/api/notifications/read-all', authMiddleware, (req, res) => {
  db.prepare('UPDATE notifications SET is_read=1 WHERE user_id=?').run(req.user.id);
  res.json({ success: true });
});

app.delete('/api/notifications/:id', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM notifications WHERE id=? AND user_id=?').run(req.params.id, req.user.id);
  res.json({ success: true });
});

app.delete('/api/notifications', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM notifications WHERE user_id=?').run(req.user.id);
  res.json({ success: true });
});

// ── CONTACTS API ─────────────────────────────────────────────
app.get('/api/contacts', authMiddleware, (req, res) => {
  const rows = db.prepare('SELECT * FROM contacts ORDER BY name ASC').all();
  const contacts = rows.map(r => ({
    id: r.id, name: r.name, company: r.company, department: r.department,
    position: r.position, email: r.email, phone: r.phone, type: r.type,
    memo: r.memo, createdBy: r.created_by, createdAt: r.created_at, updatedAt: r.updated_at,
  }));
  res.json(contacts);
});

app.post('/api/contacts', authMiddleware, (req, res) => {
  const { name, company, department, position, email, phone, type, memo } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: '이름은 필수입니다.' });
  const id = 'contact_' + crypto.randomUUID().replace(/-/g, '');
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO contacts (id,name,company,department,position,email,phone,type,memo,created_by,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    id, name.trim(), company||'', department||'', position||'', email||'', phone||'',
    type||'external', memo||'', req.user.id, now, now
  );
  res.json({ id, name: name.trim(), company: company||'', department: department||'',
    position: position||'', email: email||'', phone: phone||'', type: type||'external',
    memo: memo||'', createdBy: req.user.id, createdAt: now, updatedAt: now });
});

app.put('/api/contacts/:id', authMiddleware, (req, res) => {
  const contact = db.prepare('SELECT * FROM contacts WHERE id=?').get(req.params.id);
  if (!contact) return res.status(404).json({ error: '연락처를 찾을 수 없습니다.' });
  const { name, company, department, position, email, phone, type, memo } = req.body;
  const now = new Date().toISOString();
  db.prepare(`UPDATE contacts SET name=?,company=?,department=?,position=?,email=?,phone=?,type=?,memo=?,updated_at=? WHERE id=?`).run(
    name ?? contact.name, company ?? contact.company, department ?? contact.department,
    position ?? contact.position, email ?? contact.email, phone ?? contact.phone,
    type ?? contact.type, memo ?? contact.memo, now, req.params.id
  );
  res.json({ success: true });
});

app.delete('/api/contacts/:id', authMiddleware, (req, res) => {
  const contact = db.prepare('SELECT * FROM contacts WHERE id=?').get(req.params.id);
  if (!contact) return res.status(404).json({ error: '연락처를 찾을 수 없습니다.' });
  db.prepare('DELETE FROM contacts WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

/* ═══════════════════════════════════════════════════════════
   전자결재 API
═══════════════════════════════════════════════════════════ */

/* 결재 목록 조회 */
app.get('/api/approvals', authMiddleware, (req, res) => {
  const { tab } = req.query; // 'mine' | 'pending' | 'done'
  const userId = req.user.id;
  let rows;

  if (tab === 'pending') {
    // 내가 결재해야 할 것 (내 차례인 pending step)
    rows = db.prepare(`
      SELECT a.*, s.step_order, s.id AS step_id
      FROM approvals a
      JOIN approval_steps s ON s.approval_id = a.id
      WHERE s.approver_id = ? AND s.status = 'pending' AND a.status = 'pending'
        AND s.step_order = (
          SELECT MIN(s2.step_order) FROM approval_steps s2
          WHERE s2.approval_id = a.id AND s2.status = 'pending'
        )
      ORDER BY a.created_at DESC
    `).all(userId);
  } else if (tab === 'done') {
    // 내가 관여한 완료/반려 결재
    rows = db.prepare(`
      SELECT DISTINCT a.* FROM approvals a
      LEFT JOIN approval_steps s ON s.approval_id = a.id AND s.approver_id = ?
      WHERE (a.author_id = ? OR s.approver_id = ?)
        AND a.status IN ('approved', 'rejected', 'cancelled')
      ORDER BY a.updated_at DESC
    `).all(userId, userId, userId);
  } else {
    // 내 기안 (mine)
    rows = db.prepare(`
      SELECT * FROM approvals WHERE author_id = ?
      ORDER BY created_at DESC
    `).all(userId);
  }

  // 각 결재에 steps 붙이기
  const result = rows.map(row => {
    const steps = db.prepare(
      'SELECT * FROM approval_steps WHERE approval_id=? ORDER BY step_order ASC'
    ).all(row.id);
    return { ...row, steps };
  });

  res.json(result);
});

/* 결재 상세 조회 */
app.get('/api/approvals/:id', authMiddleware, (req, res) => {
  const approval = db.prepare('SELECT * FROM approvals WHERE id=?').get(req.params.id);
  if (!approval) return res.status(404).json({ error: '결재를 찾을 수 없습니다.' });
  const steps = db.prepare(
    'SELECT * FROM approval_steps WHERE approval_id=? ORDER BY step_order ASC'
  ).all(req.params.id);
  res.json({ ...approval, steps });
});

/* 결재 기안 생성 */
app.post('/api/approvals', authMiddleware, (req, res) => {
  const { title, type, content, amount, approvers } = req.body;
  if (!title || !type || !approvers || approvers.length === 0) {
    return res.status(400).json({ error: '제목, 종류, 결재자를 입력해주세요.' });
  }
  const id = crypto.randomUUID().replace(/-/g, '');
  const now = new Date().toISOString();
  const user = req.user;

  db.prepare(`
    INSERT INTO approvals (id, title, type, content, amount, author_id, author_name, author_dept, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
  `).run(id, title, type, content || '', amount || 0, user.id, user.name, user.department || '', now, now);

  const insertStep = db.prepare(`
    INSERT INTO approval_steps (id, approval_id, step_order, approver_id, approver_name, status)
    VALUES (?, ?, ?, ?, ?, 'pending')
  `);

  for (let i = 0; i < approvers.length; i++) {
    const stepId = crypto.randomUUID().replace(/-/g, '');
    insertStep.run(stepId, id, i + 1, approvers[i].id, approvers[i].name);
  }

  // 결재자들에게 알림
  const notifStmt = db.prepare(`
    INSERT INTO notifications (id, user_id, message, type, is_read, created_at)
    VALUES (?, ?, ?, 'info', 0, ?)
  `);
  if (approvers[0]) {
    const nid = crypto.randomUUID().replace(/-/g, '');
    notifStmt.run(nid, approvers[0].id, `[전자결재] "${title}" 결재 요청이 도착했습니다.`, now);
  }

  const created = db.prepare('SELECT * FROM approvals WHERE id=?').get(id);
  const steps = db.prepare('SELECT * FROM approval_steps WHERE approval_id=? ORDER BY step_order ASC').all(id);
  res.json({ ...created, steps });
});

/* 결재 처리 (승인/반려) */
app.put('/api/approvals/:id/action', authMiddleware, (req, res) => {
  const { action, comment } = req.body; // action: 'approved' | 'rejected'
  if (!['approved', 'rejected'].includes(action)) {
    return res.status(400).json({ error: '유효하지 않은 액션입니다.' });
  }
  const userId = req.user.id;
  const now = new Date().toISOString();

  const approval = db.prepare('SELECT * FROM approvals WHERE id=?').get(req.params.id);
  if (!approval) return res.status(404).json({ error: '결재를 찾을 수 없습니다.' });
  if (approval.status !== 'pending') {
    return res.status(400).json({ error: '이미 처리된 결재입니다.' });
  }

  // 현재 처리할 step 찾기 (내 차례)
  const myStep = db.prepare(`
    SELECT * FROM approval_steps
    WHERE approval_id=? AND approver_id=? AND status='pending'
    ORDER BY step_order ASC LIMIT 1
  `).get(req.params.id, userId);

  if (!myStep) return res.status(403).json({ error: '결재 권한이 없거나 아직 내 차례가 아닙니다.' });

  // 내 step보다 낮은 step이 아직 pending인지 확인
  const prevPending = db.prepare(`
    SELECT COUNT(*) as cnt FROM approval_steps
    WHERE approval_id=? AND step_order < ? AND status='pending'
  `).get(req.params.id, myStep.step_order);

  if (prevPending.cnt > 0) {
    return res.status(403).json({ error: '이전 결재자가 아직 처리하지 않았습니다.' });
  }

  db.prepare(`
    UPDATE approval_steps SET status=?, comment=?, acted_at=? WHERE id=?
  `).run(action, comment || '', now, myStep.id);

  if (action === 'rejected') {
    // 반려: 전체 결재 반려
    db.prepare('UPDATE approvals SET status=\'rejected\', updated_at=? WHERE id=?').run(now, req.params.id);
    // 기안자에게 알림
    const nid = crypto.randomUUID().replace(/-/g, '');
    db.prepare(`INSERT INTO notifications (id, user_id, message, type, is_read, created_at) VALUES (?, ?, ?, 'error', 0, ?)`)
      .run(nid, approval.author_id, `[전자결재] "${approval.title}" 이(가) 반려되었습니다.`, now);
  } else {
    // 승인: 다음 step 확인
    const nextStep = db.prepare(`
      SELECT * FROM approval_steps WHERE approval_id=? AND step_order > ? AND status='pending'
      ORDER BY step_order ASC LIMIT 1
    `).get(req.params.id, myStep.step_order);

    if (nextStep) {
      // 다음 결재자에게 알림
      const nid = crypto.randomUUID().replace(/-/g, '');
      db.prepare(`INSERT INTO notifications (id, user_id, message, type, is_read, created_at) VALUES (?, ?, ?, 'info', 0, ?)`)
        .run(nid, nextStep.approver_id, `[전자결재] "${approval.title}" 결재 요청이 도착했습니다.`, now);
    } else {
      // 모든 step 완료 → 최종 승인
      db.prepare('UPDATE approvals SET status=\'approved\', updated_at=? WHERE id=?').run(now, req.params.id);
      const nid = crypto.randomUUID().replace(/-/g, '');
      db.prepare(`INSERT INTO notifications (id, user_id, message, type, is_read, created_at) VALUES (?, ?, ?, 'success', 0, ?)`)
        .run(nid, approval.author_id, `[전자결재] "${approval.title}" 이(가) 최종 승인되었습니다.`, now);
    }
  }

  const updated = db.prepare('SELECT * FROM approvals WHERE id=?').get(req.params.id);
  const steps = db.prepare('SELECT * FROM approval_steps WHERE approval_id=? ORDER BY step_order ASC').all(req.params.id);
  res.json({ ...updated, steps });
});

/* 결재 취소 (기안자만, pending 상태만) */
app.delete('/api/approvals/:id', authMiddleware, (req, res) => {
  const approval = db.prepare('SELECT * FROM approvals WHERE id=?').get(req.params.id);
  if (!approval) return res.status(404).json({ error: '결재를 찾을 수 없습니다.' });
  if (approval.author_id !== req.user.id) return res.status(403).json({ error: '취소 권한이 없습니다.' });
  if (!['pending'].includes(approval.status)) return res.status(400).json({ error: '이미 처리된 결재는 취소할 수 없습니다.' });

  const now = new Date().toISOString();
  db.prepare('UPDATE approvals SET status=\'cancelled\', updated_at=? WHERE id=?').run(now, req.params.id);
  res.json({ success: true });
});

const PORT = 3001;
httpServer.listen(PORT, () => {
  console.log(`[Server] Office Server (SQLite) running on http://localhost:${PORT}`);
  scheduleBackups(db); // 자동 백업 등록 (30초 후 첫 백업, 이후 24시간 주기)
  scheduleCleanup();   // 자동 정리 크론 등록

  // Ollama 모델 warm-up: 서버 시작 시 모델을 메모리에 로드해 두어 첫 요청 지연 방지
  setTimeout(() => {
    const DEFAULT_MODEL_NAME = 'qwen2.5:7b';
    const warmupBody = JSON.stringify({ model: DEFAULT_MODEL_NAME, prompt: '안녕', system: '', stream: false, keep_alive: -1 });
    const req = nodeHttp.request(
      { hostname: OLLAMA_HOST, port: OLLAMA_PORT, path: '/api/generate', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(warmupBody) } },
      (res) => { res.resume(); res.on('end', () => console.log('[AI] Ollama 모델 warm-up 완료')); }
    );
    req.on('error', (e) => console.warn('[AI] Ollama warm-up 실패 (Ollama가 꺼져 있을 수 있음):', e.message));
    req.setTimeout(120000, () => { req.destroy(); console.log('[AI] Ollama warm-up 타임아웃 (모델 로딩 중일 수 있음)'); });
    req.write(warmupBody); req.end();
    console.log('[AI] Ollama 모델 warm-up 요청 전송...');
  }, 3000); // 서버 완전 시작 후 3초 뒤

  // Ollama 모델 keep-alive: 4분마다 ping → 모델이 메모리에서 절대 내려오지 않도록
  const KEEP_ALIVE_INTERVAL_MS = 4 * 60 * 1000; // 4분
  setInterval(() => {
    const DEFAULT_MODEL_NAME = 'qwen2.5:7b';
    const pingBody = JSON.stringify({ model: DEFAULT_MODEL_NAME, prompt: '', system: '', stream: false, keep_alive: -1 });
    const pingReq = nodeHttp.request(
      { hostname: OLLAMA_HOST, port: OLLAMA_PORT, path: '/api/generate', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(pingBody) } },
      (res) => { res.resume(); }
    );
    pingReq.on('error', () => {}); // 조용히 무시 (Ollama 재시작 중일 수 있음)
    pingReq.setTimeout(10000, () => pingReq.destroy());
    pingReq.write(pingBody); pingReq.end();
  }, KEEP_ALIVE_INTERVAL_MS);
});

/* ─────────────────────────────────────────
   Graceful Shutdown (Ctrl+C / 시스템 종료)
───────────────────────────────────────── */
function gracefulShutdown(signal) {
  console.log(`\n[Server] ${signal} 수신 - 서버 종료 중...`);
  httpServer.close(() => {
    closeDb();
    process.exit(0);
  });
  // 10초 내 종료 안 되면 강제 종료
  setTimeout(() => {
    console.error('[Server] 강제 종료');
    process.exit(1);
  }, 10000);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

/* 예기치 않은 에러 → 로그만 남기고 서버 유지 */
process.on('uncaughtException', (err) => {
  console.error('[Server] uncaughtException:', err.message, err.stack);
});
process.on('unhandledRejection', (reason) => {
  console.error('[Server] unhandledRejection:', reason);
});
