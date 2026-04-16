const API_BASE = '/api';

export async function camundaFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(
      `Camunda API error: ${res.status} ${res.statusText}${body ? ` — ${body}` : ''}`
    );
  }
  if (res.status === 204) return null as T;
  return res.json();
}
