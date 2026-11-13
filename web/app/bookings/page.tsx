import Link from "next/link";
import { formatDateTime, formatPrice, STATUS_LABEL, STATUS_STYLE } from "@/lib/format";
import { readResourceJson } from "@/lib/salon";
import type { Booking } from "@/types";

export const dynamic = "force-dynamic";

export default async function BookingsPage() {
  const bookings = await readResourceJson<Booking[]>("salon://bookings");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Записи</h1>
        <Link
          href="/bookings/new"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
        >
          Новая запись
        </Link>
      </div>

      {bookings.length === 0 ? (
        <p className="rounded-lg border border-zinc-200 bg-white p-4 text-zinc-600">Записей пока нет.</p>
      ) : (
        <ul className="space-y-3">
          {bookings.map((booking) => (
            <li key={booking.id}>
              <Link
                href={`/bookings/${booking.id}`}
                className="block rounded-lg border border-zinc-200 bg-white p-4 hover:border-zinc-400"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      №{booking.id} · {booking.client}
                    </p>
                    <p className="text-sm text-zinc-600">
                      {booking.service}, мастер {booking.master}
                    </p>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[booking.status]}`}>
                    {STATUS_LABEL[booking.status]}
                  </span>
                </div>
                <p className="mt-2 text-sm text-zinc-700">
                  {formatDateTime(booking.start_at)} · {formatPrice(booking.price_rub)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
