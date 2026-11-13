import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Салон красоты: панель",
  description: "Запись клиентов, расписание мастеров и ассистент",
};

const NAV_LINKS = [
  { href: "/", label: "Главная" },
  { href: "/bookings", label: "Записи" },
  { href: "/bookings/new", label: "Новая запись" },
  { href: "/reference", label: "Справочник" },
  { href: "/chat", label: "Чат" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className="min-h-screen bg-zinc-50 text-zinc-900 antialiased">
        <header className="border-b border-zinc-200 bg-white">
          <nav className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3">
            <span className="font-semibold">Салон красоты</span>
            {NAV_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="text-sm text-zinc-600 hover:text-zinc-900">
                {link.label}
              </Link>
            ))}
          </nav>
        </header>
        <main className="mx-auto max-w-4xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
