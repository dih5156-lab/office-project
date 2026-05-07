import { useState, useEffect } from 'react';
import { useAISummaryStore } from '../store/aiSummaryStore';
import { BrainCircuit, Loader2, Trash2, ChevronDown, ChevronUp, Sparkles, Tag, ListTodo, CheckCircle2, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import clsx from 'clsx';
import { SummaryType } from '../types';

const typeOptions: SummaryType[] = ['회의록', '보고서', '이메일', '문서', '기타'];

const typeColors: Record<SummaryType, string> = {
  회의록: 'bg-blue-100 text-blue-700',
  보고서: 'bg-green-100 text-green-700',
  이메일: 'bg-purple-100 text-purple-700',
  문서: 'bg-orange-100 text-orange-700',
  기타: 'bg-gray-100 text-gray-700',
};

export default function AISummaryPage() {
  const { summaries, isProcessing, processSummary, deleteSummary, fetchSummaries } = useAISummaryStore();
  const [title, setTitle] = useState('');

  useEffect(() => { fetchSummaries(); }, []);
  const [text, setText] = useState('');
  const [type, setType] = useState<SummaryType>('회의록');
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [ollamaStatus, setOllamaStatus] = useState<{ available: boolean; models: string[] } | null>(null);

  useEffect(() => {
    fetch('/api/ai/status')
      .then((r) => r.json())
      .then(setOllamaStatus)
      .catch(() => setOllamaStatus({ available: false, models: [] }));
  }, []);

  async function handleSubmit() {
    if (!title.trim() || !text.trim()) {
      setError('제목과 내용을 모두 입력하세요.');
      return;
    }
    setError('');
    const result = await processSummary(title, text, type);
    setOpenId(result.id);
    setTitle('');
    setText('');
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <BrainCircuit size={22} className="text-orange-500" />
        <h2 className="text-lg font-semibold text-gray-800">AI 내용 요약</h2>
      </div>

      {/* Ollama 상태 배너 */}
      {ollamaStatus && (
        ollamaStatus.available ? (
          <div className="flex items-center gap-2 px-4 py-2.5 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
            <CheckCircle2 size={15} />
            <span>Ollama 연결됨 — 사용 가능한 모델: {ollamaStatus.models.join(', ') || '없음'}</span>
          </div>
        ) : (
          <div className="px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700 space-y-1">
            <div className="flex items-center gap-2 font-medium">
              <AlertCircle size={15} />
              Ollama 미연결 — AI 요약을 사용하려면 아래 단계를 따르세요
            </div>
            <ol className="pl-5 space-y-0.5 text-xs text-amber-600 list-decimal">
              <li><a href="https://ollama.com" target="_blank" rel="noreferrer" className="underline">ollama.com</a>에서 Ollama 설치</li>
              <li>터미널: <code className="bg-amber-100 px-1 rounded">ollama pull qwen2.5:7b</code> (약 4.7GB, 최초 1회)</li>
              <li>터미널: <code className="bg-amber-100 px-1 rounded">ollama server</code> 실행</li>
            </ol>
            <p className="text-xs text-amber-500 mt-1">연결 전까지는 로컬 키워드 추출 방식으로 대체됩니다.</p>
          </div>
        )
      )}

      {/* 입력 영역 */}
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
            <>
              <Loader2 size={16} className="animate-spin" />
              AI 분석 중...
            </>
          ) : (
            <>
              <Sparkles size={16} />
              AI 요약 시작
            </>
          )}
        </button>
      </div>

      {/* 요약 결과 목록 */}
      {summaries.length === 0 ? (
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
                <button
                  onClick={() => deleteSummary(item.id)}
                  className="ml-3 p-1.5 hover:bg-gray-100 rounded-lg text-gray-300 hover:text-red-400"
                >
                  <Trash2 size={15} />
                </button>
              </div>

              {openId === item.id && (
                <div className="border-t border-gray-100 px-5 py-5 space-y-4">
                  {/* 요약 */}
                  <div className="bg-orange-50 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-orange-700 flex items-center gap-1.5 mb-2">
                      <Sparkles size={14} />
                      AI 요약
                    </h4>
                    <p className="text-sm text-gray-700 leading-relaxed">{item.summaryText}</p>
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
      )}
    </div>
  );
}
