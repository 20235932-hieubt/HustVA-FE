import type { ReactNode } from 'react';
import './globals.css';
export const metadata = {
  title: 'HUST Assistant',
  description: 'Trợ lý hỗ trợ tra cứu quy định, quy chế đào tạo HUST.',
};
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
