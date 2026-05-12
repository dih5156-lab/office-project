import { create } from 'zustand';
import { UploadedFile, AutoDocResult } from '../types';
import { api, getToken } from '../lib/api';

interface FileStore {
  files: UploadedFile[];
  isUploading: boolean;
  isAutoDoc: boolean;

  fetchFiles: (relatedId: string, relatedType: string) => Promise<UploadedFile[]>;
  uploadFiles: (files: File[], relatedId?: string, relatedType?: string) => Promise<UploadedFile[]>;
  autoDocument: (file: File, category?: string, lang?: string) => Promise<AutoDocResult>;
  deleteFile: (id: string) => Promise<void>;
  getDownloadUrl: (id: string) => string;
  downloadFile: (id: string, filename: string) => Promise<void>;
}

export const useFileStore = create<FileStore>()((set) => ({
  files: [],
  isUploading: false,
  isAutoDoc: false,

  fetchFiles: async (relatedId, relatedType) => {
    const data = await api.get<UploadedFile[]>(
      `/files?relatedId=${encodeURIComponent(relatedId)}&relatedType=${encodeURIComponent(relatedType)}`
    );
    return data;
  },

  uploadFiles: async (files, relatedId, relatedType) => {
    set({ isUploading: true });
    try {
      const formData = new FormData();
      files.forEach((f) => formData.append('files', f));
      if (relatedId)   formData.append('relatedId', relatedId);
      if (relatedType) formData.append('relatedType', relatedType);

      const result = await api.upload<UploadedFile[]>('/files/upload', formData);
      return result;
    } finally {
      set({ isUploading: false });
    }
  },

  autoDocument: async (file, category = '문서', lang = 'ko') => {
    set({ isAutoDoc: true });
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', category);
      formData.append('lang', lang);

      // Vite 프록시 타임아웃 우회 → 백엔드 직접 호출 (CORS 허용됨)
      const token = getToken();
      const res = await fetch('http://localhost:3001/api/ai/auto-document', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `업로드 오류 (${res.status})`);
      return data as AutoDocResult;
    } finally {
      set({ isAutoDoc: false });
    }
  },

  deleteFile: async (id) => {
    await api.delete(`/files/${id}`);
  },

  getDownloadUrl: (id) => `/api/files/${id}/download`,

  /** Authorization 헤더를 포함한 안전한 파일 다운로드 */
  downloadFile: async (id: string, filename: string) => {
    const token = getToken();
    const res = await fetch(`/api/files/${id}/download`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error('다운로드 실패');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
}));

/** 파일 크기를 읽기 쉬운 형태로 변환 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024)          return `${bytes} B`;
  if (bytes < 1024 * 1024)   return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** MIME 타입에 따른 아이콘 색상 */
export function fileColor(mimeType: string, fileName = ''): string {
  if (mimeType.includes('pdf'))  return '#ef4444';
  if (mimeType.includes('word') || mimeType.includes('docx')) return '#2563eb';
  if (mimeType.includes('sheet') || mimeType.includes('excel')) return '#16a34a';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return '#ea580c';
  if (mimeType.includes('hwp') || /\.hwpx?$/i.test(fileName)) return '#1d4ed8';
  if (mimeType.includes('image')) return '#8b5cf6';
  if (mimeType.includes('text')) return '#6b7280';
  return '#374151';
}

/** 파일 확장자 추출 */
export function fileExt(name: string): string {
  return name.split('.').pop()?.toUpperCase() ?? 'FILE';
}
