"use client";

import { useActionState } from "react";
import type { FormState, Master, Service } from "@/types";
import { createBookingAction } from "../actions";

interface Props {
  services: Service[];
  masters: Master[];
}

const INPUT = "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm";

export default function NewBookingForm({ services, masters }: Props) {
  const [state, action, pending] = useActionState<FormState, FormData>(createBookingAction, {});
  const values = state.values ?? {};

  return (
    <form action={action} className="space-y-4">
      {state.error && (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {state.error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1 text-sm">
          <span>Имя клиента</span>
          <input name="client_name" required maxLength={100} defaultValue={values.client_name} className={INPUT} />
        </label>
        <label className="block space-y-1 text-sm">
          <span>Телефон</span>
          <input
            name="phone"
            type="tel"
            required
            placeholder="+79991234567"
            defaultValue={values.phone}
            className={INPUT}
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span>Услуга</span>
          <select name="service" required defaultValue={values.service ?? ""} className={INPUT}>
            <option value="" disabled>
              Выберите услугу
            </option>
            {services.map((service) => (
              <option key={service.id} value={service.name}>
                {service.name}, {service.duration_min} мин, {service.price_rub} ₽
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1 text-sm">
          <span>Мастер</span>
          <select name="master" required defaultValue={values.master ?? ""} className={INPUT}>
            <option value="" disabled>
              Выберите мастера
            </option>
            {masters.map((master) => (
              <option key={master.id} value={master.name}>
                {master.name}, {master.specialty}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1 text-sm">
          <span>Дата</span>
          <input name="date" type="date" required defaultValue={values.date} className={INPUT} />
        </label>
        <label className="block space-y-1 text-sm">
          <span>Время</span>
          <input name="time" type="time" step={1800} required defaultValue={values.time} className={INPUT} />
        </label>
      </div>

      <label className="block space-y-1 text-sm">
        <span>Заметка (необязательно)</span>
        <textarea name="note" rows={3} maxLength={500} defaultValue={values.note} className={INPUT} />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
      >
        {pending ? "Записываем…" : "Записать"}
      </button>
    </form>
  );
}
