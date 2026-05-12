import { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { User, UserRole, RoleLabels, DEPARTMENTS, getPositionOptions } from '../types';
import { Users, Shield, Trash2, Edit3, Check, X, Plus, KeyRound, ChevronDown, Phone } from 'lucide-react';
import { format } from 'date-fns';
import clsx from 'clsx';

const roleColors: Record<UserRole, string> = {
  admin: 'bg-red-100 text-red-700',
  manager: 'bg-blue-100 text-blue-700',
  member: 'bg-gray-100 text-gray-700',
};

export default function UserManagePage() {
  const { users, currentUser, updateUser, deleteUser, register, changePassword } = useAuthStore();
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ name: string; department: string; role: UserRole; phone: string; position: string }>({ name: '', department: '', role: 'member', phone: '', position: '' });
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPwModal, setShowPwModal] = useState<User | null>(null);
  const [addForm, setAddForm] = useState({ name: '', email: '', password: '', department: DEPARTMENTS[0] as string, role: 'member' as UserRole, phone: '', position: getPositionOptions(DEPARTMENTS[0])[0] as string });
  const [pwForm, setPwForm] = useState({ oldPassword: '', newPassword: '' });
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState<'error' | 'success'>('error');

  const isAdmin = currentUser?.role === 'admin';

  function showFeedback(msg: string, type: 'error' | 'success' = 'error') {
    setFeedback(msg);
    setFeedbackType(type);
    setTimeout(() => setFeedback(''), 3000);
  }

  function startEdit(user: User) {
    setEditingId(user.id);
    setEditForm({ name: user.name, department: user.department, role: user.role, phone: user.phone || '', position: user.position || '' });
  }

  async function saveEdit(id: string) {
    try {
      await updateUser(id, editForm);
      setEditingId(null);
      showFeedback('수정되었습니다.', 'success');
    } catch (e) {
      showFeedback((e as Error).message);
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const result = await register(addForm);
    if (result.success) {
      showFeedback('계정이 생성되었습니다.', 'success');
      setShowAddModal(false);
      setAddForm({ name: '', email: '', password: '', department: DEPARTMENTS[0], role: 'member', phone: '', position: getPositionOptions(DEPARTMENTS[0])[0] as string });
    } else {
      showFeedback(result.message);
    }
  }

  async function handleChangePw(e: React.FormEvent) {
    e.preventDefault();
    if (!showPwModal) return;
    const result = await changePassword(showPwModal.id, pwForm.oldPassword, pwForm.newPassword);
    if (result.success) {
      showFeedback('비밀번호가 변경되었습니다.', 'success');
      setShowPwModal(null);
      setPwForm({ oldPassword: '', newPassword: '' });
    } else {
      showFeedback(result.message);
    }
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-gray-400">
        <Shield size={48} className="mb-3 opacity-30" />
        <p className="text-lg font-medium">접근 권한이 없습니다</p>
        <p className="text-sm mt-1">관리자 계정으로 로그인해주세요.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users size={20} className="text-blue-500" />
          <h2 className="text-lg font-semibold text-gray-800">사용자 관리</h2>
          <span className="text-sm text-gray-400">({users.length}명)</span>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
        >
          <Plus size={15} />
          계정 추가
        </button>
      </div>

      {/* 피드백 */}
      {feedback && (
        <div className={clsx('px-4 py-3 rounded-lg text-sm', feedbackType === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700')}>
          {feedback}
        </div>
      )}

      {/* 사용자 테이블 */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">이름</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">이메일</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">부서</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">직급</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">전화번호</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">역할</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">등록일</th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {users.map(user => {
              const isEditing = editingId === user.id;
              const isSelf = currentUser?.id === user.id;
              return (
                <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3">
                    {isEditing ? (
                      <input
                        value={editForm.name}
                        onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                        className="border border-gray-200 rounded px-2 py-1 text-sm w-24 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center font-bold">
                          {user.name[0]}
                        </div>
                        <span className="font-medium text-gray-800">{user.name}</span>
                        {isSelf && <span className="text-xs text-blue-500">(나)</span>}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3 text-gray-600">{user.email}</td>
                  <td className="px-5 py-3">
                    {isEditing ? (
                      <select
                        value={editForm.department}
                        onChange={e => {
                          const dept = e.target.value;
                          setEditForm(f => ({ ...f, department: dept, position: getPositionOptions(dept)[0] as string }));
                        }}
                        className="border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                      >
                        {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    ) : (
                      <span className="text-gray-600">{user.department}</span>
                    )}
                  </td>
                  {/* 직급 */}
                  <td className="px-5 py-3">
                    {isEditing ? (
                      <select
                        value={editForm.position}
                        onChange={e => setEditForm(f => ({ ...f, position: e.target.value }))}
                        className="border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                      >
                        {getPositionOptions(editForm.department).map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    ) : (
                      <span className="text-gray-600 text-xs">{user.position || '-'}</span>
                    )}
                  </td>
                  {/* 전화번호 */}
                  <td className="px-5 py-3">
                    {isEditing ? (
                      <input
                        value={editForm.phone}
                        onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
                        placeholder="010-0000-0000"
                        className="border border-gray-200 rounded px-2 py-1 text-sm w-32 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    ) : (
                      <span className="text-gray-500 text-xs flex items-center gap-1">
                        {user.phone ? <><Phone size={11} className="text-gray-400" />{user.phone}</> : <span className="text-gray-300">-</span>}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    {isEditing ? (
                      <div className="relative">
                        <select
                          value={editForm.role}
                          onChange={e => setEditForm(f => ({ ...f, role: e.target.value as UserRole }))}
                          className="border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 appearance-none pr-6"
                        >
                          <option value="member">팀원</option>
                          <option value="manager">팀장</option>
                          <option value="admin">관리자</option>
                        </select>
                        <ChevronDown size={12} className="absolute right-1 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                      </div>
                    ) : (
                      <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', roleColors[user.role])}>
                        {RoleLabels[user.role]}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-gray-400 text-xs">
                    {format(new Date(user.createdAt), 'yyyy/MM/dd')}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {isEditing ? (
                        <>
                          <button onClick={() => saveEdit(user.id)} className="p-1.5 bg-green-100 text-green-600 rounded-lg hover:bg-green-200">
                            <Check size={14} />
                          </button>
                          <button onClick={() => setEditingId(null)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400">
                            <X size={14} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => { setShowPwModal(user); setPwForm({ oldPassword: '', newPassword: '' }); }}
                            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-blue-500"
                            title="비밀번호 변경"
                          >
                            <KeyRound size={14} />
                          </button>
                          <button onClick={() => startEdit(user)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-blue-500">
                            <Edit3 size={14} />
                          </button>
                          {!isSelf && (
                            deleteConfirm === user.id ? (
                              <>
                                <button onClick={() => { deleteUser(user.id); setDeleteConfirm(null); }} className="p-1.5 bg-red-100 text-red-500 rounded-lg">
                                  <Check size={14} />
                                </button>
                                <button onClick={() => setDeleteConfirm(null)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400">
                                  <X size={14} />
                                </button>
                              </>
                            ) : (
                              <button onClick={() => setDeleteConfirm(user.id)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-red-500">
                                <Trash2 size={14} />
                              </button>
                            )
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 계정 추가 모달 */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-800">새 계정 추가</h3>
              <button onClick={() => setShowAddModal(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
            </div>
            <form onSubmit={handleAdd} className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">이름</label>
                  <input type="text" value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">부서</label>
                  <select
                    value={addForm.department}
                    onChange={e => {
                      const dept = e.target.value;
                      setAddForm(f => ({ ...f, department: dept, position: getPositionOptions(dept)[0] as string }));
                    }}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    required
                  >
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">직급</label>
                  <select
                    value={addForm.position}
                    onChange={e => setAddForm(f => ({ ...f, position: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    {getPositionOptions(addForm.department).map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">전화번호</label>
                  <input
                    type="tel"
                    value={addForm.phone}
                    onChange={e => setAddForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="010-0000-0000"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
                <input type="email" value={addForm.email} onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">초기 비밀번호 (6자 이상)</label>
                <input type="password" value={addForm.password} onChange={e => setAddForm(f => ({ ...f, password: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">시스템 역할</label>
                <select value={addForm.role} onChange={e => setAddForm(f => ({ ...f, role: e.target.value as UserRole }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="member">팀원</option>
                  <option value="manager">팀장</option>
                  <option value="admin">관리자</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">취소</button>
                <button type="submit" className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">계정 생성</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 비밀번호 변경 모달 */}
      {showPwModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-800">{showPwModal.name} 비밀번호 변경</h3>
              <button onClick={() => setShowPwModal(null)} className="p-1 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
            </div>
            <form onSubmit={handleChangePw} className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">현재 비밀번호</label>
                <input type="password" value={pwForm.oldPassword} onChange={e => setPwForm(f => ({ ...f, oldPassword: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">새 비밀번호</label>
                <input type="password" value={pwForm.newPassword} onChange={e => setPwForm(f => ({ ...f, newPassword: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowPwModal(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">취소</button>
                <button type="submit" className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">변경</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
