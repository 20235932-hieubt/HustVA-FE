'use client';

import { useRef, useState, type FormEvent } from 'react';

interface Tool {
  id: string;
  description: string;
  source: string;
  configured: boolean;
  warnings: string[];
  inputSchema: Record<string, unknown>;
  settings: { enabled: boolean; timeoutMs: number; retries: number };
  metrics: { calls: number; active: number; durationMs: number; statuses: Record<string, number> };
}
const api = (process.env.NEXT_PUBLIC_API_URL?.trim() || '/api/v1').replace(/\/$/, '');

export default function ToolsPage() {
  const [credential, setCredential] = useState('');
  const [token, setToken] = useState('');
  const [tools, setTools] = useState<Tool[]>([]);
  const [selected, setSelected] = useState('');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [argumentsText, setArgumentsText] = useState('{}');
  const [result, setResult] = useState<unknown>();
  const controller = useRef<AbortController | null>(null);
  const session = useRef(0);
  const tool = tools.find((entry) => entry.id === selected);

  async function request(
    path: string,
    auth: string,
    signal: AbortSignal,
    method = 'GET',
    body?: unknown,
  ) {
    const response = await fetch(`${api}/tools${path}`, {
      method,
      signal,
      cache: 'no-store',
      credentials: 'omit',
      headers: { Authorization: `Bearer ${auth}`, 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const data = await response.json();
    if (!response.ok && !('tool' in data && 'status' in data))
      throw new Error(
        response.status === 401
          ? 'Token quản trị không hợp lệ.'
          : response.status === 503
            ? 'Chưa cấu hình TOOL_MANAGEMENT_TOKEN trên backend (tối thiểu 32 ký tự).'
            : `Yêu cầu thất bại (${response.status}).`,
      );
    return data;
  }

  async function action(work: (signal: AbortSignal, isCurrent: () => boolean) => Promise<void>) {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    const revision = session.current;
    const isCurrent = () => revision === session.current && !current.signal.aborted;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await work(AbortSignal.any([current.signal, AbortSignal.timeout(125000)]), isCurrent);
    } catch (failure) {
      if (isCurrent())
        setError(
          failure instanceof Error && failure.name !== 'TypeError'
            ? failure.message
            : 'Không kết nối được backend. Kiểm tra API URL và CORS.',
        );
    } finally {
      if (isCurrent()) setBusy(false);
    }
  }

  function logout() {
    session.current++;
    controller.current?.abort();
    setBusy(false);
    setToken('');
    setCredential('');
    setTools([]);
    setSelected('');
    setResult(undefined);
    setArgumentsText('{}');
    setNotice('');
    setError('');
  }

  async function login(event: FormEvent) {
    event.preventDefault();
    await action(async (signal, isCurrent) => {
      const data = await request('', credential, signal);
      if (!isCurrent()) return;
      setTools(data.tools);
      setToken(credential);
      setCredential('');
      setSelected(data.tools[0]?.id ?? '');
    });
  }

  async function refresh() {
    await action(async (signal, isCurrent) => {
      const data = await request('', token, signal);
      if (isCurrent()) {
        setTools(data.tools);
        setNotice('Đã cập nhật danh sách.');
      }
    });
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!tool) return;
    const form = new FormData(event.currentTarget);
    const settings = {
      enabled: form.has('enabled'),
      timeoutMs: Number(form.get('timeoutMs')),
      retries: Number(form.get('retries')),
    };
    await action(async (signal, isCurrent) => {
      await request(`/${tool.id}`, token, signal, 'PATCH', settings);
      const data = await request('', token, signal);
      if (isCurrent()) {
        setTools(data.tools);
        setNotice('Đã lưu cấu hình trên backend.');
      }
    });
  }

  async function execute() {
    if (!tool) return;
    let args: unknown;
    try {
      args = JSON.parse(argumentsText);
    } catch {
      setError('Tham số phải là JSON hợp lệ.');
      return;
    }
    if (!args || typeof args !== 'object' || Array.isArray(args)) {
      setError('Tham số phải là một JSON object.');
      return;
    }
    setResult(undefined);
    await action(async (signal, isCurrent) => {
      const data = await request(`/${tool.id}/execute`, token, signal, 'POST', { arguments: args });
      if (isCurrent()) {
        setResult(data);
        setArgumentsText('{}');
      }
      const list = await request('', token, signal);
      if (isCurrent()) setTools(list.tools);
    });
  }

  return (
    <main className="mx-auto min-h-screen max-w-7xl bg-slate-50 p-5 text-slate-900 md:p-10">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-2 text-sm font-bold tracking-widest text-red-800">HUSTVA / QUẢN TRỊ</p>
          <h1 className="text-3xl font-bold">Tool management</h1>
          <p className="mt-2 text-sm text-slate-600">
            Giai đoạn 1: quản lý 5 công cụ dữ liệu dùng chung từ HUST Partner.
          </p>
        </div>
        {token && (
          <button className="rounded-lg border bg-white px-4 py-2" onClick={logout}>
            Đăng xuất & xóa kết quả
          </button>
        )}
      </header>
      {!token && (
        <form onSubmit={login} className="max-w-lg space-y-4 rounded-xl border bg-white p-6">
          <h2 className="text-xl font-bold">Kết nối quản trị</h2>
          <label className="block text-sm">
            Token quản trị
            <input
              autoComplete="off"
              type="password"
              required
              minLength={32}
              value={credential}
              onChange={(event) => setCredential(event.target.value)}
              className="mt-2 w-full rounded-lg border p-3"
            />
          </label>
          <p className="text-sm text-slate-600">
            Token chỉ giữ trong bộ nhớ trang. Tải lại trang cần đăng nhập lại.
          </p>
          <button
            disabled={busy}
            className="rounded-lg bg-red-800 px-5 py-3 text-white disabled:opacity-50"
          >
            {busy ? 'Đang kết nối…' : 'Kết nối'}
          </button>
        </form>
      )}
      <div aria-live="polite" className="my-4">
        {error && (
          <p role="alert" className="rounded-lg bg-red-100 p-3 text-red-900">
            {error}
          </p>
        )}
        {notice && <p className="rounded-lg bg-emerald-100 p-3 text-emerald-900">{notice}</p>}
        {busy && <p className="mt-2 text-sm text-slate-600">Đang xử lý…</p>}
      </div>
      {token && (
        <>
          <section aria-label="Tổng quan" className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              ['Công cụ', tools.length],
              ['Đang bật', tools.filter((entry) => entry.settings.enabled).length],
              ['Đã kết nối API', tools.filter((entry) => entry.configured).length],
              [
                'Lượt gọi trong tiến trình',
                tools.reduce((sum, entry) => sum + entry.metrics.calls, 0),
              ],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border bg-white p-4">
                <p className="text-sm text-slate-600">{label}</p>
                <p className="mt-2 text-2xl font-bold">{value}</p>
              </div>
            ))}
          </section>
          <div className="mb-5 flex flex-wrap gap-3">
            <button
              disabled={busy}
              onClick={refresh}
              className="rounded-lg border bg-white px-4 py-2 disabled:opacity-50"
            >
              Làm mới
            </button>
          </div>
          <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
            <aside className="rounded-xl border bg-white p-4">
              <label className="text-sm font-bold">
                Tìm công cụ
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="my-3 w-full rounded-lg border p-2"
                  placeholder="Tên hoặc mô tả"
                />
              </label>
              <nav
                aria-label="Danh sách công cụ"
                className="max-h-[720px] space-y-1 overflow-y-auto"
              >
                {tools
                  .filter((entry) =>
                    `${entry.id} ${entry.description}`
                      .toLocaleLowerCase('vi')
                      .includes(query.toLocaleLowerCase('vi')),
                  )
                  .map((entry) => (
                    <button
                      key={entry.id}
                      disabled={busy}
                      aria-current={entry.id === selected ? 'true' : undefined}
                      onClick={() => {
                        setSelected(entry.id);
                        setArgumentsText('{}');
                        setResult(undefined);
                        setError('');
                        setNotice('');
                      }}
                      className={`w-full rounded-lg p-3 text-left disabled:opacity-50 ${entry.id === selected ? 'bg-red-50 ring-1 ring-red-800' : 'hover:bg-slate-50'}`}
                    >
                      <span className="block break-all text-sm font-bold">{entry.id}</span>
                      <span className="mt-1 block text-xs text-slate-600">
                        {entry.source} · {entry.settings.enabled ? 'Bật' : 'Tắt'} · Dùng chung
                      </span>
                    </button>
                  ))}
              </nav>
            </aside>
            {tool && (
              <section className="min-w-0 space-y-5 rounded-xl border bg-white p-5 md:p-7">
                <div>
                  <h2 className="break-all text-xl font-bold">{tool.id}</h2>
                  <p className="mt-2 text-slate-600">{tool.description}</p>
                  <p
                    className={`mt-3 text-sm ${tool.configured ? 'text-emerald-800' : 'text-red-800'}`}
                  >
                    {tool.configured
                      ? 'Đã cấu hình kết nối upstream'
                      : 'Chưa cấu hình kết nối upstream trên backend'}
                  </p>
                </div>
                {tool.warnings.length > 0 && (
                  <ul className="list-disc space-y-2 rounded-lg bg-amber-50 py-4 pr-4 pl-8 text-sm text-amber-900">
                    {tool.warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                )}
                <form
                  key={`${tool.id}-${JSON.stringify(tool.settings)}`}
                  onSubmit={save}
                  className="space-y-4 border-y py-5"
                >
                  <label className="flex items-center gap-3">
                    <input
                      name="enabled"
                      type="checkbox"
                      defaultChecked={tool.settings.enabled}
                      disabled={busy}
                    />
                    Cho phép gọi công cụ
                  </label>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="text-sm">
                      Timeout toàn lượt gọi (ms)
                      <input
                        name="timeoutMs"
                        type="number"
                        min={1000}
                        max={120000}
                        required
                        defaultValue={tool.settings.timeoutMs}
                        disabled={busy}
                        className="mt-2 w-full rounded-lg border p-2"
                      />
                    </label>
                    <label className="text-sm">
                      Số lần thử lại
                      <input
                        name="retries"
                        type="number"
                        min={0}
                        max={2}
                        required
                        defaultValue={tool.settings.retries}
                        disabled={busy}
                        className="mt-2 w-full rounded-lg border p-2"
                      />
                    </label>
                  </div>
                  <button
                    disabled={busy}
                    className="rounded-lg bg-red-800 px-4 py-2 text-white disabled:opacity-50"
                  >
                    Lưu cấu hình
                  </button>
                </form>
                <div className="text-sm text-slate-600">
                  Lượt gọi: {tool.metrics.calls} · Đang chạy: {tool.metrics.active} · Tổng thời
                  gian: {tool.metrics.durationMs} ms
                  <pre className="mt-2 overflow-x-auto">
                    {JSON.stringify(tool.metrics.statuses, null, 2)}
                  </pre>
                </div>
                <details>
                  <summary className="cursor-pointer font-bold">Schema tham số JSON</summary>
                  <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-100">
                    {JSON.stringify(tool.inputSchema, null, 2)}
                  </pre>
                </details>
                <div className="space-y-3 border-t pt-5">
                  <h3 className="font-bold">Gọi thử công cụ</h3>
                  <p className="text-sm text-slate-600">
                    Kết quả chỉ hiển thị trong phiên trang này. Các công cụ hiện tại không yêu cầu
                    MSSV.
                  </p>
                  <label className="block text-sm">
                    Tham số JSON
                    <textarea
                      value={argumentsText}
                      onChange={(event) => setArgumentsText(event.target.value)}
                      disabled={busy}
                      rows={5}
                      spellCheck={false}
                      className="mt-2 w-full rounded-lg border p-3 font-mono"
                    />
                  </label>
                  <button
                    disabled={busy || !tool.settings.enabled || !tool.configured}
                    onClick={execute}
                    className="rounded-lg border border-red-800 px-4 py-2 text-red-800 disabled:opacity-50"
                  >
                    Gọi tool
                  </button>
                  {result !== undefined && (
                    <div>
                      <button
                        className="mb-2 text-sm underline"
                        onClick={() => setResult(undefined)}
                      >
                        Xóa kết quả
                      </button>
                      <pre className="max-h-[500px] overflow-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-100">
                        {JSON.stringify(result, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>
        </>
      )}
    </main>
  );
}
