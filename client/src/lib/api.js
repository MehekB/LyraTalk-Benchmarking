/**
 * Build an absolute URL for API calls.
 * - Default (empty VITE_API_ORIGIN): use same origin + Vite dev proxy → Express on :3001.
 * - Set VITE_API_ORIGIN=http://127.0.0.1:3001 if proxy returns 404 (restart Vite after changing vite.config, or bypass proxy).
 */
const origin = (import.meta.env.VITE_API_ORIGIN || "").replace(/\/$/, "");

export function apiUrl(path) {
  if (!path.startsWith("/")) {
    throw new Error(`apiUrl: path must start with /, got ${path}`);
  }
  return origin ? `${origin}${path}` : path;
}

export function apiFetch(path, init) {
  return fetch(apiUrl(path), init);
}
