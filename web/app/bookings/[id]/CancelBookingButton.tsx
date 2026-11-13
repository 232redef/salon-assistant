"use client";

import { useActionState, useState } from "react";
import type { FormState } from "@/types";
import { cancelBookingAction } from "../actions";

interface Props {
  bookingId: number;
  requireConfirm: boolean;
}

export default function CancelBookingButton({ bookingId, requireConfirm }: Props) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<FormState, FormData>(cancelBookingAction, {});

  const error = state.error ? (
    <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
      {state.error}
    </p>
  ) : null;

  if (!requireConfirm) {
    return (
      <form action={action} className="space-y-3">
        {error}
        <input type="hidden" name="booking_id" value={bookingId} />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-50"
        >
          {pending ? "Отмена…" : "Отменить запись"}
        </button>
      </form>
    );
  }

  return (
    <div className="space-y-3">
      {!open && error}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800"
      >
        Отменить запись
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-title"
          className="fixed inset-0 z-10 flex items-center justify-center bg-black/40 p-4"
        >
          <form action={action} className="w-full max-w-sm space-y-4 rounded-lg bg-white p-5 shadow-lg">
            <h2 id="cancel-title" className="text-lg font-semibold">
              Отменить запись №{bookingId}?
            </h2>
            <p className="text-sm text-zinc-600">Действие необратимо: вернуть отменённую запись нельзя.</p>
            {error}
            <input type="hidden" name="booking_id" value={bookingId} />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100"
              >
                Не отменять
              </button>
              <button
                type="submit"
                disabled={pending}
                className="rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-50"
              >
                {pending ? "Отмена…" : "Да, отменить"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
