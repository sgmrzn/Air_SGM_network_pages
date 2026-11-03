export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

export class HttpRequestError extends Error {
  constructor(message: string, public readonly status: number, public readonly detail: unknown) {
    super(message);
    this.name = "HttpRequestError";
  }
}

export async function request<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, options);
  if (!response.ok) {
    const text = await response.text();
    let payload: {
      detail?:
        | string
        | { message?: string }
        | Array<{ msg?: string }>;
    } | null = null;
    try {
      payload = JSON.parse(text) as {
        detail?:
          | string
          | { message?: string }
          | Array<{ msg?: string }>;
      };
    } catch {
      // Plain-text server errors remain readable below.
    }
    const detail = payload?.detail;
    const validationMessage = Array.isArray(detail)
      ? detail
          .map((issue) => issue.msg?.replace(/^Value error,\s*/i, ""))
          .filter(Boolean)
          .join("; ")
      : undefined;
    const message =
      typeof detail === "string"
        ? detail
        : validationMessage ||
          (detail && !Array.isArray(detail) ? detail.message : undefined) ||
          (text.length <= 500 ? text : undefined) ||
          `Ошибка запроса: ${response.status} ${response.statusText}`.trim();
    throw new HttpRequestError(message, response.status, detail);
  }
  return response.json() as Promise<T>;
}
