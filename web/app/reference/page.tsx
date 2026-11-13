import { formatPrice } from "@/lib/format";
import { readResourceJson } from "@/lib/salon";
import type { Master, Service } from "@/types";

export const dynamic = "force-dynamic";

export default async function ReferencePage() {
  const [services, masters] = await Promise.all([
    readResourceJson<Service[]>("salon://services"),
    readResourceJson<Master[]>("salon://masters"),
  ]);

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h1 className="text-2xl font-semibold">Услуги</h1>
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-100 text-zinc-600">
              <tr>
                <th className="px-4 py-2 font-medium">Услуга</th>
                <th className="px-4 py-2 font-medium">Категория</th>
                <th className="px-4 py-2 font-medium">Длительность</th>
                <th className="px-4 py-2 font-medium">Цена</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {services.map((service) => (
                <tr key={service.id}>
                  <td className="px-4 py-2">{service.name}</td>
                  <td className="px-4 py-2">{service.category}</td>
                  <td className="whitespace-nowrap px-4 py-2">{service.duration_min} мин</td>
                  <td className="whitespace-nowrap px-4 py-2">{formatPrice(service.price_rub)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Мастера</h2>
        <ul className="grid gap-3 sm:grid-cols-3">
          {masters.map((master) => (
            <li key={master.id} className="rounded-lg border border-zinc-200 bg-white p-4">
              <p className="font-medium">{master.name}</p>
              <p className="text-sm text-zinc-600">{master.specialty}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
