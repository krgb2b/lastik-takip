/**
 * Formatting utilities for displaying values in user-friendly formats
 */

export function formatMoney(value: number | null | undefined): string {
  return Number(value || 0).toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "-";

  return new Date(value).toLocaleString("tr-TR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getMonthStart(date = new Date()): string {
  const year = date.getFullYear();
  const month = date.getMonth();
  return toDateInputValue(new Date(year, month, 1));
}

export function getMonthEnd(date = new Date()): string {
  const year = date.getFullYear();
  const month = date.getMonth();
  return toDateInputValue(new Date(year, month + 1, 0));
}

export function formatTyreStatus(value: string | null | undefined): string {
  const status = value || "";

  const map: Record<string, string> = {
    collected: "Müşteriden Alındı",
    factory_received: "Fabrikaya Girdi",
    approved_for_production: "Üretime Hazır",
    in_production: "Üretim Aşamasında",
    stocked: "Stokta",
    carcass_stocked: "Karkas Stokta",
    allocated_to_shipment: "Sevkiyat Programında",
    ready_for_loading: "Yüklemeye Hazır",
    loaded: "Araca Yüklendi",
    draft: "Taslak",
    shipped: "Sevk Edildi",
    rejected: "Reddedildi",
  };

  return map[status] || status || "-";
}
