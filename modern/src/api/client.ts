const apiRoot = "/inventory-api";
const csrfCookieName = "INVENTORY-XSRF-TOKEN";

function xsrf(): string | null {
  const pair = document.cookie.split("; ").find(v => v.startsWith(csrfCookieName + "="));
  if (!pair) return null;
  try { return decodeURIComponent(pair.slice(csrfCookieName.length + 1)); }
  catch { return null; }
}

export async function inventoryRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!path.startsWith("/") || path.startsWith("//")) throw new Error("Invalid API path");
  const method = (init.method || "GET").toUpperCase();
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body) headers.set("Content-Type", "application/json");
  if (!["GET","HEAD","OPTIONS"].includes(method)) {
    const cookie = xsrf();
    if (!cookie) throw new Error("Нет CSRF-cookie; обновите страницу.");
    headers.set("X-XSRF-TOKEN", cookie);
  }
  const response = await fetch(apiRoot + path, { ...init, headers, credentials: "same-origin" });
  if (!response.ok) throw new Error(response.status === 401 ? "Требуется вход" :
    response.status === 403 ? "Недостаточно прав" :
    response.status === 419 ? "Сессия истекла" :
    response.status === 422 ? "Проверьте введённые данные" :
    "Ошибка запроса: HTTP " + response.status);
  if (response.status === 204) return undefined as T;
  return await response.json() as T;
}

export async function initializeCsrf(): Promise<void> {
  const res = await fetch(apiRoot + "/sanctum/csrf-cookie", { credentials: "same-origin" });
  if (!res.ok) throw new Error("Не удалось получить CSRF-cookie");
}
