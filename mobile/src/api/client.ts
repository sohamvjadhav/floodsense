import { API_URL } from "../config";

export async function apiGet<T>(path: string): Promise<T> {
  const r = await fetch(`${API_URL}${path}`);
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return r.json() as Promise<T>;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const e = await r.json().catch(() => null);
    const msg =
      e && Array.isArray(e.detail) && e.detail[0]?.msg
        ? e.detail[0].msg
        : `${path} failed (${r.status})`;
    throw new Error(msg);
  }
  return r.json() as Promise<T>;
}
