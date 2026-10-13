import type { OrderStatus } from "../types/index";

export const statusLabels: Record<OrderStatus, string> = {
  pending_payment: "Pending Payment", verifying_payment: "Verifying Payment", payment_rejected: "Payment Rejected",
  payment_confirmed: "Payment Confirmed", processing: "Processing", completed: "Completed", cancelled: "Cancelled",
};
export function money(centavos: number) {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(centavos / 100);
}
export function dateTime(value: string) {
  return new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }).format(new Date(value));
}
