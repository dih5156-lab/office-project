import { useState, useRef, useEffect } from 'react';
import {
  X, User, Lock, Camera, Save, Eye, EyeOff,
  CheckCircle, AlertCircle, Building2, Shield, Mail, Calendar,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { DEPARTMENTS, RoleLabels } from '../../types';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

type Tab = 'profile' | 'password';

interface Props {
  onClose: () => void;
}

/** 비밀번호 강도 0~4 */
function passwordStrength(pw: string): { score: number; label: string; color: string } {
  if (!pw) return { score: 0, label: '', color: '' };
  let score = 0;
  if (pw.length >= 8)                         score++;
  if (/[A-Z]/.test(pw))                       score++;
  if (/[0-9]/.test(pw))                       score++;
  if (/[^A-Za-z0-9]/.test(pw))               score++;
  const map: { label: string; color: string }[] = [
    { label: '매우 약함', color: '#ef4444' },
    { label: '약함',     color: '#f97316' },
    { label: '보통',     color: '#eab308' },
    { label: '강함',     color: '#22c55e' },
    { label: '매우 강함', color: '#3b82f6' },
  ];
  return { score, ...map[score] };
}

export default function ProfileModal({ onClose }: Props) {
  const { currentUser, updateUser, changePassword } = useAuthStore();
  const [tab, setTab] = useState<Tab>('profile');
  const backdropRef = useRef<HTMLDivElement>(null);

  /* ── 프로필 편집 상태 ── */
  const [name,    setName]    = useState(currentUser?.name     ?? '');
  const [dept,    setDept]    = useState(currentUser?.department ?? '');
  const [saving,  setSaving]  = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [editMode, setEditMode] = useState(false);

  /* ── 비밀번호 변경 상태 ── */
  const [oldPw,    setOldPw]    = useState('');
  const [newPw,    setNewPw]    = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showOld,  setShowOld]  = useState(false);
  const [showNew,  setShowNew]  = useState(false);
  const [showCfm,  setShowCfm]  = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg,    setPwMsg]    = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const strength   = passwordStrength(newPw);
  const matchOk    = newPw.length > 0 && newPw === confirmPw;
  const matchFail  = confirmPw.length > 0 && newPw !== confirmPw;

  /* ESC 닫기 */
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  /* 프로필 저장 */
  async function handleSaveProfile() {
    if (!currentUser) return;
    if (!name.trim()) { setProfileMsg({ type: 'err', text: '이름을 입력하세요.' }); return; }
    setSaving(true);
    setProfileMsg(null);
    try {
      await updateUser(currentUser.id, { name: name.trim(), department: dept });
      setProfileMsg({ type: 'ok', text: '프로필이 저장되었습니다.' });
      setEditMode(false);
    } catch {
      setProfileMsg({ type: 'err', text: '저장에 실패했습니다.' });
    } finally {
      setSaving(false);
    }
  }

  /* 비밀번호 변경 */
  async function handleChangePw() {
    if (!currentUser) return;
    setPwMsg(null);
    if (!oldPw)                         { setPwMsg({ type: 'err', text: '현재 비밀번호를 입력하세요.' }); return; }
    if (newPw.length < 6)               { setPwMsg({ type: 'err', text: '새 비밀번호는 6자 이상이어야 합니다.' }); return; }
    if (newPw !== confirmPw)            { setPwMsg({ type: 'err', text: '새 비밀번호가 일치하지 않습니다.' }); return; }
    if (oldPw === newPw)                { setPwMsg({ type: 'err', text: '현재 비밀번호와 동일합니다.' }); return; }
    setPwSaving(true);
    const result = await changePassword(currentUser.id, oldPw, newPw);
    setPwSaving(false);
    if (result.success) {
      setPwMsg({ type: 'ok', text: '비밀번호가 성공적으로 변경되었습니다.' });
      setOldPw(''); setNewPw(''); setConfirmPw('');
    } else {
      setPwMsg({ type: 'err', text: result.message });
    }
  }

  if (!currentUser) return null;

  const inputCls = 'w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm bg-gray-50 transition-all focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-50 outline-none disabled:text-gray-400 disabled:cursor-not-allowed';

  return (
    /* 백드롭 */
    <div
      ref={backdropRef}
      onMouseDown={(e) => { if (e.target === backdropRef.current) onClose(); }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)' }}
    >
      <div
        className="w-full bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{ maxWidth: 480, maxHeight: '90vh' }}
      >
        {/* ── 상단 헤더 배너 ── */}
        <div
          className="relative px-6 pt-6 pb-16 shrink-0"
          style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #2563eb 100%)' }}
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg transition-colors hover:bg-white/20 text-white/70 hover:text-white"
          >
            <X size={16} />
          </button>
          <p className="text-white/70 text-xs font-semibold uppercase tracking-widest mb-1">계정</p>
          <p className="text-white text-xl font-extrabold">내 프로필</p>
        </div>

        {/* ── 아바타 (배너 겹침) ── */}
        <div className="relative shrink-0 px-6">
          <div className="absolute -top-10 left-6">
            <div className="relative">
              <div
                className="w-20 h-20 rounded-2xl border-4 border-white shadow-lg flex items-center justify-center text-2xl font-extrabold text-white select-none"
                style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}
              >
                {currentUser.name?.[0] ?? '?'}
              </div>
              <button
                className="absolute -bottom-1 -right-1 w-6 h-6 bg-white border border-gray-200 rounded-full flex items-center justify-center shadow-sm hover:bg-gray-50 transition-colors"
                title="사진 변경 (준비 중)"
              >
                <Camera size={12} className="text-gray-500" />
              </button>
            </div>
          </div>
          {/* 이름/역할 */}
          <div className="pl-28 pt-2 pb-4">
            <p className="font-bold text-gray-900 text-base leading-tight">{currentUser.name}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                {RoleLabels[currentUser.role]}
              </span>
              <span className="text-xs text-gray-400">{currentUser.department}</span>
            </div>
          </div>
        </div>

        {/* ── 탭 ── */}
        <div className="flex gap-1 mx-6 p-1 bg-gray-100 rounded-xl shrink-0">
          {([['profile', '프로필 정보', User], ['password', '비밀번호 변경', Lock]] as const).map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => { setTab(key); setProfileMsg(null); setPwMsg(null); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-semibold rounded-lg transition-all duration-150 ${
                tab === key ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        {/* ── 탭 내용 (스크롤) ── */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

          {/* ═══ 프로필 탭 ═══ */}
          {tab === 'profile' && (
            <>
              {/* 읽기 전용 정보 */}
              <div className="space-y-3">
                <InfoRow icon={Mail}     label="이메일"  value={currentUser.email} />
                <InfoRow icon={Shield}   label="역할"    value={RoleLabels[currentUser.role]} />
                <InfoRow icon={Calendar} label="가입일"
                  value={currentUser.createdAt
                    ? format(new Date(currentUser.createdAt), 'yyyy년 M월 d일', { locale: ko })
                    : '-'}
                />
              </div>

              <div className="h-px bg-gray-100" />

              {/* 수정 가능 필드 */}
              {!editMode ? (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">수정 가능 정보</p>
                    <button
                      onClick={() => setEditMode(true)}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors"
                    >
                      <Save size={12} /> 편집
                    </button>
                  </div>
                  <div className="space-y-3">
                    <InfoRow icon={User}     label="이름"  value={currentUser.name} />
                    <InfoRow icon={Building2} label="부서" value={currentUser.department} />
                  </div>
                </>
              ) : (
                <>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">정보 수정</p>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-500 mb-1.5 uppercase tracking-wide">이름</label>
                    <input
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      className={inputCls}
                      placeholder="이름 입력"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-500 mb-1.5 uppercase tracking-wide">부서</label>
                    <select
                      value={dept}
                      onChange={e => setDept(e.target.value)}
                      className={inputCls}
                    >
                      {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  {profileMsg && (
                    <Msg type={profileMsg.type} text={profileMsg.text} />
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setEditMode(false); setProfileMsg(null); setName(currentUser.name); setDept(currentUser.department); }}
                      className="flex-1 py-2.5 text-sm font-semibold rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
                    >
                      취소
                    </button>
                    <button
                      onClick={handleSaveProfile}
                      disabled={saving}
                      className="flex-1 py-2.5 text-sm font-bold text-white rounded-xl disabled:opacity-50 transition-all hover:shadow-lg hover:shadow-blue-200/60 active:scale-[0.98]"
                      style={{ background: 'linear-gradient(135deg, #2563eb, #4f46e5)' }}
                    >
                      {saving ? '저장 중...' : '저장'}
                    </button>
                  </div>
                </>
              )}
            </>
          )}

          {/* ═══ 비밀번호 탭 ═══ */}
          {tab === 'password' && (
            <>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">보안 설정</p>

              {/* 현재 비밀번호 */}
              <div>
                <label className="block text-[11px] font-bold text-gray-500 mb-1.5 uppercase tracking-wide">현재 비밀번호</label>
                <PwInput value={oldPw} onChange={setOldPw} show={showOld} onToggle={() => setShowOld(v => !v)} placeholder="현재 비밀번호 입력" />
              </div>

              <div className="h-px bg-gray-100" />

              {/* 새 비밀번호 */}
              <div>
                <label className="block text-[11px] font-bold text-gray-500 mb-1.5 uppercase tracking-wide">새 비밀번호</label>
                <PwInput value={newPw} onChange={setNewPw} show={showNew} onToggle={() => setShowNew(v => !v)} placeholder="6자 이상 입력" />
                {/* 강도 바 */}
                {newPw.length > 0 && (
                  <div className="mt-2">
                    <div className="flex gap-1 mb-1">
                      {[0, 1, 2, 3].map(i => (
                        <div
                          key={i}
                          className="flex-1 h-1 rounded-full transition-all"
                          style={{ background: i < strength.score ? strength.color : '#e5e7eb' }}
                        />
                      ))}
                    </div>
                    <p className="text-[11px] font-semibold" style={{ color: strength.color }}>
                      비밀번호 강도: {strength.label}
                    </p>
                    <ul className="mt-1.5 space-y-0.5">
                      {[
                        ['8자 이상',    newPw.length >= 8],
                        ['대문자 포함', /[A-Z]/.test(newPw)],
                        ['숫자 포함',   /[0-9]/.test(newPw)],
                        ['특수문자 포함', /[^A-Za-z0-9]/.test(newPw)],
                      ].map(([text, ok]) => (
                        <li key={text as string} className={`text-[11px] flex items-center gap-1.5 ${ok ? 'text-emerald-600' : 'text-gray-400'}`}>
                          <span>{ok ? '✓' : '○'}</span> {text as string}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* 비밀번호 확인 */}
              <div>
                <label className="block text-[11px] font-bold text-gray-500 mb-1.5 uppercase tracking-wide">새 비밀번호 확인</label>
                <div className="relative">
                  <PwInput value={confirmPw} onChange={setConfirmPw} show={showCfm} onToggle={() => setShowCfm(v => !v)} placeholder="동일하게 다시 입력" />
                  {matchOk && (
                    <CheckCircle size={15} className="absolute right-10 top-1/2 -translate-y-1/2 text-emerald-500 pointer-events-none" />
                  )}
                  {matchFail && (
                    <AlertCircle size={15} className="absolute right-10 top-1/2 -translate-y-1/2 text-red-400 pointer-events-none" />
                  )}
                </div>
                {matchFail && <p className="text-[11px] text-red-500 mt-1">비밀번호가 일치하지 않습니다.</p>}
                {matchOk   && <p className="text-[11px] text-emerald-600 mt-1">비밀번호가 일치합니다.</p>}
              </div>

              {pwMsg && <Msg type={pwMsg.type} text={pwMsg.text} />}

              <button
                onClick={handleChangePw}
                disabled={pwSaving || !oldPw || !matchOk}
                className="w-full py-3 text-sm font-bold text-white rounded-xl disabled:opacity-40 transition-all hover:shadow-lg hover:shadow-blue-200/60 active:scale-[0.98]"
                style={{ background: 'linear-gradient(135deg, #2563eb, #4f46e5)' }}
              >
                {pwSaving ? '변경 중...' : '비밀번호 변경'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── 서브 컴포넌트 ── */
function InfoRow({
  icon: Icon, label, value,
}: { icon: typeof User; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 py-2 px-3 bg-gray-50 rounded-xl">
      <div className="w-7 h-7 bg-white rounded-lg border border-gray-100 flex items-center justify-center shrink-0">
        <Icon size={13} className="text-gray-400" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide leading-none">{label}</p>
        <p className="text-sm font-medium text-gray-800 mt-0.5 truncate">{value}</p>
      </div>
    </div>
  );
}

function PwInput({
  value, onChange, show, onToggle, placeholder,
}: {
  value: string; onChange: (v: string) => void;
  show: boolean; onToggle: () => void; placeholder?: string;
}) {
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 pr-10 text-sm bg-gray-50 transition-all focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-50 outline-none"
      />
      <button
        type="button"
        onClick={onToggle}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
      >
        {show ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  );
}

function Msg({ type, text }: { type: 'ok' | 'err'; text: string }) {
  const ok = type === 'ok';
  return (
    <div className={`flex items-center gap-2 px-3.5 py-3 rounded-xl text-sm border ${
      ok ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-red-50 border-red-100 text-red-700'
    }`}>
      {ok ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
      {text}
    </div>
  );
}
