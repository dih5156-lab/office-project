import { create } from 'zustand';
import { Document, DocumentCategory } from '../types';
import { api } from '../lib/api';

interface DocumentStore {
  documents: Document[];
  isLoaded: boolean;
  fetchDocuments: () => Promise<void>;
  addDocument: (data: Omit<Document, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateDocument: (id: string, data: Partial<Omit<Document, 'id' | 'createdAt'>>) => Promise<void>;
  deleteDocument: (id: string) => Promise<void>;
  searchDocuments: (query: string) => Document[];
  getByCategory: (category: DocumentCategory) => Document[];
}

export const useDocumentStore = create<DocumentStore>()((set, get) => ({
  documents: [],
  isLoaded: false,

  fetchDocuments: async () => {
    if (get().isLoaded) return;
    try {
      const data = await api.get<Document[]>('/documents');
      set({ documents: data, isLoaded: true });
    } catch { set({ isLoaded: true }); }
  },

  addDocument: async (data) => {
    const doc = await api.post<Document>('/documents', data);
    set(state => ({ documents: [doc, ...state.documents] }));
  },

  updateDocument: async (id, data) => {
    const updated = await api.put<Document>(`/documents/${id}`, data);
    set(state => ({ documents: state.documents.map(d => d.id === id ? updated : d) }));
  },

  deleteDocument: async (id) => {
    await api.delete(`/documents/${id}`);
    set(state => ({ documents: state.documents.filter(d => d.id !== id) }));
  },

  searchDocuments: (query) => {
    const q = query.toLowerCase();
    return get().documents.filter(d =>
      d.title.toLowerCase().includes(q) ||
      d.content.toLowerCase().includes(q) ||
      d.tags.some(t => t.toLowerCase().includes(q))
    );
  },

  getByCategory: (category) => {
    return get().documents.filter(d => d.category === category);
  },
}));
