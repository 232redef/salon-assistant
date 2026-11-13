import Link from "next/link";
import { readResourceJson } from "@/lib/salon";
import type { Master, Service } from "@/types";
import NewBookingForm from "./NewBookingForm";

export const dynamic = "force-dynamic";

export default async function NewBookingPage() {
  const [services, masters] = await Promise.all([
    readResourceJson<Service[]>("salon://services"),
    readResourceJson<Master[]>("salon://masters"),
  ]);

  return (
    <div className="space-y-5">
      <Link href="/bookings" className="text-sm text-zinc-600 hover:text-zinc-900">
        ← К списку записей
      </Link>
      <h1 className="text-2xl font-semibold">Новая запись</h1>
      <NewBookingForm services={services} masters={masters} />
    </div>
  );
}
