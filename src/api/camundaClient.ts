const API_BASE = '/api';

/** Gateway-level failures that are usually gone a moment later */
const TRANSIENT_STATUSES = new Set([502, 503, 504]);
const RETRY_DELAYS_MS = [500, 1500, 3000];

export class CamundaApiError extends Error {
  /** HTTP status, or 0 when the request never got a response (network failure) */
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'CamundaApiError';
    this.status = status;
  }

  /** True for gateway/network failures that are worth retrying */
  get transient(): boolean {
    return this.status === 0 || TRANSIENT_STATUSES.has(this.status);
  }
}

/** Reads and search queries can be repeated safely; starts and completions must not be. */
function isIdempotent(path: string, method: string): boolean {
  if (method === 'GET' || method === 'HEAD') return true;
  return method === 'POST' && path.split('?')[0].endsWith('/search');
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function camundaFetch<T>(
  path: string,
  options: RequestInit = {},
  base: string = API_BASE
): Promise<T> {
  const method = (options.method ?? 'GET').toUpperCase();
  const retries = isIdempotent(path, method) ? RETRY_DELAYS_MS : [];

  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(`${base}${path}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });
    } catch (e) {
      if (attempt < retries.length) {
        await sleep(retries[attempt]);
        continue;
      }
      throw new CamundaApiError(0, `Camunda API unreachable — ${(e as Error).message}`);
    }

    if (!res.ok) {
      if (TRANSIENT_STATUSES.has(res.status) && attempt < retries.length) {
        await sleep(retries[attempt]);
        continue;
      }
      const body = await res.text().catch(() => '');
      throw new CamundaApiError(
        res.status,
        `Camunda API error: ${res.status} ${res.statusText}${body ? ` — ${body}` : ''}`
      );
    }
    if (res.status === 204) return null as T;
    return res.json();
  }
}
