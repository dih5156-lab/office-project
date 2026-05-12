import { useEffect, useState } from 'react';
import { Trash2, RotateCcw, X, AlertTriangle } from 'lucide-react';
import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';

interface TrashItem {
  id: string;
  type: 'schedule' | 'document' | 'report' | 'notice';
  title: string;
  deletedAt: string;
}

const TYPE_LABELS: Record<TrashItem['type'], string> = {
  schedule: '일정',
  document: '문서',
  report: '주간보고',
  notice: '공지',
};

const TYPE_COLORS: Record<TrashItem['type'], string> = {
  schedule: 'bg-blue-100 text-blue-700',
  document: 'bg-violet-100 text-violet-700',
  report: 'bg-amber-100 text-amber-700',
  notice: 'bg-rose-100 text-rose-700',
};

export default function TrashPage() {
  const { currentUser } = useAuthStore();
  const isAdmin = currentUser?.role === 'admin';

  const [items, setItems] = useState<TrashItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [emptyConfirm, setEmptyConfirm] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.get<TrashItem[]>('/trash');
      setItems(data);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const restore = async (item: TrashItem) => {
    setProcessing(item.id);
    try {
      await api.post(`/trash/${item.type}/${item.id}/restore`, {});
      setItems(prev => prev.filter(i => i.id !== item.id));
    } catch (e: unknown) {
      alert((e as Error).message);
    } finally {
      setProcessing(null);
    }
  };

  const permanentDelete = async (item: TrashItem) => {
    if (!confirm(`"${item.title}" 을(를) 영구 삭제하시겠습니까? 복구할 수 없습니다.`)) return;
    setProcessing(item.id);
    try {
      await api.delete(`/trash/${item.type}/${item.id}`);
      setItems(prev => prev.filter(i => i.id !== item.id));
    } catch (e: unknown) {
      alert((e as Error).message);
    } finally {
      setProcessing(null);
    }
  };

  const emptyTrash = async () => {
    setEmptyConfirm(false);
    try {
      const res = await api.post<{ deleted: number }>('/trash/empty', { days: 30 });
      alert(`${res.deleted}개 항목이 영구 삭제되었습니다.`);
      await load();
    } catch (e: unknown) {
      alert((e as Error).message);
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center">
            <Trash2 size={20} className="text-rose-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">휴지통</h1>
            <p className="text-sm text-gray-500">삭제된 항목을 복원하거나 영구 삭제할 수 있습니다.</p>
          </div>
        </div>
        {isAdmin && items.length > 0 && (
          <button
            onClick={() => setEmptyConfirm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Trash2 size={15} />
            30일 이상 항목 비우기
          </button>
        )}
      </div>

      {/* 안내 배너 */}
      <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
        <AlertTriangle size={16} className="shrink-0 mt-0.5" />
        <span>휴지통의 항목은 30일 후 자동으로 영구 삭제됩니다. 복원이 필요하다면 미리 복원해 주세요.</span>
      </div>

      {/* 목록 */}
      {loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">불러오는 중...</div>
      ) : error ? (
        <div className="text-center py-16 text-rose-500 text-sm">{error}</div>
      ) : items.length === 0 ? (
        <div className="text-center py-20">
          <Trash2 size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-400 text-sm">휴지통이 비어 있습니다.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="divide-y divide-gray-50">
            {items.map(item => (
              <div
                key={item.id}
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors"
              >
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${TYPE_COLORS[item.type]}`}>
                  {TYPE_LABELS[item.type]}
                </span>
                <span className="flex-1 text-sm text-gray-800 truncate">{item.title}</span>
                <span className="text-xs text-gray-400 shrink-0">{formatDate(item.deletedAt)}</span>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => restore(item)}
                    disabled={processing === item.id}
                    title="복원"
                    className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-500 hover:text-blue-700 transition-colors disabled:opacity-40"
                  >
                    <RotateCcw size={15} />
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() => permanentDelete(item)}
                      disabled={processing === item.id}
                      title="영구 삭제"
                      className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-400 hover:text-rose-600 transition-colors disabled:opacity-40"
                    >
                      <X size={15} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 비우기 확인 모달 */}
      {emptyConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center">
                <AlertTriangle size={20} className="text-rose-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">휴지통 비우기</h3>
                <p className="text-sm text-gray-500">30일 이상 된 항목을 모두 영구 삭제합니다.</p>
              </div>
            </div>
            <p className="text-sm text-gray-700 mb-5">이 작업은 되돌릴 수 없습니다. 계속하시겠습니까?</p>
            <div className="flex gap-2">
              <button
                onClick={() => setEmptyConfirm(false)}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={emptyTrash}
                className="flex-1 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium rounded-lg"
              >
                영구 삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
