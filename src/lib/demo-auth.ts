export interface DemoUser {
  accountId: string;
  studentId: string;
  displayName: string;
  expiresAt: string;
  mode: 'demo';
}
const base = (process.env.NEXT_PUBLIC_API_URL?.trim() || '/api/v1').replace(/\/$/, '');
async function request(path: string, body?: unknown): Promise<DemoUser | null> {
  const response = await fetch(`${base}/auth/demo/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    credentials: 'include',
    cache: 'no-store',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  if (path === 'me' && response.status === 401) return null;
  if (response.status === 204) return null;
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || 'Không thể đăng nhập demo.');
  return data as DemoUser;
}
export const demoMe = () => request('me');
export const demoLogin = (username: string, password: string) =>
  request('login', { username, password });
export const demoLogout = () => request('logout', {});
