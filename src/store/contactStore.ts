import { create } from 'zustand';
import { api } from '../lib/api';

export interface Contact {
  id: string;
  name: string;
  company: string;
  department: string;
  position: string;
  email: string;
  phone: string;
  type: 'internal' | 'external';
  memo: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type ContactForm = Omit<Contact, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>;

interface ContactState {
  contacts: Contact[];
  loading: boolean;
  fetchContacts: () => Promise<void>;
  addContact: (form: ContactForm) => Promise<void>;
  updateContact: (id: string, form: Partial<ContactForm>) => Promise<void>;
  deleteContact: (id: string) => Promise<void>;
}

export const useContactStore = create<ContactState>((set, get) => ({
  contacts: [],
  loading: false,

  fetchContacts: async () => {
    set({ loading: true });
    try {
      const data = await api.get<Contact[]>('/contacts');
      set({ contacts: data });
    } finally {
      set({ loading: false });
    }
  },

  addContact: async (form) => {
    const data = await api.post<Contact>('/contacts', form);
    set((s) => ({ contacts: [...s.contacts, data] }));
  },

  updateContact: async (id, form) => {
    await api.put(`/contacts/${id}`, form);
    set((s) => ({
      contacts: s.contacts.map((c) => (c.id === id ? { ...c, ...form } : c)),
    }));
  },

  deleteContact: async (id) => {
    await api.delete(`/contacts/${id}`);
    set((s) => ({ contacts: s.contacts.filter((c) => c.id !== id) }));
  },
}));
