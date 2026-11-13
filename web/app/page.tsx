import Link from "next/link";
import { getMcpStatus, getModelStatus, type StatusItem } from "@/lib/status";

export const dynamic = "force-dynamic";

function StatusCard({ item }: { item: StatusItem }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className={`inline-block h-2.5 w-2.5 rounded-full ${item.ok ? "bg-green-500" : "bg-red-500"}`}
        />
        <h2 className="font-medium">{item.title}</h2>
        <span className="text-sm text-zinc-00">{item.ok ? "работает" : "недоступно"}</span>
      </div>
      <p className="mt-2 text-sm text-zinc-700">{item.detail}</p>
    </div>
  );
}

const SECTIONS = [
  { href: "/bookings", title: "Записи", text: "Список записей, карточка, отмена" },
  { href: "/bookings/new", title: "Новая запись", text: "Запись клиента к мастеру" },
  { href: "/reference", title: "Справочник", text: "Услуги, цены и мастера" },
  { href: "/chat", title: "Чат-ассистент", text: "Запись и поиск обычными словами" },
];

export default async function HomePage() {
  const [mcp, model] = await Promise.all([getMcpStatus(), getModelStatus()]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Панель салона красоты</h1>

      <section aria-label="Состояние подключения" className="grid gap-3 sm:grid-cols-2">
        <StatusCard item={mcp} />
        <StatusCard item={model} />
      </section>

      <section aria-label="Разделы" className="grid gap-3 sm:grid-cols-2">
        {SECTIONS.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="rounded-lg border border-zinc-200 bg-white p-4 hover:border-zinc-400"
          >
            <h2 className="font-medium">{section.title}</h2>
            <p className="mt-1 text-sm text-zinc-600">{section.text}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
