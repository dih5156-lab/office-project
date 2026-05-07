import { create } from 'zustand';
import { User, UserRole } from '../types';
import { api, setToken, clearToken, getToken } from '../lib/api';

interface LoginResponse { token: string; user: User; }
interface ApiUser { id: string; name: string; email: string; department: string; role: UserRole; createdAt: string; }

interface AuthStore {
  users: User[];
  currentUser: User | null;
  isInitialized: boolean;
  initialize: () => Promise<void>;
  login: (email: string, password: string) => Promise<{ success: boolean; message: string }>;
  logout: () => void;
  register: (data: { name: string; email: string; password: string; department: string; role: UserRole }) => Promise<{ success: boolean; message: string }>;
  updateUser: (id: string, data: Partial<Pick<User, 'name' | 'department' | 'role'>>) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  changePassword: (id: string, oldPassword: string, newPassword: string) => Promise<{ success: boolean; message: string }>;
  fetchUsers: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>()((set, get) => ({
  users: [],
  currentUser: null,
  isInitialized: false,

  initialize: async () => {
    if (get().isInitialized) return;
    const token = getToken();
    if (token) {
      try {
        // JWT payload 디코딩 (한글 등 UTF-8 문자 처리)
        const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
          atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
        );
        const payload = JSON.parse(jsonPayload);
        const currentUser: User = {
          id: payload.id,
          name: payload.name,
          email: payload.email,
          passwordHash: '',
          department: payload.department,
          role: payload.role,
          createdAt: '',
        };
        set({ currentUser, isInitialized: true });
        // 관리자면 사용자 목록도 로드
        if (payload.role === 'admin') {
          api.get<ApiUser[]>('/users').then(users => set({ users: users as User[] })).catch(() => {});
        }
        return;
      } catch {
        clearToken();
      }
    }
    set({ isInitialized: true });
  },

  login: async (email, password) => {
    try {
      const res = await api.post<LoginResponse>('/auth/login', { email, password });
      setToken(res.token);
      set({ currentUser: res.user as User });
      return { success: true, message: '로그인 성공' };
    } catch (e) {
      return { success: false, message: (e as Error).message };
    }
  },

  logout: () => {
    clearToken();
    // isInitialized는 true 유지 - "인증 상태를 알고 있음(비로그인)"을 의미
    set({ currentUser: null, users: [], isInitialized: true });
  },

  register: async (data) => {
    try {
      const user = await api.post<ApiUser>('/users', data);
      set(state => ({ users: [...state.users, user as User] }));
      return { success: true, message: '계정이 생성되었습니다.' };
    } catch (e) {
      return { success: false, message: (e as Error).message };
    }
  },

  fetchUsers: async () => {
    try {
      const users = await api.get<ApiUser[]>('/users');
      set({ users: users as User[] });
    } catch { /* 권한 없으면 무시 */ }
  },

  updateUser: async (id, data) => {
    try {
      const updated = await api.put<ApiUser>(`/users/${id}`, data);
      set(state => ({
        users: state.users.map(u => u.id === id ? updated as User : u),
        currentUser: state.currentUser?.id === id ? updated as User : state.currentUser,
      }));
    } catch (e) {
      throw e;
    }
  },

  deleteUser: async (id) => {
    await api.delete(`/users/${id}`);
    set(state => ({ users: state.users.filter(u => u.id !== id) }));
  },

  changePassword: async (id, oldPassword, newPassword) => {
    try {
      await api.put(`/users/${id}/password`, { oldPassword, newPassword });
      return { success: true, message: '비밀번호가 변경되었습니다.' };
    } catch (e) {
      return { success: false, message: (e as Error).message };
    }
  },
}));
