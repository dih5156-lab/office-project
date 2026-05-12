import { create } from 'zustand';
import { api } from '../lib/api';

export type TodoPriority = 'high' | 'medium' | 'low';

export interface Todo {
  id: string;
  userId: string;
  title: string;
  completed: boolean;
  priority: TodoPriority;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
}

interface TodoState {
  todos: Todo[];
  loading: boolean;
  fetchTodos: () => Promise<void>;
  addTodo: (title: string, priority?: TodoPriority, dueDate?: string | null) => Promise<void>;
  toggleTodo: (id: string) => Promise<void>;
  deleteTodo: (id: string) => Promise<void>;
  updateTodo: (id: string, patch: Partial<Pick<Todo, 'title' | 'priority' | 'dueDate'>>) => Promise<void>;
}

export const useTodoStore = create<TodoState>((set, get) => ({
  todos: [],
  loading: false,

  fetchTodos: async () => {
    set({ loading: true });
    try {
      const data = await api.get<Todo[]>('/todos');
      set({ todos: data });
    } catch {
      // 조용히 실패
    } finally {
      set({ loading: false });
    }
  },

  addTodo: async (title, priority = 'medium', dueDate = null) => {
    const data = await api.post<Todo>('/todos', { title, priority, dueDate });
    set((s) => ({ todos: [data, ...s.todos] }));
  },

  toggleTodo: async (id) => {
    const todo = get().todos.find((t) => t.id === id);
    if (!todo) return;
    const completed = !todo.completed;
    set((s) => ({
      todos: s.todos.map((t) => (t.id === id ? { ...t, completed } : t)),
    }));
    await api.put(`/todos/${id}`, { completed });
  },

  deleteTodo: async (id) => {
    set((s) => ({ todos: s.todos.filter((t) => t.id !== id) }));
    await api.delete(`/todos/${id}`);
  },

  updateTodo: async (id, patch) => {
    set((s) => ({
      todos: s.todos.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    }));
    await api.put(`/todos/${id}`, patch);
  },
}));
