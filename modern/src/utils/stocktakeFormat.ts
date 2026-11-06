import type { InventoryLocale } from "../i18n";

/** Extract opaque asset QR UUID, not a credential or authorization token. */
export function scanUuid(value: string): string | null {
  const match = value.match(/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}/i);
  return match?.[0] ?? null;
}

export function formatStocktakeDate(raw: string | null, locale: InventoryLocale): string {
  return raw
    ? new Date(raw).toLocaleString(locale === "en" ? "en-GB" : locale === "ka" ? "ka-GE" : "ru-RU")
    : "—";
}
