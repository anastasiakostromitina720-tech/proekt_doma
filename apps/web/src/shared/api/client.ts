import { publicEnv } from '@/lib/env';

/**
 * HTTP client with:
 *   - credentials: 'include' (httpOnly cookie auth)
 *   - automatic Bearer <accessToken> attachment from the session store
 *   - single-flight refresh on 401, then one retry of the original request
 *   - hard logout (clear session + redirect) if refresh also fails
 *   - in-flight de-dupe for identical GETs (Link prefetch + useEffect, double mount, etc.)
 *
 * The refresh mechanism is wired lazily via `configureApiClient()` to avoid
 * an import cycle with the session store (which itself uses this client).
 */

export interface ApiErrorBody {
  statusCode: number;
  code: string;
  message: string;
  path: string;
  timestamp: string;
  details?: unknown;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(body: ApiErrorBody) {
    super(body.message);
    this.name = 'ApiError';
    this.status = body.statusCode;
    this.code = body.code;
    this.details = body.details;
  }
}

export interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  /**
   * If true, this request will neither attach an access token nor attempt
   * a 401-triggered refresh. Used for the auth endpoints themselves.
   */
  skipAuth?: boolean;
}

interface ApiClientHooks {
  getAccessToken: () => string | null;
  /**
   * Attempt to refresh the session. Implementations MUST implement
   * single-flight internally (see session store).
   */
  refresh: () => Promise<boolean>;
  /**
   * Called when refresh fails and the user must be sent back to /login.
   * Implementations should clear any client session state.
   */
  onAuthFailure: () => void;
}

let hooks: ApiClientHooks | null = null;

export function configureApiClient(next: ApiClientHooks): void {
  hooks = next;
}

const buildUrl = (path: string, query?: ApiRequestOptions['query']): string => {
  const base = publicEnv.NEXT_PUBLIC_API_URL.replace(/\/+$/, '');
  const suffix = path.startsWith('/') ? path : `/${path}`;
  const url = `${base}${suffix}`;
  if (!query) return url;

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    params.append(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
};

const toApiError = async (response: Response, path: string): Promise<ApiError> => {
  const isJson = response.headers.get('content-type')?.includes('application/json') ?? false;
  let payload: unknown = undefined;
  try {
    payload = isJson ? await response.json() : await response.text();
  } catch {
    payload = undefined;
  }

  if (
    isJson &&
    payload &&
    typeof payload === 'object' &&
    'code' in (payload as Record<string, unknown>)
  ) {
    return new ApiError(payload as ApiErrorBody);
  }

  return new ApiError({
    statusCode: response.status,
    code: 'HTTP_ERROR',
    message: typeof payload === 'string' && payload ? payload : response.statusText,
    path,
    timestamp: new Date().toISOString(),
  });
};

async function rawFetch(
  path: string,
  options: ApiRequestOptions,
): Promise<{ response: Response; path: string }> {
  const { body, query, headers, skipAuth: _skipAuth, ...rest } = options;
  const hasJsonBody = body !== undefined && !(body instanceof FormData);

  const token = !options.skipAuth ? hooks?.getAccessToken() ?? null : null;

  const response = await fetch(buildUrl(path, query), {
    ...rest,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(hasJsonBody ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: hasJsonBody ? JSON.stringify(body) : (body as BodyInit | undefined),
  });

  return { response, path };
}

async function parseBody<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;
  const isJson = response.headers.get('content-type')?.includes('application/json') ?? false;
  return (isJson ? await response.json() : await response.text()) as T;
}

/** Coalesce concurrent identical GETs to one network round-trip + one JSON parse. */
const inflightGet = new Map<string, Promise<unknown>>();

function getInFlightGetKey(path: string, options: ApiRequestOptions): string | null {
  if ((options.method ?? 'GET').toUpperCase() !== 'GET') {
    return null;
  }
  if (options.body !== undefined) {
    return null;
  }
  return `GET|${options.skipAuth ? 1 : 0}|${buildUrl(path, options.query)}`;
}

async function runApiFetch<T>(path: string, options: ApiRequestOptions): Promise<T> {
  const first = await rawFetch(path, options);

  if (first.response.ok) {
    return parseBody<T>(first.response);
  }

  if (first.response.status !== 401 || options.skipAuth) {
    throw await toApiError(first.response, first.path);
  }

  // 401 on a protected request — attempt a single refresh and retry once.
  if (!hooks) {
    throw await toApiError(first.response, first.path);
  }

  const refreshed = await hooks.refresh();
  if (!refreshed) {
    hooks.onAuthFailure();
    throw await toApiError(first.response, first.path);
  }

  const second = await rawFetch(path, options);
  if (second.response.ok) {
    return parseBody<T>(second.response);
  }

  if (second.response.status === 401) {
    hooks.onAuthFailure();
  }
  throw await toApiError(second.response, second.path);
}

export async function apiFetch<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const key = getInFlightGetKey(path, options);
  if (key) {
    const hit = inflightGet.get(key) as Promise<T> | undefined;
    if (hit) {
      return hit;
    }
  }

  const run = runApiFetch<T>(path, options);
  if (key) {
    inflightGet.set(key, run);
    void run.finally(() => {
      inflightGet.delete(key);
    });
  }
  return run;
}

export const api = {
  get: <T>(path: string, options?: ApiRequestOptions) =>
    apiFetch<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: ApiRequestOptions) =>
    apiFetch<T>(path, { ...options, method: 'POST', body }),
  put: <T>(path: string, body?: unknown, options?: ApiRequestOptions) =>
    apiFetch<T>(path, { ...options, method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown, options?: ApiRequestOptions) =>
    apiFetch<T>(path, { ...options, method: 'PATCH', body }),
  delete: <T>(path: string, options?: ApiRequestOptions) =>
    apiFetch<T>(path, { ...options, method: 'DELETE' }),
};
