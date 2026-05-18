const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '');

export type ApiUser = {
  id: number;
  username: string;
  email: string;
  role: 'system_admin' | 'admin' | 'viewer';
  status: string;
  avatar_url?: string | null;
};

export type DashboardRecord = {
  id: number;
  name: string;
  category: string;
  icon: string;
  dataset_id?: number | null;
  dataset?: string;
  status: 'published' | 'draft' | 'offline';
  owner?: string;
  updated_at?: string;
  file_url?: string | null;
  iframe_url?: string | null;
};

export const assetUrl = (url?: string | null) => {
  if (!url) return null;
  return url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
};

export const getToken = () => localStorage.getItem('token');

export const clearSession = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('auth');
  window.dispatchEvent(new Event('astrocore:unauthorized'));
};

async function parseResponse(res: Response) {
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    if (res.status === 401) clearSession();
    throw new Error(data?.detail || data?.error || '请求失败');
  }
  return data;
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  return parseResponse(res);
}

export const api = {
  baseUrl: API_BASE_URL,
  login: (username: string, password: string) =>
    apiRequest<{ access_token: string; expires_in: number; user: ApiUser }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  me: () => apiRequest<ApiUser>('/api/auth/me'),
  systemSettings: () => apiRequest<any>('/api/system-settings'),
  updateSystemSettings: (payload: any) =>
    apiRequest<any>('/api/system-settings', { method: 'PUT', body: JSON.stringify(payload) }),
  uploadLogo: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return apiRequest<any>('/api/system-settings/logo', { method: 'POST', body: form });
  },
  deleteLogo: () => apiRequest<any>('/api/system-settings/logo', { method: 'DELETE' }),
  dashboards: (keyword = '') =>
    apiRequest<DashboardRecord[]>(`/api/dashboards${keyword ? `?keyword=${encodeURIComponent(keyword)}` : ''}`),
  createDashboard: (payload: any) =>
    apiRequest<DashboardRecord>('/api/dashboards', { method: 'POST', body: JSON.stringify(payload) }),
  updateDashboard: (id: number, payload: any) =>
    apiRequest<DashboardRecord>(`/api/dashboards/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteDashboard: (id: number) => apiRequest(`/api/dashboards/${id}`, { method: 'DELETE' }),
  uploadDashboardFile: (id: number, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return apiRequest<DashboardRecord>(`/api/dashboards/${id}/file`, { method: 'POST', body: form });
  },
  dashboardView: (id: number) => apiRequest<DashboardRecord>(`/api/dashboards/${id}/view`),
  searchDashboards: (keyword: string) =>
    apiRequest<DashboardRecord[]>(`/api/search/dashboards?keyword=${encodeURIComponent(keyword)}`),
  datasets: (keyword = '') =>
    apiRequest<any[]>(`/api/datasets${keyword ? `?keyword=${encodeURIComponent(keyword)}` : ''}`),
  createDataset: (payload: any) =>
    apiRequest<any>('/api/datasets', { method: 'POST', body: JSON.stringify(payload) }),
  updateDataset: (id: number, payload: any) =>
    apiRequest<any>(`/api/datasets/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteDataset: (id: number) => apiRequest(`/api/datasets/${id}`, { method: 'DELETE' }),
  previewDataset: (id: number) => apiRequest<any>(`/api/datasets/${id}/preview`, { method: 'POST' }),
  datasources: () => apiRequest<any[]>('/api/datasources'),
  createDatasource: (payload: any) =>
    apiRequest<any>('/api/datasources', { method: 'POST', body: JSON.stringify(payload) }),
  updateDatasource: (id: number, payload: any) =>
    apiRequest<any>(`/api/datasources/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteDatasource: (id: number) => apiRequest(`/api/datasources/${id}`, { method: 'DELETE' }),
  testDatasource: (id: number) => apiRequest<any>(`/api/datasources/${id}/test`, { method: 'POST' }),
  users: () => apiRequest<ApiUser[]>('/api/users'),
  createUser: (payload: any) => apiRequest<ApiUser>('/api/users', { method: 'POST', body: JSON.stringify(payload) }),
  updateUser: (id: number, payload: any) =>
    apiRequest<ApiUser>(`/api/users/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteUser: (id: number) => apiRequest(`/api/users/${id}`, { method: 'DELETE' }),
  bulkDeleteUsers: (ids: number[]) =>
    apiRequest('/api/users/bulk-delete', { method: 'POST', body: JSON.stringify(ids) }),
  updatePassword: (id: number, old_password: string, new_password: string) =>
    apiRequest(`/api/users/${id}/password`, {
      method: 'PUT',
      body: JSON.stringify({ old_password, new_password }),
    }),
  uploadAvatar: (id: number, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return apiRequest<ApiUser>(`/api/users/${id}/avatar`, { method: 'POST', body: form });
  },
};
