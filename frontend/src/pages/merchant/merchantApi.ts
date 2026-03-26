import { getAuthHeaders } from '../../utils/authStorage';

interface ErrorPayload {
  error?: string;
  message?: string;
}

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const payload = (await response.json()) as ErrorPayload;
    return payload.error || payload.message || fallback;
  } catch {
    return fallback;
  }
}

export async function merchantFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...getAuthHeaders(true),
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    throw new Error(await readError(response, `Request failed (${response.status})`));
  }

  if (response.status === 204) {
    return null as T;
  }

  return (await response.json()) as T;
}
