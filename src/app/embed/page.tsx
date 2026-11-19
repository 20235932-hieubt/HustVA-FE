import { ChatWidget } from '@/components/chat-widget';

export default async function EmbedPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  let parentOrigin: string | undefined;
  try {
    const url = new URL(typeof params.parentOrigin === 'string' ? params.parentOrigin : '');
    if (['http:', 'https:'].includes(url.protocol)) parentOrigin = url.origin;
  } catch {
    /* Opening /embed directly does not require a parent. */
  }
  return (
    <main className="embed-surface" aria-label="Trợ lý HUST nhúng">
      <ChatWidget embedded parentOrigin={parentOrigin} initiallyOpen={params.open === 'true'} />
    </main>
  );
}
