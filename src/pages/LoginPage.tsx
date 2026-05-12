import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import {
  Building2, Eye, EyeOff, Loader2,
  CalendarDays, FileText, BrainCircuit, MessageSquare,
} from 'lucide-react';
import { DEPARTMENTS } from '../types';

type Mode = 'login' | 'register';

const features = [
  { icon: CalendarDays,    label: '일정 관리',     desc: '팀 일정을 한눈에 관리' },
  { icon: FileText,        label: '주간 업무 보고', desc: '부서별 보고서 자동화' },
  { icon: BrainCircuit,    label: 'AI 내용 요약',  desc: 'Ollama LLM 기반 요약' },
  { icon: MessageSquare,   label: '실시간 메신저',  desc: '팀 커뮤니케이션 허브' },
];

export default function LoginPage() {
  const { login, register, initialize, isInitialized } = useAuthStore();
  const [mode, setMode] = useState<Mode>('login');

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');

  const [regName,     setRegName]     = useState('');
  const [regEmail,    setRegEmail]    = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regDept,     setRegDept]     = useState<string>(DEPARTMENTS[0]);
  const [regRole,     setRegRole]     = useState<'admin' | 'manager' | 'member'>('member');

  const [showPw,       setShowPw]       = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [message,      setMessage]      = useState('');
  const [messageType,  setMessageType]  = useState<'error' | 'success'>('error');

  useEffect(() => { initialize(); }, [initialize]);

  function showMsg(msg: string, type: 'error' | 'success' = 'error') {
    setMessage(msg); setMessageType(type);
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) { showMsg('이메일과 비밀번호를 입력하세요.'); return; }
    setLoading(true);
    const result = await login(email, password);
    setLoading(false);
    if (!result.success) showMsg(result.message);
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!regName || !regEmail || !regPassword || !regDept) {
      showMsg('모든 항목을 입력하세요.'); return;
    }
    setLoading(true);
    const result = await register({ name: regName, email: regEmail, password: regPassword, department: regDept, role: regRole });
    setLoading(false);
    if (result.success) {
      showMsg('계정이 생성되었습니다. 로그인해주세요.', 'success');
      setMode('login'); setEmail(regEmail);
    } else {
      showMsg(result.message);
    }
  }

  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0f172a, #1e1b4b)' }}>
        <Loader2 size={32} className="animate-spin text-blue-400" />
      </div>
    );
  }

  const inputCls = 'w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm bg-gray-50 transition-all focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-50 outline-none';

  return (
    <div className="min-h-screen flex">
      {/* ── 좌측 브랜드 패널 ── */}
      <div
        className="hidden lg:flex w-[460px] shrink-0 flex-col justify-between p-10 relative overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #0f172a 0%, #1e1b4b 55%, #312e81 100%)' }}
      >
        {/* 장식 블롭 */}
        <div className="absolute -top-28 -right-28 w-80 h-80 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.25), transparent 70%)' }} />
        <div className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.2), transparent 70%)' }} />

        {/* 상단 로고 + 헤드라인 */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-12">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-xl shrink-0"
              style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}
            >
              <Building2 size={22} className="text-white" />
            </div>
            <div>
              <p className="text-white font-bold text-lg leading-tight">오피스 자동화</p>
              <p className="text-indigo-300 text-xs font-medium">Office Automation System</p>
            </div>
          </div>
          <h2 className="text-white text-[2rem] font-extrabold leading-snug mb-3">
            업무 효율을<br />극대화하세요
          </h2>
          <p className="text-slate-400 text-sm leading-relaxed">
            일정, 보고서, AI 요약, 문서 관리까지<br />
            모든 것을 하나의 플랫폼에서.
          </p>
        </div>

        {/* 기능 목록 */}
        <div className="relative z-10 space-y-4">
          {features.map(({ icon: Icon, label, desc }) => (
            <div key={label} className="flex items-center gap-4">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  background: 'rgba(99,102,241,0.15)',
                  border: '1px solid rgba(99,102,241,0.25)',
                }}
              >
                <Icon size={17} className="text-indigo-300" />
              </div>
              <div>
                <p className="text-white text-sm font-semibold">{label}</p>
                <p className="text-slate-400 text-xs">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="relative z-10 text-slate-600 text-xs">© 2026 Office Automation System</p>
      </div>

      {/* ── 우측 폼 패널 ── */}
      <div className="flex-1 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-sm">
          {/* 모바일용 로고 */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}>
              <Building2 size={20} className="text-white" />
            </div>
            <div>
              <p className="font-bold text-gray-800">오피스 자동화</p>
              <p className="text-xs text-gray-400">Office Automation System</p>
            </div>
          </div>

          <h1 className="text-2xl font-extrabold text-gray-900 mb-1">
            {mode === 'login' ? '다시 만나서 반갑습니다 👋' : '계정 만들기'}
          </h1>
          <p className="text-sm text-gray-400 mb-7">
            {mode === 'login'
              ? '계정에 로그인하여 업무를 시작하세요'
              : '새 계정을 등록해 팀에 합류하세요'}
          </p>

          {/* 탭 */}
          <div className="flex gap-1 p-1 bg-gray-100 rounded-xl mb-6">
            {(['login', 'register'] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setMessage(''); }}
                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${
                  mode === m
                    ? 'bg-white text-gray-800 shadow-sm'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                {m === 'login' ? '로그인' : '계정 등록'}
              </button>
            ))}
          </div>

          {/* 메시지 */}
          {message && (
            <div className={`mb-4 px-4 py-3 rounded-xl text-sm ${
              messageType === 'error'
                ? 'bg-red-50 text-red-700 border border-red-100'
                : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
            }`}>
              {message}
            </div>
          )}

          {mode === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-gray-500 mb-1.5 uppercase tracking-wide">이메일</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className={inputCls}
                  placeholder="이메일을 입력하세요"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-500 mb-1.5 uppercase tracking-wide">비밀번호</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className={inputCls + ' pr-10'}
                    placeholder="비밀번호를 입력하세요"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 text-white text-sm font-bold rounded-xl disabled:opacity-50 flex items-center justify-center gap-2 transition-all hover:shadow-lg hover:shadow-blue-200/60 active:scale-[0.98]"
                style={{ background: 'linear-gradient(135deg, #2563eb, #4f46e5)' }}
              >
                {loading && <Loader2 size={15} className="animate-spin" />}
                로그인
              </button>

            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 mb-1.5 uppercase tracking-wide">이름</label>
                  <input
                    type="text"
                    value={regName}
                    onChange={e => setRegName(e.target.value)}
                    className={inputCls}
                    placeholder="홍길동"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 mb-1.5 uppercase tracking-wide">부서</label>
                  <select
                    value={regDept}
                    onChange={e => setRegDept(e.target.value)}
                    className={inputCls}
                  >
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-500 mb-1.5 uppercase tracking-wide">이메일</label>
                <input
                  type="email"
                  value={regEmail}
                  onChange={e => setRegEmail(e.target.value)}
                  className={inputCls}
                  placeholder="example@company.com"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-500 mb-1.5 uppercase tracking-wide">비밀번호 (6자 이상)</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={regPassword}
                    onChange={e => setRegPassword(e.target.value)}
                    className={inputCls + ' pr-10'}
                    placeholder="비밀번호"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-500 mb-1.5 uppercase tracking-wide">역할</label>
                <select
                  value={regRole}
                  onChange={e => setRegRole(e.target.value as typeof regRole)}
                  className={inputCls}
                >
                  <option value="member">팀원</option>
                  <option value="manager">팀장</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 text-white text-sm font-bold rounded-xl disabled:opacity-50 flex items-center justify-center gap-2 transition-all hover:shadow-lg hover:shadow-blue-200/60 active:scale-[0.98]"
                style={{ background: 'linear-gradient(135deg, #2563eb, #4f46e5)' }}
              >
                {loading && <Loader2 size={15} className="animate-spin" />}
                계정 등록
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
