import { useState, useEffect } from 'react';
import { useDocumentStore } from '../store/documentStore';
import { exportDocumentsToExcel } from '../utils/exportExcel';
import { exportDocumentsToPDF } from '../utils/exportPDF';
import {
  Plus,
  Search,
  FolderOpen,
  Trash2,
  Edit3,
  X,
  Check,
  FileText,
  Tag,
  Filter,
  Sheet,
  FileDown,
} from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import clsx from 'clsx';
import { Document, DocumentCategory } from '../types';

const categories: DocumentCategory[] = ['계획서', '보고서', '회의록', '제안서', '매뉴얼', '기타'];

const categoryColors: Record<DocumentCategory, string> = {
  계획서: 'bg-blue-100 text-blue-700',
  보고서: 'bg-green-100 text-green-700',
  회의록: 'bg-purple-100 text-purple-700',
  제안서: 'bg-orange-100 text-orange-700',
  매뉴얼: 'bg-teal-100 text-teal-700',
  기타: 'bg-gray-100 text-gray-700',
};

const emptyForm = {
  title: '',
  content: '',
  category: '기타' as DocumentCategory,
  tags: [] as string[],
};

export default function DocumentsPage() {
  const { documents, addDocument, updateDocument, deleteDocument, searchDocuments, fetchDocuments } =
    useDocumentStore();
  const [query, setQuery] = useState('');

  useEffect(() => { fetchDocuments(); }, []);
  const [filterCat, setFilterCat] = useState<DocumentCategory | 'all'>('all');
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Document | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [tagInput, setTagInput] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [viewDoc, setViewDoc] = useState<Document | null>(null);

  const displayed = (query ? searchDocuments(query) : documents).filter(
    (d) => filterCat === 'all' || d.category === filterCat
  );

  function openAddModal() {
    setEditTarget(null);
    setForm(emptyForm);
    setShowModal(true);
  }

  function openEditModal(doc: Document) {
    setEditTarget(doc);
    setForm({ title: doc.title, content: doc.content, category: doc.category, tags: doc.tags });
    setShowModal(true);
  }

  function handleSubmit() {
    if (!form.title.trim()) return;
    if (editTarget) {
      updateDocument(editTarget.id, form);
    } else {
      addDocument(form);
    }
    setShowModal(false);
  }

  function addTag() {
    const t = tagInput.trim();
    if (t && !form.tags.includes(t)) {
      setForm((f) => ({ ...f, tags: [...f.tags, t] }));
    }
    setTagInput('');
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">문서 관리</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportDocumentsToExcel(displayed)}
            className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700"
            title="엑셀로 내보내기"
          >
            <Sheet size={14} /> 엑셀
          </button>
          <button
            onClick={() => exportDocumentsToPDF(displayed)}
            className="flex items-center gap-1.5 px-3 py-2 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600"
            title="PDF로 내보내기"
          >
            <FileDown size={14} /> PDF
          </button>
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
          >
            <Plus size={16} />
            문서 추가
          </button>
        </div>
      </div>

      {/* 검색 & 필터 */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="제목, 내용, 태그로 검색..."
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Filter size={14} className="text-gray-400" />
          <button
            onClick={() => setFilterCat('all')}
            className={clsx(
              'text-xs px-3 py-1.5 rounded-full font-medium transition-colors',
              filterCat === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}
          >
            전체
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCat(cat)}
              className={clsx(
                'text-xs px-3 py-1.5 rounded-full font-medium transition-colors',
                filterCat === cat ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* 문서 목록 */}
      {displayed.length === 0 ? (
        <div className="text-center py-16 text-gray-400 bg-white rounded-xl border border-gray-100">
          <FolderOpen size={48} className="mx-auto mb-3 opacity-30" />
          <p>{query ? '검색 결과가 없습니다' : '문서가 없습니다'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayed.map((doc) => (
            <div
              key={doc.id}
              className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <button
                    onClick={() => setViewDoc(doc)}
                    className="flex-1 text-left"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <FileText size={15} className="text-gray-400 shrink-0" />
                      <p className="text-sm font-semibold text-gray-800 line-clamp-1">{doc.title}</p>
                    </div>
                    <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', categoryColors[doc.category])}>
                      {doc.category}
                    </span>
                    <p className="text-xs text-gray-500 mt-2 line-clamp-2 leading-relaxed">
                      {doc.content}
                    </p>
                  </button>
                </div>

                {doc.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-3">
                    {doc.tags.map((tag) => (
                      <span key={tag} className="text-xs text-gray-500 flex items-center gap-0.5">
                        <Tag size={9} />
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
                  <p className="text-xs text-gray-400">
                    {format(new Date(doc.updatedAt), 'yyyy/MM/dd', { locale: ko })}
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditModal(doc)}
                      className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-blue-500"
                    >
                      <Edit3 size={13} />
                    </button>
                    {deleteConfirm === doc.id ? (
                      <>
                        <button
                          onClick={() => { deleteDocument(doc.id); setDeleteConfirm(null); }}
                          className="p-1 bg-red-100 rounded text-red-500"
                        >
                          <Check size={13} />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="p-1 hover:bg-gray-100 rounded text-gray-400"
                        >
                          <X size={13} />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm(doc.id)}
                        className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-red-500"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 문서 보기 모달 */}
      {viewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h3 className="font-semibold text-gray-800">{viewDoc.title}</h3>
                <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', categoryColors[viewDoc.category])}>
                  {viewDoc.category}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { openEditModal(viewDoc); setViewDoc(null); }}
                  className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400"
                >
                  <Edit3 size={16} />
                </button>
                <button
                  onClick={() => setViewDoc(null)}
                  className="p-1.5 hover:bg-gray-100 rounded-lg"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="px-6 py-5 overflow-y-auto flex-1">
              <pre className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed font-sans">
                {viewDoc.content}
              </pre>
              {viewDoc.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-100">
                  {viewDoc.tags.map((tag) => (
                    <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 추가/수정 모달 */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-800">
                {editTarget ? '문서 수정' : '문서 추가'}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X size={18} />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4 max-h-[65vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">제목 *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="문서 제목"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">카테고리</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as DocumentCategory }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">내용</label>
                <textarea
                  value={form.content}
                  onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                  rows={6}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="문서 내용을 입력하세요"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">태그</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addTag()}
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="태그 입력 후 Enter"
                  />
                  <button
                    type="button"
                    onClick={addTag}
                    className="px-3 py-2 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200"
                  >
                    추가
                  </button>
                </div>
                {form.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {form.tags.map((t) => (
                      <span
                        key={t}
                        className="flex items-center gap-1 text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full"
                      >
                        #{t}
                        <button
                          onClick={() => setForm((f) => ({ ...f, tags: f.tags.filter((x) => x !== t) }))}
                        >
                          <X size={10} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                취소
              </button>
              <button
                onClick={handleSubmit}
                disabled={!form.title.trim()}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {editTarget ? '수정 완료' : '문서 추가'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
