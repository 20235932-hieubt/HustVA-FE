import type { Conversation } from './chat-api';

export interface SavedConversation extends Conversation {
  title: string;
  createdAt: string;
  messageCount: number;
}
const key = 'hust-assistant-conversations';
export function readConversations(): SavedConversation[] {
  try {
    const values: unknown = JSON.parse(sessionStorage.getItem(key) ?? '[]');
    if (!Array.isArray(values)) return [];
    return values.filter(
      (item): item is SavedConversation =>
        !!item &&
        typeof item.conversationId === 'string' &&
        typeof item.token === 'string' &&
        typeof item.title === 'string' &&
        typeof item.createdAt === 'string' &&
        Number.isFinite(Date.parse(item.createdAt)) &&
        typeof item.messageCount === 'number' &&
        Date.parse(item.expiresAt) > Date.now(),
    );
  } catch {
    return [];
  }
}
export function saveConversation(
  session: Conversation,
  title: string,
  additionalMessages: number,
  current: SavedConversation[] = readConversations(),
): SavedConversation[] {
  const previous = current.find((item) => item.conversationId === session.conversationId);
  const next = [
    {
      ...session,
      title: previous?.title ?? title.slice(0, 100),
      createdAt: previous?.createdAt ?? new Date().toISOString(),
      messageCount: (previous?.messageCount ?? 0) + additionalMessages,
    },
    ...current.filter((item) => item.conversationId !== session.conversationId),
  ];
  try {
    sessionStorage.setItem(key, JSON.stringify(next));
  } catch {
    /* Keep in-memory history. */
  }
  return next;
}
