"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { mcpErrorText } from "@/lib/errors";
import { callSalonTool } from "@/lib/salon";
import type { FormState } from "@/types";

function field(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

export async function createBookingAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = {
    client_name: field(formData, "client_name"),
    phone: field(formData, "phone"),
    master: field(formData, "master"),
    service: field(formData, "service"),
    date: field(formData, "date"),
    time: field(formData, "time"),
    note: field(formData, "note"),
  };

  if (!values.date || !values.time) {
    return { error: "Укажите дату и время визита.", values };
  }

  let result;
  try {
    result = await callSalonTool("create_booking", {
      client_name: values.client_name,
      phone: values.phone,
      master: values.master,
      service: values.service,
      start: `${values.date}T${values.time}`,
      note: values.note,
    });
  } catch (error) {
    return { error: mcpErrorText(error), values };
  }

  // Текст ToolError от сервера показываем как есть.
  if (!result.ok) {
    return { error: result.text, values };
  }

  revalidatePath("/bookings");
  redirect("/bookings");
}

export async function cancelBookingAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const bookingId = Number(field(formData, "booking_id"));
  if (!Number.isInteger(bookingId) || bookingId <= 0) {
    return { error: "Неверный номер записи." };
  }

  let result;
  try {
    result = await callSalonTool("cancel_booking", { booking_id: bookingId });
  } catch (error) {
    return { error: mcpErrorText(error) };
  }

  if (!result.ok) {
    return { error: result.text };
  }

  revalidatePath("/bookings");
  revalidatePath(`/bookings/${bookingId}`);
  redirect("/bookings");
}
