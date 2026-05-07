const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const nodeHttp = require('http');
const crypto = require('crypto');
const db = require('./db.cjs');
const { signToken, authMiddleware, adminOnly } = require('./auth.cjs');

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

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
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function hashPassword(password) {
  return crypto.createHash('sha256').update(password + 'office_salt_2026').digest('hex');
}

/* ─────────────────────────────────────────
   기본 관리자 계정 초기화
───────────────────────────────────────── */
const existing = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@office.com');
if (!existing) {
  db.prepare('INSERT INTO users (id, name, email, password_hash, department, role, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run('admin-default', '관리자', 'admin@office.com', hashPassword('admin1234'), '관리팀', 'admin', new Date().toISOString());
  console.log('[DB] 기본 관리자 계정 생성됨');
}

/* ═══════════════════════════════════════
   AUTH API
═══════════════════════════════════════ */
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: '이메일과 비밀번호를 입력하세요.' });
  const user = db.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)').get(email);
  if (!user) return res.status(401).json({ error: '등록되지 않은 이메일입니다.' });
  if (user.password_hash !== hashPassword(password)) return res.status(401).json({ error: '비밀번호가 올바르지 않습니다.' });
  const token = signToken(user);
  res.json({ token, user: mapUser(user) });
});

/* ═══════════════════════════════════════
   USERS API
═══════════════════════════════════════ */
function mapUser(u) {
  return { id: u.id, name: u.name, email: u.email, department: u.department, role: u.role, createdAt: u.created_at };
}

app.get('/api/users', authMiddleware, adminOnly, (_, res) => {
  res.json(db.prepare('SELECT * FROM users ORDER BY created_at').all().map(mapUser));
});

app.post('/api/users', authMiddleware, adminOnly, (req, res) => {
  const { name, email, password, department, role } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: '필수 항목을 입력하세요.' });
  if (password.length < 6) return res.status(400).json({ error: '비밀번호는 6자 이상이어야 합니다.' });
  if (db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)').get(email)) return res.status(400).json({ error: '이미 사용 중인 이메일입니다.' });
  const id = genId();
  const now = new Date().toISOString();
  db.prepare('INSERT INTO users (id, name, email, password_hash, department, role, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, name, email, hashPassword(password), department || '', role || 'member', now);
  res.json(mapUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id)));
});

app.put('/api/users/:id', authMiddleware, (req, res) => {
  const { id } = req.params;
  if (req.user.id !== id && req.user.role !== 'admin') return res.status(403).json({ error: '권한이 없습니다.' });
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
  const { name, department, role } = req.body;
  db.prepare('UPDATE users SET name=?, department=?, role=? WHERE id=?')
    .run(name ?? user.name, department ?? user.department, role ?? user.role, id);
  res.json(mapUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id)));
});

app.put('/api/users/:id/password', authMiddleware, (req, res) => {
  const { id } = req.params;
  if (req.user.id !== id && req.user.role !== 'admin') return res.status(403).json({ error: '권한이 없습니다.' });
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
  const { oldPassword, newPassword } = req.body;
  if (req.user.role !== 'admin' && user.password_hash !== hashPassword(oldPassword)) return res.status(401).json({ error: '현재 비밀번호가 올바르지 않습니다.' });
  if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: '새 비밀번호는 6자 이상이어야 합니다.' });
  db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(hashPassword(newPassword), id);
  res.json({ success: true });
});

app.delete('/api/users/:id', authMiddleware, adminOnly, (req, res) => {
  if (req.params.id === 'admin-default') return res.status(400).json({ error: '기본 관리자는 삭제할 수 없습니다.' });
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
  res.json(db.prepare('SELECT * FROM schedules ORDER BY start_date').all().map(mapSchedule));
});

app.post('/api/schedules', authMiddleware, (req, res) => {
  const { title, description, startDate, endDate, allDay, category, priority, location, attendees } = req.body;
  if (!title || !startDate || !endDate) return res.status(400).json({ error: '필수 항목을 입력하세요.' });
  const id = genId(); const now = new Date().toISOString();
  db.prepare('INSERT INTO schedules (id,title,description,start_date,end_date,all_day,category,priority,location,attendees,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .run(id, title, description || '', startDate, endDate, allDay ? 1 : 0, category || '기타', priority || 'medium', location || '', JSON.stringify(attendees || []), req.user.id, now, now);
  res.json(mapSchedule(db.prepare('SELECT * FROM schedules WHERE id=?').get(id)));
});

app.put('/api/schedules/:id', authMiddleware, (req, res) => {
  const { id } = req.params;
  const s = db.prepare('SELECT * FROM schedules WHERE id=?').get(id);
  if (!s) return res.status(404).json({ error: '일정을 찾을 수 없습니다.' });
  const now = new Date().toISOString();
  const b = req.body;
  db.prepare('UPDATE schedules SET title=?,description=?,start_date=?,end_date=?,all_day=?,category=?,priority=?,location=?,attendees=?,updated_at=? WHERE id=?')
    .run(b.title ?? s.title, b.description ?? s.description, b.startDate ?? s.start_date, b.endDate ?? s.end_date,
      b.allDay !== undefined ? (b.allDay ? 1 : 0) : s.all_day,
      b.category ?? s.category, b.priority ?? s.priority, b.location ?? s.location,
      JSON.stringify(b.attendees ?? JSON.parse(s.attendees || '[]')), now, id);
  res.json(mapSchedule(db.prepare('SELECT * FROM schedules WHERE id=?').get(id)));
});

app.delete('/api/schedules/:id', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM schedules WHERE id=?').run(req.params.id);
  res.json({ success: true });
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
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

app.get('/api/reports', authMiddleware, (_, res) => {
  res.json(db.prepare('SELECT * FROM weekly_reports ORDER BY week_start DESC').all().map(mapReport));
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
  const r = db.prepare('SELECT * FROM weekly_reports WHERE id=?').get(id);
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
  db.prepare('DELETE FROM weekly_reports WHERE id=?').run(req.params.id);
  res.json({ success: true });
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

app.get('/api/documents', authMiddleware, (_, res) => {
  res.json(db.prepare('SELECT * FROM documents ORDER BY updated_at DESC').all().map(mapDocument));
});

app.post('/api/documents', authMiddleware, (req, res) => {
  const { title, content, category, tags } = req.body;
  if (!title) return res.status(400).json({ error: '제목을 입력하세요.' });
  const id = genId(); const now = new Date().toISOString();
  db.prepare('INSERT INTO documents (id,title,content,category,tags,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)')
    .run(id, title, content || '', category || '기타', JSON.stringify(tags || []), req.user.id, now, now);
  res.json(mapDocument(db.prepare('SELECT * FROM documents WHERE id=?').get(id)));
});

app.put('/api/documents/:id', authMiddleware, (req, res) => {
  const { id } = req.params;
  const d = db.prepare('SELECT * FROM documents WHERE id=?').get(id);
  if (!d) return res.status(404).json({ error: '문서를 찾을 수 없습니다.' });
  const now = new Date().toISOString(); const b = req.body;
  db.prepare('UPDATE documents SET title=?,content=?,category=?,tags=?,updated_at=? WHERE id=?')
    .run(b.title ?? d.title, b.content ?? d.content, b.category ?? d.category, JSON.stringify(b.tags ?? JSON.parse(d.tags || '[]')), now, id);
  res.json(mapDocument(db.prepare('SELECT * FROM documents WHERE id=?').get(id)));
});

app.delete('/api/documents/:id', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM documents WHERE id=?').run(req.params.id);
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

function ollamaGenerate(model, prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ model, prompt, stream: false });
    const req = nodeHttp.request(
      { hostname: OLLAMA_HOST, port: OLLAMA_PORT, path: '/api/generate', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } },
      (res) => { let data = ''; res.on('data', (c) => { data += c; }); res.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { reject(e); } }); }
    );
    req.on('error', reject);
    req.setTimeout(120000, () => { req.destroy(new Error('Ollama 요청 타임아웃')); });
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

function buildSummaryPrompt(type, title, text) {
  const guide = { '회의록': '회의에서 논의된 핵심 내용을 요약하고 결정사항과 액션 아이템을 추출하세요.', '보고서': '핵심 내용과 주요 성과/이슈를 요약하세요.', '이메일': '주요 요청 사항과 핵심 메시지를 요약하세요.', '문서': '핵심 내용을 간결하게 요약하세요.', '기타': '내용을 핵심 위주로 요약하세요.' };
  return `당신은 한국어 문서 요약 전문가입니다. 아래 ${type}을 한국어로 요약해주세요.\n\n[지침]\n- ${guide[type] || guide['문서']}\n- 3~5개의 핵심 포인트를 불릿 포인트(•)로 정리\n\n[제목] ${title}\n[원본 내용]\n${text}\n\n[요약 결과]`;
}

function buildReportSummaryPrompt(report) {
  const lines = [`[부서] ${report.department}`, `[기간] ${report.weekStart} ~ ${report.weekEnd}`];
  if (report.completedTasks?.length) { lines.push('\n[완료 업무]'); report.completedTasks.forEach((t, i) => lines.push(`${i + 1}. ${t.content}`)); }
  if (report.inProgressTasks?.length) { lines.push('\n[진행 중]'); report.inProgressTasks.forEach((t, i) => lines.push(`${i + 1}. ${t.content} (${t.progress}%)`)); }
  if (report.nextWeekTasks?.length) { lines.push('\n[다음 주]'); report.nextWeekTasks.forEach((t, i) => lines.push(`${i + 1}. ${t.content}`)); }
  if (report.issues) lines.push(`\n[이슈]\n${report.issues}`);
  return `당신은 업무 보고서 요약 전문가입니다. 아래 주간 업무 보고서를 한국어로 3~5줄로 요약해주세요.\n\n${lines.join('\n')}\n\n[요약 결과]`;
}

app.get('/api/ai/status', async (_, res) => {
  try { const data = await ollamaGetTags(); res.json({ available: true, models: (data.models || []).map((m) => m.name) }); }
  catch { res.json({ available: false, models: [] }); }
});

app.post('/api/ai/summarize', async (req, res) => {
  const { text, type = '문서', title = '문서' } = req.body;
  if (!text || text.trim().length < 10) return res.status(400).json({ error: '내용이 너무 짧습니다.' });
  try { const data = await ollamaGenerate(DEFAULT_MODEL, buildSummaryPrompt(type, title, text)); res.json({ summary: data.response || '' }); }
  catch { res.status(503).json({ error: 'Ollama 서버에 연결할 수 없습니다.', guide: 'ollama serve 명령으로 실행하세요.' }); }
});

app.post('/api/ai/report-summary', async (req, res) => {
  const { report } = req.body;
  if (!report) return res.status(400).json({ error: '보고서 데이터가 없습니다.' });
  try { const data = await ollamaGenerate(DEFAULT_MODEL, buildReportSummaryPrompt(report)); res.json({ summary: data.response || '' }); }
  catch { res.status(503).json({ error: 'Ollama 서버에 연결할 수 없습니다.', guide: 'ollama serve 명령으로 실행하세요.' }); }
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

const PORT = 3001;
httpServer.listen(PORT, () => {
  console.log(`[Server] Office Server (SQLite) running on http://localhost:${PORT}`);
});
