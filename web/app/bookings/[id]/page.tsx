import Link from "next/link";
import { notFound } from "next/navigation";
import { needsApproval } from "@/lib/approval";
import { formatDateTime, formatPrice, STATUS_LABEL, STATUS_STYLE } from "@/lib/format";
import { readResourceJson } from "@/lib/salon";
import type { Booking } from "@/types";
import CancelBookingButton from "./CancelBookingButton";

export const dynamic = "force-dynamic";

export default async function BookingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();

  const booking = await readResourceJson<Booking>(`salon://bookings/${id}`);

  const rows: [string, string][] = [
    ["Клиент", booking.client],
    ["Телефон", booking.phone],
    ["Услуга", booking.service],
    ["Мастер", booking.master],
    ["Начало", formatDateTime(booking.start_at)],
    ["Окончание", formatDateTime(booking.end_at)],
    ["Стоимость", formatPrice(booking.price_rub)],
  ];

  return (
    <div className="space-y-5">
      <Link href="/bookings" className="text-sm text-zinc-600 hover:text-zinc-900">
        ← К списку записей
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">Запись №{booking.id}</h1>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[booking.status]}`}>
          {STATUS_LABEL[booking.status]}
        </span>
      </div>

      <dl className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white">
        {rows.map(([label, value]) => (
          <div key={label} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:gap-4">
            <dt className="w-40 shrink-0 text-sm text-zinc-500">{label}</dt>
            <dd className="break-words">{value}</dd>
          </div>
        ))}
        {booking.note && (
          <div className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:gap-4">
            <dt className="w-40 shrink-0 text-sm text-zinc-500">Заметка</dt>
            <dd className="break-words">{booking.note}</dd>
          </div>
        )}
      </dl>

      {booking.status === "booked" && (
        <CancelBookingButton bookingId={booking.id} requireConfirm={needsApproval("cancel_booking")} />
      )}
    </div>
  );
}
