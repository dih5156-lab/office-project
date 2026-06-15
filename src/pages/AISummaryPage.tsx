import { useState, useEffect, useRef, useCallback } from 'react';
import { useAISummaryStore } from '../store/aiSummaryStore';
import { useFileStore, formatFileSize, fileColor, fileExt } from '../store/fileStore';
import { useDocumentStore } from '../store/documentStore';
import { useReportStore } from '../store/reportStore';
import { useAuthStore } from '../store/authStore';
import {
  BrainCircuit, Loader2, Trash2, ChevronDown, ChevronUp, Sparkles,
  Tag, ListTodo, CheckCircle2, AlertCircle, FileUp, Upload, CheckCircle,
  FileText, ArrowRight, RefreshCw, ClipboardList, Save, Copy, CheckCheck,
} from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import clsx from 'clsx';
import { SummaryType, AutoDocResult, DocumentCategory, TaskItem } from '../types';

const typeOptions: SummaryType[] = ['회의록', '보고서', '이메일', '문서', '기타'];

const typeColors: Record<SummaryType, string> = {
  회의록: 'bg-blue-100 text-blue-700',
  보고서: 'bg-green-100 text-green-700',
  이메일: 'bg-purple-100 text-purple-700',
  문서: 'bg-orange-100 text-orange-700',
  기타: 'bg-gray-100 text-gray-700',
};

const docCategories: DocumentCategory[] = ['계획서', '보고서', '회의록', '제안서', '매뉴얼', '기타'];

export default function AISummaryPage() {
  const { summaries, isProcessing, processSummary, deleteSummary, fetchSummaries } = useAISummaryStore();
  const { autoDocument, isAutoDoc } = useFileStore();
  const { fetchDocuments } = useDocumentStore();
  const { addReport } = useReportStore();
  const { currentUser } = useAuthStore();
  const [title, setTitle] = useState('');

  useEffect(() => { fetchSummaries(); }, []);
  const [text, setText] = useState('');
  const [type, setType] = useState<SummaryType>('회의록');
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [ollamaStatus, setOllamaStatus] = useState<{ available: boolean; models: string[] } | null>(null);
  const [ollamaChecking, setOllamaChecking] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // 탭: 'text' | 'file' | 'convert'
  const [tab, setTab] = useState<'text' | 'file' | 'convert'>('text');
  // 출력 언어
  const [lang, setLang] = useState<'ko' | 'en' | 'ja' | 'auto'>('ko');

  // AI 자동 문서화 상태
  const [autoDocFile, setAutoDocFile] = useState<File | null>(null);
  const [autoDocCategory, setAutoDocCategory] = useState<DocumentCategory>('회의록' as DocumentCategory);
  const [autoDocResult, setAutoDocResult] = useState<AutoDocResult | null>(null);
  const [autoDocError, setAutoDocError] = useState('');

  // 오피스 문서 변환 상태
  type ConvertTarget = '주간보고서' | '회의록' | '보고서' | '공지사항';
  interface ConvertResult {
    type: ConvertTarget;
    data?: { weekStart: string; weekEnd: string; completedTasks: TaskItem[]; inProgressTasks: TaskItem[]; nextWeekTasks: TaskItem[]; issues: string; notes: string };
    content?: string;
    title?: string;
    documentId?: string;
    originalName: string;
  }
  const [convertFile, setConvertFile] = useState<File | null>(null);
  const [convertTarget, setConvertTarget] = useState<ConvertTarget>('주간보고서');
  const [convertResult, setConvertResult] = useState<ConvertResult | null>(null);
  const [convertError, setConvertError] = useState('');
  const [isConverting, setIsConverting] = useState(false);
  const [convertSaved, setConvertSaved] = useState(false);
  const convertFileRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const checkOllamaStatus = () => {
    setOllamaChecking(true);
    fetch('/api/ai/status')
      .then((r) => r.json())
      .then(setOllamaStatus)
      .catch(() => setOllamaStatus({ available: false, models: [] }))
      .finally(() => setOllamaChecking(false));
  };

  useEffect(() => { checkOllamaStatus(); }, []);

  const handleCopySummary = (id: string, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  async function handleSubmit() {
    if (!title.trim() || !text.trim()) {
      setError('제목과 내용을 모두 입력하세요.');
      return;
    }
    setError('');
    const result = await processSummary(title, text, type, lang);
    setOpenId(result.id);
    setTitle('');
    setText('');
  }

  // 드래그 앤 드롭
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) { setAutoDocFile(file); setAutoDocResult(null); setAutoDocError(''); }
  }, []);

  async function handleAutoDoc() {
    if (!autoDocFile) return;
    setAutoDocError('');
    setAutoDocResult(null);
    try {
      const result = await autoDocument(autoDocFile, autoDocCategory, lang);
      setAutoDocResult(result);
      // 문서 스토어 갱신 (새 문서가 추가됨)
      useDocumentStore.setState({ isLoaded: false });
      await fetchDocuments();
    } catch (e) {
      setAutoDocError((e as Error).message);
    }
  }

  async function handleConvert() {
    if (!convertFile) return;
    setConvertError('');
    setConvertResult(null);
    setConvertSaved(false);
    setIsConverting(true);
    try {
      const formData = new FormData();
      formData.append('file', convertFile);
      formData.append('targetType', convertTarget);
      formData.append('lang', lang);
      const token = localStorage.getItem('office_token') ?? '';
      const res = await fetch('http://localhost:3001/api/ai/convert-office', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '변환 실패');
      setConvertResult(data);
      if (data.type !== '주간보고서') {
        // 문서함 갱신
        useDocumentStore.setState({ isLoaded: false });
        await fetchDocuments();
      }
    } catch (e) {
      setConvertError((e as Error).message);
    } finally {
      setIsConverting(false);
    }
  }

  async function handleSaveAsReport() {
    if (!convertResult?.data || !currentUser) return;
    const d = convertResult.data;
    await addReport({
      weekStart: d.weekStart,
      weekEnd: d.weekEnd,
      author: currentUser.name,
      department: currentUser.department,
      completedTasks: d.completedTasks,
      inProgressTasks: d.inProgressTasks,
      nextWeekTasks: d.nextWeekTasks,
      issues: d.issues,
      notes: d.notes,
      status: '작성중',
    });
    setConvertSaved(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <BrainCircuit size={22} className="text-orange-500" />
        <h2 className="text-lg font-semibold text-gray-800">AI 문서 도구</h2>
      </div>

      {/* Ollama 상태 배너 */}
      {ollamaStatus && (
        ollamaStatus.available ? (
          <div className="flex items-center justify-between px-4 py-2.5 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={15} />
              <span>Ollama 연결됨 — 사용 가능한 모델: {ollamaStatus.models.join(', ') || '없음'}</span>
            </div>
            <button
              onClick={checkOllamaStatus}
              disabled={ollamaChecking}
              className="flex items-center gap-1 text-xs text-green-600 hover:text-green-800 disabled:opacity-50"
            >
              <RefreshCw size={13} className={ollamaChecking ? 'animate-spin' : ''} />
            </button>
          </div>
        ) : (
          <div className="px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-medium">
                <AlertCircle size={15} />
                Ollama 미연결 — AI 기능을 사용하려면 아래 단계를 따르세요
              </div>
              <button
                onClick={checkOllamaStatus}
                disabled={ollamaChecking}
                className="flex items-center gap-1 text-xs px-2.5 py-1 bg-amber-100 hover:bg-amber-200 rounded-lg font-semibold text-amber-700 disabled:opacity-50 transition-colors"
              >
                {ollamaChecking ? (
                  <><Loader2 size={12} className="animate-spin" />확인 중...</>
                ) : (
                  <><RefreshCw size={12} />재연결 확인</>
                )}
              </button>
            </div>
            <ol className="pl-5 space-y-0.5 text-xs text-amber-600 list-decimal">
              <li><a href="https://ollama.com" target="_blank" rel="noreferrer" className="underline">ollama.com</a>에서 Ollama 설치</li>
              <li>터미널: <code className="bg-amber-100 px-1 rounded">ollama pull qwen2.5:7b</code> (약 4.7GB, 최초 1회)</li>
              <li>터미널: <code className="bg-amber-100 px-1 rounded">ollama serve</code> 실행 후 위 버튼으로 재연결 확인</li>
            </ol>
          </div>
        )
      )}

      {/* ── 탭 + 언어 선택 ── */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
          <button
            onClick={() => setTab('text')}
            className={clsx(
              'flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg transition-all',
              tab === 'text' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400 hover:text-gray-600'
            )}
          >
            <Sparkles size={14} /> 텍스트 요약
          </button>
          <button
            onClick={() => setTab('file')}
            className={clsx(
              'flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg transition-all',
              tab === 'file' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400 hover:text-gray-600'
            )}
          >
            <FileUp size={14} /> 파일 자동 문서화
          </button>
          <button
            onClick={() => setTab('convert')}
            className={clsx(
              'flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg transition-all',
              tab === 'convert' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400 hover:text-gray-600'
            )}
          >
            <RefreshCw size={14} /> 오피스 문서 변환
          </button>
        </div>

        {/* 출력 언어 선택 */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-gray-500 font-medium">출력 언어</span>
          <div className="flex gap-1 p-0.5 bg-gray-100 rounded-lg">
            {([
              { value: 'ko', label: '🇰🇷 한국어' },
              { value: 'en', label: '🇺🇸 English' },
              { value: 'ja', label: '🇯🇵 日本語' },
              { value: 'auto', label: '🌐 자동' },
            ] as const).map((opt) => (
              <button
                key={opt.value}
                onClick={() => setLang(opt.value)}
                className={clsx(
                  'px-2.5 py-1 text-xs font-medium rounded-md transition-all',
                  lang === opt.value ? 'bg-white shadow-sm text-gray-800' : 'text-gray-400 hover:text-gray-600'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ══════════ 탭 1: 텍스트 요약 ══════════ */}
      {tab === 'text' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">제목</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                placeholder="회의록 제목, 문서명 등"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">문서 유형</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as SummaryType)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              >
                {typeOptions.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">원본 내용</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={8}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
              placeholder="요약할 내용을 붙여넣기 하세요. (회의록, 보고서, 이메일, 공지사항 등)"
            />
            <div className="flex items-center justify-between mt-1">
              <p className="text-xs text-gray-400">{text.length}자</p>
              {error && <p className="text-xs text-red-500">{error}</p>}
            </div>
          </div>
          <button
            onClick={handleSubmit}
            disabled={isProcessing || !title.trim() || !text.trim()}
            className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 disabled:opacity-50 transition-colors"
          >
            {isProcessing ? (
              <><Loader2 size={16} className="animate-spin" />AI 분석 중...</>
            ) : (
              <><Sparkles size={16} />AI 요약 시작</>
            )}
          </button>
        </div>
      )}

      {/* ══════════ 탭 2: 파일 자동 문서화 ══════════ */}
      {tab === 'file' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
            <div>
              <p className="text-sm font-semibold text-gray-800 mb-1">파일 업로드 → AI 자동 문서화</p>
              <p className="text-xs text-gray-400">TXT, PDF, DOCX, XLSX, PPTX, HWP 파일을 업로드하면 AI가 내용을 분석하여 자동으로 문서를 생성합니다.</p>
            </div>

            {/* 드롭 존 */}
            <div
              ref={dropRef}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={clsx(
                'flex flex-col items-center justify-center gap-3 py-10 border-2 border-dashed rounded-xl cursor-pointer transition-colors',
                autoDocFile
                  ? 'border-orange-300 bg-orange-50'
                  : 'border-gray-200 hover:border-orange-300 hover:bg-orange-50/30'
              )}
            >
              {autoDocFile ? (
                <>
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-sm font-extrabold text-white"
                    style={{ background: fileColor(autoDocFile.type) }}
                  >
                    {fileExt(autoDocFile.name).slice(0, 4)}
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-800">{autoDocFile.name}</p>
                    <p className="text-xs text-gray-400">{formatFileSize(autoDocFile.size)}</p>
                  </div>
                  <button
                    className="text-xs text-orange-500 underline"
                    onClick={(e) => { e.stopPropagation(); setAutoDocFile(null); setAutoDocResult(null); }}
                  >
                    파일 변경
                  </button>
                </>
              ) : (
                <>
                  <Upload size={32} className="text-gray-300" />
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-600">파일을 드래그하거나 클릭하여 선택</p>
                    <p className="text-xs text-gray-400 mt-1">지원 형식: TXT · PDF · DOCX · XLSX · PPTX · HWP (최대 20MB)</p>
                  </div>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.pdf,.docx,.doc"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) { setAutoDocFile(f); setAutoDocResult(null); setAutoDocError(''); }
                  e.target.value = '';
                }}
              />
            </div>

            {/* 카테고리 선택 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">문서 카테고리</label>
              <select
                value={autoDocCategory}
                onChange={(e) => setAutoDocCategory(e.target.value as DocumentCategory)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              >
                {docCategories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {autoDocError && (
              <div className="flex items-center gap-2 px-3.5 py-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
                <AlertCircle size={14} /> {autoDocError}
              </div>
            )}

            <button
              onClick={handleAutoDoc}
              disabled={!autoDocFile || isAutoDoc}
              className="w-full flex items-center justify-center gap-2 py-3 text-sm font-bold text-white rounded-xl disabled:opacity-40 transition-all hover:shadow-lg hover:shadow-orange-200/60"
              style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)' }}
            >
              {isAutoDoc ? (
                <><Loader2 size={16} className="animate-spin" />AI 문서화 진행 중...</>
              ) : (
                <><BrainCircuit size={16} />AI 자동 문서 생성</>
              )}
            </button>
          </div>

          {/* 결과 */}
          {autoDocResult && (
            <div className="bg-white rounded-xl border border-orange-200 shadow-sm p-6 space-y-4">
              <div className="flex items-center gap-2">
                <CheckCircle size={18} className="text-green-500" />
                <p className="font-semibold text-gray-800">자동 문서화 완료!</p>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <FileText size={18} className="text-blue-500" />
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{autoDocResult.document.title}</p>
                    <p className="text-xs text-gray-400">
                      카테고리: {autoDocResult.document.category} · 원문 {autoDocResult.extractedLength.toLocaleString()}자 추출
                    </p>
                  </div>
                </div>
                <a
                  href="/documents"
                  className="flex items-center gap-1 text-xs text-blue-600 font-semibold hover:underline"
                  onClick={(e) => { e.preventDefault(); window.location.hash = ''; }}
                >
                  문서 관리에서 확인 <ArrowRight size={12} />
                </a>
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">생성된 내용 미리보기</p>
                <pre className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed font-sans max-h-48 overflow-y-auto">
                  {autoDocResult.document.content}
                </pre>
              </div>
              {autoDocResult.document.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {autoDocResult.document.tags.map((t) => (
                    <span key={t} className="text-xs bg-orange-50 text-orange-700 px-2.5 py-1 rounded-full">#{t}</span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ══════════ 탭 3: 오피스 문서 변환 ══════════ */}
      {tab === 'convert' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-5">
            <div>
              <p className="text-sm font-semibold text-gray-800 mb-1">오피스 문서 자동 변환</p>
              <p className="text-xs text-gray-400">
                작성해둔 문서(양식, 회의록, 보고서 등)를 업로드하면 AI가 내용을 분석하여 원하는 형식으로 자동 변환합니다.
                주간보고서로 변환 시 보고서 시스템에 바로 등록됩니다.
              </p>
            </div>

            {/* 변환 대상 선택 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">변환할 형식</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {([
                  { value: '주간보고서', icon: ClipboardList, desc: '보고서 시스템에 바로 등록', color: 'blue' },
                  { value: '회의록', icon: FileText, desc: '표준 회의록으로 정리', color: 'purple' },
                  { value: '보고서', icon: FileText, desc: '업무 보고서 형식으로', color: 'green' },
                  { value: '공지사항', icon: FileText, desc: '공지 형식으로 정리', color: 'orange' },
                ] as const).map(({ value, icon: Icon, desc, color }) => (
                  <button
                    key={value}
                    onClick={() => { setConvertTarget(value); setConvertResult(null); setConvertError(''); setConvertSaved(false); }}
                    className={clsx(
                      'flex flex-col items-start gap-1 p-3 rounded-xl border-2 text-left transition-all',
                      convertTarget === value
                        ? color === 'blue' ? 'border-blue-500 bg-blue-50' : color === 'purple' ? 'border-purple-500 bg-purple-50' : color === 'green' ? 'border-green-500 bg-green-50' : 'border-orange-500 bg-orange-50'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    )}
                  >
                    <div className={clsx('flex items-center gap-1.5 font-semibold text-sm',
                      convertTarget === value
                        ? color === 'blue' ? 'text-blue-700' : color === 'purple' ? 'text-purple-700' : color === 'green' ? 'text-green-700' : 'text-orange-700'
                        : 'text-gray-700'
                    )}>
                      <Icon size={13} /> {value}
                    </div>
                    <p className="text-xs text-gray-400 leading-tight">{desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* 파일 업로드 */}
            <div
              onClick={() => convertFileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files[0];
                if (f) { setConvertFile(f); setConvertResult(null); setConvertError(''); setConvertSaved(false); }
              }}
              className={clsx(
                'flex flex-col items-center justify-center gap-2 py-8 border-2 border-dashed rounded-xl cursor-pointer transition-colors',
                convertFile ? 'border-blue-300 bg-blue-50' : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/30'
              )}
            >
              {convertFile ? (
                <div className="text-center space-y-1">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xs font-extrabold text-white mx-auto"
                    style={{ background: fileColor(convertFile.type) }}>
                    {fileExt(convertFile.name).slice(0, 4)}
                  </div>
                  <p className="text-sm font-medium text-gray-800">{convertFile.name}</p>
                  <p className="text-xs text-gray-400">{formatFileSize(convertFile.size)}</p>
                  <button className="text-xs text-blue-500 underline" onClick={(e) => { e.stopPropagation(); setConvertFile(null); setConvertResult(null); }}>
                    파일 변경
                  </button>
                </div>
              ) : (
                <>
                  <Upload size={28} className="text-gray-300" />
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-600">파일을 드래그하거나 클릭하여 선택</p>
                    <p className="text-xs text-gray-400 mt-0.5">TXT · PDF · DOCX · XLSX · PPTX · HWP 지원</p>
                  </div>
                </>
              )}
              <input ref={convertFileRef} type="file" accept=".txt,.pdf,.docx,.doc,.xlsx,.pptx,.ppt,.hwp,.hwpx" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) { setConvertFile(f); setConvertResult(null); setConvertError(''); setConvertSaved(false); } e.target.value = ''; }} />
            </div>

            {convertError && (
              <div className="flex items-center gap-2 px-3.5 py-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
                <AlertCircle size={14} /> {convertError}
              </div>
            )}

            <button
              onClick={handleConvert}
              disabled={!convertFile || isConverting}
              className="w-full flex items-center justify-center gap-2 py-3 text-sm font-bold text-white rounded-xl disabled:opacity-40 transition-all hover:shadow-lg hover:shadow-blue-200/60"
              style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)' }}
            >
              {isConverting
                ? <><Loader2 size={16} className="animate-spin" />AI 변환 중... (최대 2분 소요)</>
                : <><RefreshCw size={16} />{convertTarget}(으)로 변환</>}
            </button>
          </div>

          {/* 변환 결과 */}
          {convertResult && (
            <div className="bg-white rounded-xl border border-blue-200 shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle size={18} className="text-green-500" />
                  <p className="font-semibold text-gray-800">변환 완료 — {convertResult.type}</p>
                </div>
                <span className="text-xs text-gray-400">{convertResult.originalName}</span>
              </div>

              {/* 주간보고서 변환 결과 */}
              {convertResult.type === '주간보고서' && convertResult.data && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: '완료 업무', tasks: convertResult.data.completedTasks, color: 'green' },
                      { label: '진행 중', tasks: convertResult.data.inProgressTasks, color: 'blue' },
                      { label: '다음 주 예정', tasks: convertResult.data.nextWeekTasks, color: 'purple' },
                    ].map(({ label, tasks, color }) => (
                      <div key={label} className={clsx('rounded-xl p-3 space-y-2',
                        color === 'green' ? 'bg-green-50' : color === 'blue' ? 'bg-blue-50' : 'bg-purple-50'
                      )}>
                        <p className={clsx('text-xs font-bold',
                          color === 'green' ? 'text-green-700' : color === 'blue' ? 'text-blue-700' : 'text-purple-700'
                        )}>{label} ({tasks.length}건)</p>
                        {tasks.length === 0
                          ? <p className="text-xs text-gray-400">없음</p>
                          : tasks.map((t, i) => (
                            <div key={i} className="text-xs text-gray-700 bg-white rounded-lg px-2 py-1.5 shadow-sm">
                              {t.category && <span className="font-medium text-gray-500 mr-1">[{t.category}]</span>}
                              {t.content}
                              {'progress' in t && (t as TaskItem).progress < 100 && (
                                <span className="ml-1 text-gray-400">({(t as TaskItem).progress}%)</span>
                              )}
                            </div>
                          ))
                        }
                      </div>
                    ))}
                  </div>
                  {convertResult.data.issues && (
                    <div className="bg-red-50 rounded-xl p-3">
                      <p className="text-xs font-bold text-red-700 mb-1">이슈</p>
                      <p className="text-xs text-gray-700">{convertResult.data.issues}</p>
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <p className="text-xs text-gray-500">기간: {convertResult.data.weekStart} ~ {convertResult.data.weekEnd}</p>
                    {convertSaved ? (
                      <span className="flex items-center gap-1 text-sm text-green-600 font-semibold">
                        <CheckCircle2 size={14} /> 주간보고서에 저장 완료! (보고서 메뉴에서 확인)
                      </span>
                    ) : (
                      <button
                        onClick={handleSaveAsReport}
                        className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <Save size={14} /> 주간보고서로 저장
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* 일반 문서 변환 결과 */}
              {convertResult.type !== '주간보고서' && convertResult.content && (
                <div className="space-y-3">
                  <div className="bg-gray-50 rounded-xl p-4 max-h-72 overflow-y-auto">
                    <pre className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed font-sans">
                      {convertResult.content}
                    </pre>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-green-600">
                    <CheckCircle2 size={13} />
                    문서함에 자동 저장 완료 — '{convertResult.title}'
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 요약 결과 목록 — 텍스트 요약 탭에서만 표시 */}
      {tab === 'text' && (summaries.length === 0 ? (
        <div className="text-center py-16 text-gray-400 bg-white rounded-xl border border-gray-100">
          <BrainCircuit size={48} className="mx-auto mb-3 opacity-30" />
          <p>아직 요약된 내용이 없습니다</p>
          <p className="text-xs mt-1">위에 내용을 입력하고 AI 요약을 시작해보세요</p>
        </div>
      ) : (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">요약 기록 ({summaries.length}건)</h3>
          {summaries.map((item) => (
            <div key={item.id} className="bg-white rounded-xl border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between px-5 py-4">
                <button
                  onClick={() => setOpenId(openId === item.id ? null : item.id)}
                  className="flex items-center gap-3 flex-1 text-left"
                >
                  <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', typeColors[item.type])}>
                    {item.type}
                  </span>
                  <div>
                    <p className="font-medium text-gray-800 text-sm">{item.title}</p>
                    <p className="text-xs text-gray-400">
                      {format(new Date(item.createdAt), 'yyyy/MM/dd HH:mm', { locale: ko })}
                    </p>
                  </div>
                  <div className="ml-auto">
                    {openId === item.id ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
                  </div>
                </button>
                <div className="flex items-center gap-1 ml-3">
                  <button
                    onClick={() => handleCopySummary(item.id, item.summaryText)}
                    className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-300 hover:text-blue-500 transition-colors"
                    title="요약 복사"
                  >
                    {copiedId === item.id ? <CheckCheck size={15} className="text-green-500" /> : <Copy size={15} />}
                  </button>
                  <button
                    onClick={() => deleteSummary(item.id)}
                    className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-300 hover:text-red-400 transition-colors"
                    title="삭제"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              {openId === item.id && (
                <div className="border-t border-gray-100 px-5 py-5 space-y-4">
                  {/* 요약 */}
                  <div className="bg-orange-50 rounded-lg p-4 relative">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-semibold text-orange-700 flex items-center gap-1.5">
                        <Sparkles size={14} />
                        AI 요약
                      </h4>
                      <button
                        onClick={() => handleCopySummary(item.id, item.summaryText)}
                        className="flex items-center gap-1 text-xs text-orange-400 hover:text-orange-700 transition-colors"
                      >
                        {copiedId === item.id ? <><CheckCheck size={12} className="text-green-500" />복사됨</> : <><Copy size={12} />복사</>}
                      </button>
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{item.summaryText}</p>
                  </div>

                  {/* 키워드 */}
                  {item.keywords.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5 mb-2">
                        <Tag size={14} />
                        핵심 키워드
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {item.keywords.map((kw) => (
                          <span key={kw} className="text-xs bg-gray-100 text-gray-700 px-2.5 py-1 rounded-full">
                            #{kw}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 액션 아이템 */}
                  {item.actionItems.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5 mb-2">
                        <ListTodo size={14} />
                        액션 아이템
                      </h4>
                      <ul className="space-y-1.5">
                        {item.actionItems.map((action, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                            <span className="mt-1 w-4 h-4 rounded-full bg-orange-100 text-orange-600 text-xs flex items-center justify-center shrink-0 font-bold">
                              {i + 1}
                            </span>
                            {action}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* 원본 텍스트 */}
                  <details className="text-sm">
                    <summary className="cursor-pointer text-gray-400 hover:text-gray-600 text-xs">
                      원본 내용 보기
                    </summary>
                    <pre className="mt-2 p-3 bg-gray-50 rounded-lg text-xs text-gray-600 whitespace-pre-wrap leading-relaxed">
                      {item.originalText}
                    </pre>
                  </details>
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
