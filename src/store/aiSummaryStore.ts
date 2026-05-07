import { create } from 'zustand';
import { AISummaryItem, SummaryType } from '../types';
import { api } from '../lib/api';

function extractKeywords(text: string): string[] {
  const stopWords = new Set(['이', '가', '을', '를', '은', '는', '에', '에서', '로', '으로', '와', '과', '의', '도', '만', '에게', '한', '하다', '있다', '없다', '되다', '하는', '있는']);
  const words = text.split(/[\s,.!?;:()\[\]{}'"]+/).filter(w => w.length > 1);
  const freq: Record<string, number> = {};
  words.forEach(w => { if (!stopWords.has(w)) freq[w] = (freq[w] || 0) + 1; });
  return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([word]) => word);
}

function extractActionItems(text: string): string[] {
  const patterns = [
    /([가-힣\w\s]+)(?:을|를)\s*(?:완료|진행|검토|보고|준비|작성|확인|처리)\s*(?:해야|해주세요|바랍니다|예정|계획)/g,
    /(?:다음|이번)\s*(?:주|달|회의)\s*까지\s*([가-힣\w\s]+)/g,
  ];
  const items: string[] = [];
  patterns.forEach(p => {
    for (const m of text.matchAll(p)) {
      if (m[0] && items.length < 5) items.push(m[0].trim());
    }
  });
  if (items.length === 0 && text.length > 50) items.push('내용을 검토하고 필요한 후속 조치를 취하세요.');
  return items;
}

interface AISummaryStore {
  summaries: AISummaryItem[];
  isLoaded: boolean;
  isProcessing: boolean;
  fetchSummaries: () => Promise<void>;
  processSummary: (title: string, text: string, type: SummaryType) => Promise<AISummaryItem>;
  deleteSummary: (id: string) => Promise<void>;
}

export const useAISummaryStore = create<AISummaryStore>()((set, get) => ({
  summaries: [],
  isLoaded: false,
  isProcessing: false,

  fetchSummaries: async () => {
    if (get().isLoaded) return;
    try {
      const data = await api.get<AISummaryItem[]>('/ai-summaries');
      set({ summaries: data, isLoaded: true });
    } catch { set({ isLoaded: true }); }
  },

  processSummary: async (title, text, type) => {
    set({ isProcessing: true });
    let summaryText = '';
    const keywords = extractKeywords(text);
    const actionItems = extractActionItems(text);

    try {
      const res = await fetch('/api/ai/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, text, type }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.guide || err.error || 'AI 서버 오류');
      }
      const data = await res.json();
      summaryText = data.summary || '';
    } catch (e) {
      summaryText = `⚠️ AI 요약 불가: ${(e as Error).message}`;
    }

    // DB에 저장
    const newItem = await api.post<AISummaryItem>('/ai-summaries', {
      title, originalText: text, summaryText, keywords, actionItems, type,
    }).catch(() => ({
      id: `local_${Date.now()}`,
      title, originalText: text, summaryText, keywords, actionItems, type,
      createdAt: new Date().toISOString(),
    } as AISummaryItem));

    set(state => ({ summaries: [newItem, ...state.summaries], isProcessing: false }));
    return newItem;
  },

  deleteSummary: async (id) => {
    if (!id.startsWith('local_')) await api.delete(`/ai-summaries/${id}`);
    set(state => ({ summaries: state.summaries.filter(s => s.id !== id) }));
  },
}));
