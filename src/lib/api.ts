const BASE = '/api';

export function getToken(): string | null {
  return localStorage.getItem('office_token');
}
export function setToken(token: string) {
  localStorage.setItem('office_token', token);
}
export function clearToken() {
  localStorage.removeItem('office_token');
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    clearToken();
    window.location.href = '/login';
    throw new Error('인증이 만료되었습니다. 다시 로그인하세요.');
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `API 오류 (${res.status})`);
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
};
