'use client';

import { DemoAuthBoundary } from './demo-auth';
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import {
  ChatApiError,
  createConversation,
  loadHistory,
  sendMessage,
  type ChatRecord,
  type Conversation,
} from '@/lib/chat-api';
import { readConversations, saveConversation, type SavedConversation } from '@/lib/chat-sessions';

function BotIcon() {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <path d="M14 24V13m36 11V13" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <circle cx="14" cy="9" r="4" fill="currentColor" />
      <circle cx="50" cy="9" r="4" fill="currentColor" />
      <path
        d="M53 34c0-12-9-21-21-21S11 22 11 34c0 9 6 16 15 19l-2 7 13-7c9-2 16-9 16-19Z"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <path
        d="M16 31c-7-3-9 1-9 6s3 8 9 6m32-12c7-3 9 1 9 6s-3 8-9 6"
        stroke="currentColor"
        strokeWidth="3"
      />
      <circle cx="24" cy="33" r="2.5" fill="currentColor" />
      <circle cx="32" cy="33" r="2.5" fill="currentColor" />
      <circle cx="40" cy="33" r="2.5" fill="currentColor" />
      <path d="M26 43c3 3 9 3 12 0" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
function Icon({ name }: { name: 'history' | 'expand' | 'close' | 'attach' | 'send' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {name === 'history' && (
        <>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 7v5l3 2" />
        </>
      )}
      {name === 'expand' && (
        <>
          <path d="M14 4h6v6m0-6-9 9" />
          <path d="M10 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-4" />
        </>
      )}
      {name === 'close' && <path d="m6 6 12 12M6 18 18 6" />}
      {name === 'attach' && (
        <path d="m20 11-8 8a5 5 0 0 1-7-7l9-9a3.5 3.5 0 0 1 5 5l-9 9a2 2 0 0 1-3-3l8-8" />
      )}
      {name === 'send' && (
        <path d="m4 3 17 9-17 9 3-8 9-1-9-1Z" fill="currentColor" strokeWidth="1" />
      )}
    </svg>
  );
}
const storageKey = 'hust-assistant-session';
function isExpired(value: Conversation) {
  return Date.parse(value.expiresAt) <= Date.now();
}
function readSession(): Conversation | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(storageKey) ?? 'null');
    if (value?.conversationId && value?.token && Date.parse(value.expiresAt) > Date.now())
      return value;
  } catch {
    /* Storage may be unavailable. */
  }
  return null;
}
function safeUrl(value: string) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}
interface ChatWidgetProps {
  embedded?: boolean;
  parentOrigin?: string;
  initiallyOpen?: boolean;
  fullScreen?: boolean;
}
export function ChatWidget(props: ChatWidgetProps) {
  if (props.embedded) return <ChatSurface {...props} />;
  return (
    <DemoAuthBoundary>
      {(scope, panel, verify) => (
        <ChatSurface key={scope} {...props} authPanel={panel} verifyAuth={verify} />
      )}
    </DemoAuthBoundary>
  );
}
function ChatSurface({
  embedded = false,
  parentOrigin,
  initiallyOpen = true,
  fullScreen = false,
  authPanel,
  verifyAuth,
}: ChatWidgetProps & { authPanel?: ReactNode; verifyAuth?: () => Promise<void> }) {
  const [open, setOpen] = useState(initiallyOpen);
  const expanded = fullScreen;
  const [historyOpen, setHistoryOpen] = useState(fullScreen);
  const [conversations, setConversations] = useState<SavedConversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [records, setRecords] = useState<ChatRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [hasOlder, setHasOlder] = useState(false);
  const session = useRef<Conversation | null>(null);
  const locked = useRef(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const firstFocus = useRef(true);
  const conversationIndex = useRef<SavedConversation[]>([]);
  useEffect(() => {
    if (!fullScreen) return;
    let cancelled = false;
    async function restore() {
      await Promise.resolve();
      if (cancelled) return;
      conversationIndex.current = readConversations();
      setConversations(conversationIndex.current);
      const current = readSession();
      if (!current) return;
      session.current = current;
      setActiveId(current.conversationId);
      locked.current = true;
      setBusy(true);
      try {
        const { messages } = await loadHistory(current, 0, {
          credentials: embedded ? 'omit' : 'include',
        });
        if (!cancelled) {
          setRecords([...messages].reverse());
          setHasOlder(messages.length === 50);
        }
      } catch (error) {
        if (!cancelled)
          setNotice(error instanceof Error ? error.message : 'Không thể tải lịch sử.');
      } finally {
        if (!cancelled) {
          locked.current = false;
          setBusy(false);
        }
      }
    }
    void restore();
    return () => {
      cancelled = true;
    };
  }, [fullScreen]);
  function openFullScreen() {
    // The same-origin new tab receives a copy of this tab's sessionStorage.
    // Detach its opener immediately; session tokens never enter the URL.
    const next = window.open(new URL('/chat', window.location.origin).href, '_blank');
    if (next) next.opener = null;
    else
      setNotice('Trình duyệt đã chặn tab mới. Vui lòng cho phép cửa sổ bật lên để mở trang chat.');
  }
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [records, busy]);
  useEffect(() => {
    if (firstFocus.current) {
      firstFocus.current = false;
      if (embedded) return;
    }
    if (open) input.current?.focus();
    else launcher.current?.focus();
  }, [open, embedded]);
  useEffect(() => {
    if (!embedded || !parentOrigin || window.parent === window) return;
    function notifyParent() {
      window.parent.postMessage({ type: 'hust:state', open, expanded, historyOpen }, parentOrigin!);
    }
    function receive(event: MessageEvent) {
      if (event.source !== window.parent || event.origin !== parentOrigin) return;
      if (event.data?.type === 'hust:request-state') notifyParent();
    }
    window.addEventListener('message', receive);
    notifyParent();
    return () => window.removeEventListener('message', receive);
  }, [embedded, parentOrigin, open, expanded, historyOpen]);
  function remember(current: Conversation, title: string, count: number) {
    conversationIndex.current = saveConversation(current, title, count, conversationIndex.current);
    setConversations(conversationIndex.current);
  }
  function restoreIndex() {
    if (!conversationIndex.current.length) conversationIndex.current = readConversations();
    setConversations(conversationIndex.current);
  }
  function toggleHistory() {
    setHistoryOpen(!historyOpen);
    if (!historyOpen) {
      restoreIndex();
      session.current ??= readSession();
      if (session.current) {
        setActiveId(session.current.conversationId);
        if (!records.length) void history();
      }
    }
  }
  function newConversation() {
    if (locked.current) return;
    session.current = null;
    setActiveId(null);
    setRecords([]);
    setText('');
    setNotice('');
    setHasOlder(false);
    try {
      sessionStorage.removeItem(storageKey);
    } catch {
      /* Optional persistence. */
    }
    input.current?.focus();
  }
  function handleError(error: unknown) {
    if (error instanceof ChatApiError && [401, 404].includes(error.status)) {
      session.current = null;
      try {
        sessionStorage.removeItem(storageKey);
      } catch {
        /* Optional persistence. */
      }
    }
    setNotice(error instanceof Error ? error.message : 'Có lỗi xảy ra. Vui lòng thử lại.');
  }
  async function history(older = false, selected?: SavedConversation) {
    if (locked.current) return;
    const targetSession = selected ?? session.current ?? readSession();
    if (!targetSession) {
      setNotice('Chưa có lịch sử trò chuyện trong phiên này.');
      return;
    }
    locked.current = true;
    setBusy(true);
    setNotice('');
    try {
      const target = targetSession;
      const { messages } = await loadHistory(target, older ? records.length : 0, {
        credentials: embedded ? 'omit' : 'include',
      });
      session.current = target;
      setActiveId(target.conversationId);
      try {
        sessionStorage.setItem(storageKey, JSON.stringify(target));
      } catch {
        /* Optional persistence. */
      }
      if (selected) {
        setText('');
        if (!fullScreen && window.innerWidth < 600) setHistoryOpen(false);
      }
      const chronological = [...messages].reverse();
      setRecords((current) => (older ? [...chronological, ...current] : chronological));
      setHasOlder(messages.length === 50);
      if (
        !conversationIndex.current.some((item) => item.conversationId === target.conversationId)
      ) {
        remember(
          target,
          chronological[0]?.message ?? 'Cuộc trò chuyện mới',
          messages.reduce((count, item) => count + (item.result ? 2 : 1), 0),
        );
      }
      if (!messages.length) setNotice('Chưa có lịch sử trò chuyện trong phiên này.');
    } catch (error) {
      handleError(error);
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    const message = text.trim();
    if (!message || locked.current) return;
    locked.current = true;
    setBusy(true);
    setNotice('');
    const requestId = crypto.randomUUID();
    try {
      await verifyAuth?.();
      session.current ??= readSession();
      restoreIndex();
      if (!session.current || isExpired(session.current)) {
        session.current = await createConversation({ credentials: embedded ? 'omit' : 'include' });
        setRecords([]);
        setHasOlder(false);
        try {
          sessionStorage.setItem(storageKey, JSON.stringify(session.current));
        } catch {
          /* Optional persistence. */
        }
      }
      setActiveId(session.current.conversationId);
      remember(session.current, message, 1);
      setRecords((current) => [
        ...current,
        { requestId, message, status: 'pending', result: null },
      ]);
      setText('');
      const result = await sendMessage(session.current, message, requestId, {
        credentials: embedded ? 'omit' : 'include',
      });
      remember(session.current, message, 1);
      setRecords((current) =>
        current.map((record) =>
          record.requestId === requestId ? { ...record, status: 'completed', result } : record,
        ),
      );
    } catch (error) {
      setRecords((current) =>
        current.map((record) =>
          record.requestId === requestId ? { ...record, status: 'failed' } : record,
        ),
      );
      setText(message);
      handleError(error);
    } finally {
      locked.current = false;
      setBusy(false);
      input.current?.focus();
    }
  }
  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }
  return (
    <>
      {!open && (
        <button
          ref={launcher}
          className="chat-launcher"
          aria-label="Mở HUST Assistant"
          aria-expanded={false}
          aria-controls="hust-chat"
          onClick={() => setOpen(true)}
        >
          <BotIcon />
        </button>
      )}
      {open && (
        <section
          id="hust-chat"
          className={`chat-panel${expanded ? ' chat-panel-expanded' : ''}${historyOpen ? ' chat-panel-with-history' : ''}`}
          aria-label="HUST Assistant"
          onKeyDown={(event) => {
            if (event.key === 'Escape') setOpen(false);
          }}
        >
          {historyOpen && (
            <aside className="chat-history" id="chat-history" aria-label="Lịch sử trò chuyện">
              <div className="chat-history-header">
                <h2>LỊCH SỬ</h2>
                <span>Phiên hiện tại</span>
              </div>
              <div className="chat-history-list">
                <button className="chat-new-conversation" disabled={busy} onClick={newConversation}>
                  <span aria-hidden="true">+</span>Cuộc trò chuyện mới
                </button>
                {!conversations.length && (
                  <p className="chat-history-empty">Chưa có cuộc trò chuyện nào.</p>
                )}
                {Object.entries(
                  conversations.reduce<Record<string, SavedConversation[]>>((groups, item) => {
                    const month = new Date(item.createdAt).toLocaleDateString('vi-VN', {
                      month: 'long',
                      year: 'numeric',
                    });
                    (groups[month] ??= []).push(item);
                    return groups;
                  }, {}),
                ).map(([month, items]) => (
                  <div key={month}>
                    <h3 className="chat-history-month">{month}</h3>
                    {items.map((item) => (
                      <button
                        key={item.conversationId}
                        className={`chat-history-item${activeId === item.conversationId ? ' is-active' : ''}`}
                        disabled={busy}
                        aria-current={activeId === item.conversationId ? 'true' : undefined}
                        onClick={() => void history(false, item)}
                      >
                        <span>{item.title}</span>
                        <small>{item.messageCount} tin nhắn</small>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
              {!fullScreen && (
                <button
                  className="chat-history-collapse"
                  aria-label="Thu gọn lịch sử"
                  onClick={() => setHistoryOpen(false)}
                >
                  ‹
                </button>
              )}
            </aside>
          )}
          <div className="chat-main">
            <header className="chat-header">
              <span className="chat-brand">
                <BotIcon />
                <h1>HUST ASSISTANT</h1>
              </span>
              <div className="chat-actions">
                <button
                  aria-label="Xem lịch sử trò chuyện"
                  title="Lịch sử trò chuyện"
                  disabled={fullScreen}
                  aria-expanded={historyOpen}
                  aria-controls="chat-history"
                  onClick={toggleHistory}
                >
                  <Icon name="history" />
                </button>
                <button
                  aria-label="Mở chat toàn màn hình trong tab mới"
                  title={fullScreen ? 'Đang ở trang chat toàn màn hình' : 'Mở chat trong tab mới'}
                  disabled={fullScreen}
                  onClick={openFullScreen}
                >
                  <Icon name="expand" />
                </button>
                <button aria-label="Đóng trợ lý" title="Đóng" onClick={() => setOpen(false)}>
                  <Icon name="close" />
                </button>
              </div>
            </header>
            {authPanel}
            {embedded && (
              <div className="demo-auth">
                <button onClick={openFullScreen}>M? trang chat ?? ??ng nh?p v? xem ?i?m</button>
              </div>
            )}
            <div
              className="chat-messages"
              role="log"
              aria-label="Nội dung trò chuyện"
              aria-live="polite"
              aria-busy={busy}
            >
              {hasOlder && (
                <button
                  className="chat-load-more"
                  disabled={busy}
                  onClick={() => void history(true)}
                >
                  Xem tin nhắn cũ hơn
                </button>
              )}
              {records.map((record) => (
                <div className="chat-turn" key={record.requestId}>
                  <div className="chat-bubble chat-bubble-user">
                    <span className="sr-only">Bạn: </span>
                    {record.message}
                  </div>
                  {record.result && (
                    <div className="chat-bubble chat-bubble-assistant">
                      <span className="sr-only">HUST Assistant: </span>
                      {record.result.answer}
                      {!!record.result.citations?.length && (
                        <ul className="chat-sources">
                          {record.result.citations.map((citation, index) => (
                            <li key={`${citation.evidenceId}-${index}`}>
                              <a
                                href={safeUrl(citation.url)}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {citation.title}
                                {citation.location ? ` · ${citation.location}` : ''}
                              </a>
                            </li>
                          ))}
                        </ul>
                      )}
                      {record.result.warnings?.map((warning) => (
                        <p className="chat-warning" key={warning}>
                          {warning}
                        </p>
                      ))}
                    </div>
                  )}
                  {record.status === 'failed' && (
                    <p className="chat-turn-status">
                      Chưa nhận được phản hồi. Bạn có thể xem lịch sử để kiểm tra.
                    </p>
                  )}
                  {record.status === 'pending' && !busy && (
                    <p className="chat-turn-status">
                      Yêu cầu đang chờ xử lý. Bấm lịch sử để cập nhật.
                    </p>
                  )}
                </div>
              ))}
              {busy && (
                <div className="chat-loading" role="status">
                  <span />
                  <span />
                  <span />
                  <span className="sr-only">Đang xử lý…</span>
                </div>
              )}
              <div ref={bottom} />
            </div>
            <footer className="chat-footer">
              {notice && (
                <div className="chat-notice" role="status">
                  <span>{notice}</span>
                  <button aria-label="Ẩn thông báo" onClick={() => setNotice('')}>
                    <Icon name="close" />
                  </button>
                </div>
              )}
              <form className="chat-composer" onSubmit={submit}>
                <button
                  type="button"
                  className="chat-attach"
                  aria-label="Đính kèm ảnh"
                  title="Đính kèm ảnh"
                  onClick={() =>
                    setNotice(
                      'Gửi ảnh chưa được hỗ trợ. Bạn vui lòng nhập nội dung cần hỏi bằng văn bản.',
                    )
                  }
                >
                  <Icon name="attach" />
                </button>
                <textarea
                  ref={input}
                  aria-label="Tin nhắn"
                  placeholder="Nhập tin nhắn hoặc ảnh"
                  rows={1}
                  maxLength={4000}
                  disabled={busy}
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  onKeyDown={onKeyDown}
                />
                <button
                  type="submit"
                  className="chat-send"
                  aria-label="Gửi tin nhắn"
                  title="Gửi tin nhắn"
                  disabled={busy || !text.trim()}
                >
                  <Icon name="send" />
                </button>
              </form>
              <p className="chat-disclaimer">
                Hệ thống hỗ trợ trả lời quy định, quy chế đào tạo HUST, chỉ mang tính chất tham
                khảo, không có giá trị pháp lý
              </p>
            </footer>
          </div>
        </section>
      )}
    </>
  );
}
