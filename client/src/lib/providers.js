import { apiFetch } from "./api";

export async function fetchProviders() {
  const res = await apiFetch("/api/providers");
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || res.statusText || "Failed to load providers");
  }
  return Array.isArray(data) ? data : [];
}
