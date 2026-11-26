'use client';
import { useEffect, useRef, useState, type ReactNode, type FormEvent } from 'react';
import { demoMe, demoLogin, demoLogout, type DemoUser } from '@/lib/demo-auth';

export function DemoAuthBoundary({
  children,
}: {
  children: (scope: string, panel: ReactNode, verify: () => Promise<void>) => ReactNode;
}) {
  const [user, setUser] = useState<DemoUser | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const channel = useRef<BroadcastChannel | null>(null);
  const version = useRef(0);
  const identity = (u: DemoUser | null) => (u ? `${u.accountId}:${u.expiresAt}` : 'guest');
  const invalidate = () => {
    version.current++;
  };
  async function refresh() {
    const revision = ++version.current;
    try {
      const next = await demoMe();
      if (revision !== version.current) return;
      setUser(next);
      setError('');
    } catch {
      if (revision !== version.current) return;
      setUser(null);
      setError('Chưa kiểm tra được phiên demo. Bạn vẫn có thể hỏi thông tin công khai.');
    } finally {
      if (revision === version.current) setReady(true);
    }
  }
  useEffect(() => {
    void Promise.resolve().then(refresh);
    const focus = () => {
      void refresh();
    };
    window.addEventListener('focus', focus);
    const timer = setInterval(focus, 30000);
    if (typeof BroadcastChannel !== 'undefined') {
      channel.current = new BroadcastChannel('hustva-demo-auth');
      channel.current.onmessage = () => {
        setUser(null);
        setReady(false);
        void refresh();
      };
    }
    return () => {
      invalidate();
      clearInterval(timer);
      window.removeEventListener('focus', focus);
      channel.current?.close();
    };
  }, []);
  useEffect(() => {
    if (!user) return;
    const timer = setTimeout(
      () => {
        setUser(null);
        setError('Phiên demo đã hết hạn. Vui lòng đăng nhập lại.');
      },
      Math.max(0, Date.parse(user.expiresAt) - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [user]);
  async function verify() {
    const expected = identity(user);
    const next = await demoMe();
    if (identity(next) !== expected) {
      setUser(next);
      throw new Error('Phiên đăng nhập đã thay đổi. Vui lòng gửi lại câu hỏi.');
    }
  }
  async function change(event?: FormEvent) {
    event?.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    version.current++;
    // Unmount the old conversation before any identity mutation.
    setReady(false);
    try {
      const next = user ? await demoLogout() : await demoLogin(username, password);
      setUser(next);
      setPassword('');
      channel.current?.postMessage({ type: 'session-changed' });
    } catch (e) {
      setUser(null);
      setError(e instanceof Error ? e.message : 'Không thể đăng nhập demo.');
    } finally {
      setPassword('');
      setBusy(false);
      setReady(true);
    }
  }
  const panel = (
    <div className="demo-auth" aria-label="Đăng nhập demo">
      <strong>Tài khoản demo</strong>
      {user ? (
        <div className="demo-auth-row">
          <span>{user.displayName}</span>
          <button disabled={busy} onClick={() => void change()}>
            Đăng xuất
          </button>
        </div>
      ) : (
        <form onSubmit={change} className="demo-auth-row">
          <label>
            Tên đăng nhập
            <input
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              maxLength={100}
              required
              disabled={busy}
            />
          </label>
          <label>
            Mật khẩu demo
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              maxLength={256}
              required
              disabled={busy}
            />
          </label>
          <button disabled={busy || !username.trim() || !password}>Đăng nhập</button>
        </form>
      )}
      <small>Tài khoản do nhóm cấp để xem điểm của bạn. Không dùng mật khẩu Microsoft/HUST.</small>
      {error && <p role="status">{error}</p>}
    </div>
  );
  if (!ready)
    return (
      <div className="demo-auth" role="status">
        Đang kiểm tra phiên demo…
      </div>
    );
  return children(identity(user), panel, verify);
}
