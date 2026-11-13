export type BookingStatus = "booked" | "completed" | "no_show" | "cancelled";

export interface Booking {
  id: number;
  client: string;
  phone: string;
  master: string;
  service: string;
  start_at: string;
  end_at: string;
  status: BookingStatus;
  price_rub: number;
  note: string;
}

export interface Service {
  id: number;
  name: string;
  category: string;
  duration_min: number;
  price_rub: number;
}

export interface Master {
  id: number;
  name: string;
  specialty: string;
}

export interface ToolResult {
  ok: boolean;
  text: string;
}

export interface FormState {
  error?: string;
  values?: Record<string, string>;
}
