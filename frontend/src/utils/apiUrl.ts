const BASE = import.meta.env.VITE_API_BASE_URL || '';

export function apiUrl(path: string): string {
  return `${BASE}${path}`;
}
