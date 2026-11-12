import type { BookingStatus } from "@/types";

export function formatDateTime(iso: string): string {
  const [date, time] = iso.split("T");
  const [year, month, day] = date.split("-");
  return `${day}.${month}.${year} ${time}`;
}

export function formatPrice(rub: number): string {
  return `${rub.toLocaleString("ru-RU")} ₽`;
}

export const STATUS_LABEL: Record<BookingStatus, string> = {
  booked: "Записан",
  completed: "Состоялся",
  no_show: "Не пришёл",
  cancelled: "Отменена",
};

export const STATUS_STYLE: Record<BookingStatus, string> = {
  booked: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  no_show: "bg-amber-100 text-amber-800",
  cancelled: "bg-zinc-200 text-zinc-700",
};
