export interface Conversation {
  conversationId: string;
  token: string;
  expiresAt: string;
}
export interface ChatResult {
  answer: string;
  warnings: string[];
  citations: { evidenceId: string; title: string; url: string; location: string }[];
}
export interface ChatRecord {
  requestId: string;
  message: string;
  status: 'pending' | 'completed' | 'failed';
  result: ChatResult | null;
}
const apiUrl = (process.env.NEXT_PUBLIC_API_URL?.trim() || '/api/v1').replace(/\/$/, '');
export class ChatApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${apiUrl}/chat${path}`, {
      ...options,
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', ...options.headers },
      signal: AbortSignal.timeout(90_000),
    });
  } catch {
    throw new Error('Không thể kết nối máy chủ. Vui lòng kiểm tra kết nối và thử lại.');
  }
  const data = await response.json();
  if (!response.ok)
    throw new ChatApiError(response.status, data.error?.message ?? 'Không thể xử lý yêu cầu.');
  return data as T;
}
export function createConversation() {
  return request<Conversation>('/conversations', { method: 'POST', body: '{}' });
}
export function sendMessage(session: Conversation, message: string, requestId: string) {
  return request<ChatResult>(`/conversations/${session.conversationId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.token}` },
    body: JSON.stringify({ message, requestId }),
  });
}
export function loadHistory(session: Conversation, offset = 0) {
  return request<{ messages: ChatRecord[] }>(
    `/conversations/${session.conversationId}/messages?limit=50&offset=${offset}`,
    { headers: { Authorization: `Bearer ${session.token}` } },
  );
}
