import { useEffect, useState } from 'react';
import { useNoticeStore, Notice, NoticeCategory } from '../store/noticeStore';
import { useAuthStore } from '../store/authStore';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  Megaphone, Plus, Pin, PinOff, Trash2, Edit3, Check, X, ChevronDown, ChevronUp,
} from 'lucide-react';
import clsx from 'clsx';

const CATEGORIES: NoticeCategory[] = ['일반', '필독', '긴급', '안내'];

const CATEGORY_STYLES: Record<NoticeCategory, string> = {
  '일반': 'bg-gray-100 text-gray-600',
  '필독': 'bg-blue-100 text-blue-700',
  '긴급': 'bg-red-100 text-red-700',
  '안내': 'bg-green-100 text-green-700',
};

export default function NoticePage() {
  const { notices, isLoaded, fetchNotices, addNotice, updateNotice, deleteNotice } = useNoticeStore();
  const { currentUser } = useAuthStore();

  const canWrite = currentUser?.role === 'admin' || currentUser?.role === 'manager';
  const isAdmin = currentUser?.role === 'admin';

  const [showForm, setShowForm] = useState(false);
  const [openId, setOpenId]     = useState<string | null>(null);
  const [editId, setEditId]     = useState<string | null>(null);

  // 작성 폼 상태
  const [formTitle,    setFormTitle]    = useState('');
  const [formContent,  setFormContent]  = useState('');
  const [formPinned,   setFormPinned]   = useState(false);
  const [formCategory, setFormCategory] = useState<NoticeCategory>('일반');
  const [formError,    setFormError]    = useState('');
  const [submitting,   setSubmitting]   = useState(false);

  // 카테고리 필터
  const [filterCategory, setFilterCategory] = useState<NoticeCategory | 'all'>('all');

  // 삭제 확인
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => { fetchNotices(); }, []);

  function openCreateForm() {
    setEditId(null);
    setFormTitle('');
    setFormContent('');
    setFormPinned(false);
    setFormCategory('일반');
    setFormError('');
    setShowForm(true);
  }

  function openEditForm(notice: Notice) {
    setEditId(notice.id);
    setFormTitle(notice.title);
    setFormContent(notice.content);
    setFormPinned(notice.isPinned);
    setFormCategory(notice.category || '일반');
    setFormError('');
    setShowForm(true);
  }

  async function handleSubmit() {
    if (!formTitle.trim()) { setFormError('제목을 입력하세요.'); return; }
    setSubmitting(true);
    setFormError('');
    try {
      if (editId) {
        await updateNotice(editId, { title: formTitle.trim(), content: formContent, isPinned: formPinned, category: formCategory });
      } else {
        const created = await addNotice({ title: formTitle.trim(), content: formContent, isPinned: formPinned, category: formCategory });
        setOpenId(created.id);
      }
      setShowForm(false);
      setEditId(null);
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    await deleteNotice(id);
    setConfirmDeleteId(null);
    if (openId === id) setOpenId(null);
  }

  async function handleTogglePin(notice: Notice) {
    await updateNotice(notice.id, { isPinned: !notice.isPinned });
  }

  const pinnedNotices  = notices.filter((n) => n.isPinned && (filterCategory === 'all' || n.category === filterCategory));
  const normalNotices  = notices.filter((n) => !n.isPinned && (filterCategory === 'all' || n.category === filterCategory));
  const filteredTotal  = pinnedNotices.length + normalNotices.length;

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Megaphone size={20} className="text-green-600" />
          <h2 className="text-lg font-semibold text-gray-800">공지사항</h2>
          <span className="text-sm text-gray-400">({filteredTotal}/{notices.length})</span>
        </div>
        {canWrite && (
          <button
            onClick={openCreateForm}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700"
          >
            <Plus size={15} />
            공지 작성
          </button>
        )}
      </div>

      {/* 카테고리 필터 */}
      <div className="flex flex-wrap items-center gap-2">
        {(['all', ...CATEGORIES] as const).map((cat) => (
          <button
            key={cat}
            onClick={() => setFilterCategory(cat)}
            className={clsx(
              'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
              filterCategory === cat
                ? cat === 'all' ? 'bg-gray-800 text-white' : `${CATEGORY_STYLES[cat as NoticeCategory]} ring-2 ring-offset-1 ring-current`
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            )}
          >
            {cat === 'all' ? '전체' : cat}
          </button>
        ))}
      </div>

      {/* 작성/수정 폼 */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
          <h3 className="font-semibold text-gray-800">{editId ? '공지 수정' : '새 공지 작성'}</h3>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">제목 *</label>
            <input
              type="text"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="공지 제목"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">내용</label>
            <textarea
              value={formContent}
              onChange={(e) => setFormContent(e.target.value)}
              rows={6}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-y"
              placeholder="공지 내용을 작성하세요"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">카테고리</label>
            <div className="flex gap-2 flex-wrap">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setFormCategory(cat)}
                  className={clsx(
                    'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                    formCategory === cat ? CATEGORY_STYLES[cat] + ' ring-2 ring-offset-1 ring-current' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
          {isAdmin && (
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={formPinned}
                onChange={(e) => setFormPinned(e.target.checked)}
                className="rounded"
              />
              <Pin size={14} className="text-amber-500" />
              상단 고정 (중요 공지)
            </label>
          )}
          {formError && <p className="text-sm text-red-500">{formError}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {submitting ? '저장 중...' : (editId ? '수정 완료' : '공지 등록')}
            </button>
            <button
              onClick={() => { setShowForm(false); setEditId(null); }}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* 공지 없음 */}
      {isLoaded && notices.length === 0 && (
        <div className="text-center py-16 text-gray-400 bg-white rounded-xl border border-gray-100">
          <Megaphone size={48} className="mx-auto mb-3 opacity-20" />
          <p className="text-sm">등록된 공지사항이 없습니다.</p>
          {canWrite && (
            <button onClick={openCreateForm} className="mt-2 text-sm text-green-600 hover:underline">
              첫 번째 공지 작성하기
            </button>
          )}
        </div>
      )}

      {/* 고정 공지 */}
      {pinnedNotices.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1">
            <Pin size={11} /> 고정 공지
          </p>
          {pinnedNotices.map((n) => (
            <NoticeCard
              key={n.id}
              notice={n}
              isOpen={openId === n.id}
              onToggle={() => setOpenId(openId === n.id ? null : n.id)}
              onEdit={() => openEditForm(n)}
              onDelete={() => setConfirmDeleteId(n.id)}
              onTogglePin={() => handleTogglePin(n)}
              confirmDelete={confirmDeleteId === n.id}
              onConfirmDelete={() => handleDelete(n.id)}
              onCancelDelete={() => setConfirmDeleteId(null)}
              canEdit={(currentUser?.id === n.authorId) || isAdmin}
              isAdmin={isAdmin}
              isPinned
            />
          ))}
        </div>
      )}

      {/* 일반 공지 */}
      {normalNotices.length > 0 && (
        <div className="space-y-2">
          {pinnedNotices.length > 0 && (
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">일반 공지</p>
          )}
          {normalNotices.map((n) => (
            <NoticeCard
              key={n.id}
              notice={n}
              isOpen={openId === n.id}
              onToggle={() => setOpenId(openId === n.id ? null : n.id)}
              onEdit={() => openEditForm(n)}
              onDelete={() => setConfirmDeleteId(n.id)}
              onTogglePin={() => handleTogglePin(n)}
              confirmDelete={confirmDeleteId === n.id}
              onConfirmDelete={() => handleDelete(n.id)}
              onCancelDelete={() => setConfirmDeleteId(null)}
              canEdit={(currentUser?.id === n.authorId) || isAdmin}
              isAdmin={isAdmin}
              isPinned={false}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface NoticeCardProps {
  notice: Notice;
  isOpen: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
  confirmDelete: boolean;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  canEdit: boolean;
  isAdmin: boolean;
  isPinned: boolean;
}

function NoticeCard({
  notice, isOpen, onToggle, onEdit, onDelete, onTogglePin,
  confirmDelete, onConfirmDelete, onCancelDelete, canEdit, isAdmin, isPinned,
}: NoticeCardProps) {
  return (
    <div className={clsx('bg-white rounded-xl border shadow-sm', isPinned ? 'border-amber-200' : 'border-gray-100')}>
      <div className="flex items-center justify-between px-5 py-4">
        <button onClick={onToggle} className="flex items-center gap-3 flex-1 text-left min-w-0">
          {isPinned && <Pin size={14} className="text-amber-500 shrink-0" />}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {notice.category && notice.category !== '일반' && (
                <span className={clsx('px-2 py-0.5 rounded-full text-xs font-medium shrink-0', CATEGORY_STYLES[notice.category])}>
                  {notice.category}
                </span>
              )}
              <p className="font-semibold text-gray-800 truncate">{notice.title}</p>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              {notice.authorName} · {notice.department} ·{' '}
              {format(new Date(notice.createdAt), 'yyyy.MM.dd HH:mm', { locale: ko })}
            </p>
          </div>
          {isOpen ? <ChevronUp size={16} className="text-gray-400 shrink-0" /> : <ChevronDown size={16} className="text-gray-400 shrink-0" />}
        </button>

        {/* 관리 버튼 */}
        <div className="flex items-center gap-1 ml-3 shrink-0">
          {isAdmin && (
            <button
              onClick={onTogglePin}
              className={clsx('p-1.5 rounded-lg', isPinned ? 'text-amber-500 hover:bg-amber-50' : 'text-gray-400 hover:bg-gray-100')}
              title={isPinned ? '고정 해제' : '상단 고정'}
            >
              {isPinned ? <PinOff size={14} /> : <Pin size={14} />}
            </button>
          )}
          {canEdit && (
            <button onClick={onEdit} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-blue-500" title="수정">
              <Edit3 size={14} />
            </button>
          )}
          {canEdit && (
            confirmDelete ? (
              <>
                <button onClick={onConfirmDelete} className="p-1.5 bg-red-100 rounded-lg text-red-500">
                  <Check size={14} />
                </button>
                <button onClick={onCancelDelete} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400">
                  <X size={14} />
                </button>
              </>
            ) : (
              <button onClick={onDelete} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-red-500" title="삭제">
                <Trash2 size={14} />
              </button>
            )
          )}
        </div>
      </div>

      {isOpen && (
        <div className="border-t border-gray-100 px-5 py-4">
          <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
            {notice.content || <span className="text-gray-400 italic">(내용 없음)</span>}
          </p>
        </div>
      )}
    </div>
  );
}
