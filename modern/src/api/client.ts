/** Same-origin-only Laravel session client. Do not copy Portal/HRM cookies or tokens. */
const apiRoot = "/inventory-api";
const csrfCookieName = "INVENTORY-XSRF-TOKEN";

export class InventoryApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields: Record<string, string[]> = {},
    readonly requestId: string | null = null,
  ) { super(message); this.name = "InventoryApiError"; }
}

function readXsrfCookie(): string | null {
  const prefix = csrfCookieName + "=";
  const pair = document.cookie.split("; ").find(item => item.startsWith(prefix));
  if (!pair) return null;
  try { return decodeURIComponent(pair.slice(prefix.length)); }
  catch { return null; }
}

let csrfPromise: Promise<void> | null = null;

export async function initializeCsrf(): Promise<void> {
  if (readXsrfCookie()) return;
  if (!csrfPromise) {
    csrfPromise = fetch(apiRoot + "/sanctum/csrf-cookie", {
      method: "GET", credentials: "same-origin", headers: { Accept: "application/json" },
    }).then(response => {
      if (!response.ok) throw new InventoryApiError(response.status, "CSRF_INIT_FAILED", "CSRF cookie unavailable");
      if (!readXsrfCookie()) throw new InventoryApiError(419, "CSRF_COOKIE_MISSING", "CSRF cookie not received");
    }).finally(() => { csrfPromise = null; });
  }
  await csrfPromise;
}

function errorMessage(status: number): string {
  switch (status) {
    case 401: return "Требуется вход";
    case 403: return "Недостаточно прав";
    case 404: return "Запись не найдена";
    case 409: return "Запись изменена другим пользователем";
    case 419: return "Сессия истекла";
    case 422: return "Проверьте введённые данные";
    case 429: return "Слишком много запросов";
    default: return "Ошибка сервера HTTP " + status;
  }
}

export async function inventoryRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  // A caller must never be able to turn an internal call into an external fetch.
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\"))
    throw new Error("Invalid Inventory API path");

  const method = (init.method ?? "GET").toUpperCase();
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");

  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    await initializeCsrf();
    const cookie = readXsrfCookie();
    if (!cookie) throw new InventoryApiError(419, "CSRF_COOKIE_MISSING", "CSRF cookie missing");
    headers.set("X-XSRF-TOKEN", cookie);
  }

  const response = await fetch(apiRoot + path, {
    ...init, method, headers, credentials: "same-origin",
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = payload && typeof payload === "object"
      ? payload as Record<string, unknown> : {};
    const fields: Record<string, string[]> = {};
    if (error.errors && typeof error.errors === "object" && !Array.isArray(error.errors)) {
      for (const [key,value] of Object.entries(error.errors)) {
        if (Array.isArray(value) && value.every(item => typeof item === "string")) {
          fields[key] = value;
        }
      }
    }
    throw new InventoryApiError(
      response.status, typeof error.code === "string" ? error.code : "HTTP_ERROR",
      errorMessage(response.status), fields, response.headers.get("X-Request-ID"),
    );
  }
  if (response.status === 204) return undefined as T;
  return payload as T;
}