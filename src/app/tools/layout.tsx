import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Tool management | HustVA',
  robots: { index: false, follow: false },
};

export default function ToolsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
