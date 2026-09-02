import { Injectable } from '@angular/core';

/** Error thrown for every non-2xx response, carrying the server's own message. */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown = null,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

/**
 * Thin fetch wrapper for the REST API.
 *
 * The API is always addressed at the absolute `/api` prefix: nginx proxies that
 * path to the backend regardless of the base href the SPA is served under.
 */
@Injectable({ providedIn: 'root' })
export class ApiClient {
  private unauthorizedHandler: (() => void) | null = null;

  /** AuthService registers here so any 401 clears the cached identity once. */
  onUnauthorized(handler: () => void): void {
    this.unauthorizedHandler = handler;
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PATCH', path, body);
  }

  put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PUT', path, body);
  }

  delete<T>(path: string): Promise<T> {
    return this.request<T>('DELETE', path);
  }

  async request<T>(method: Method, path: string, body?: unknown): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`/api${path}`, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new ApiError(
        'The server could not be reached. Check your connection and try again.',
        0,
      );
    }

    const payload = await this.parse(response);

    if (response.status === 401) {
      this.unauthorizedHandler?.();
    }
    if (!response.ok) {
      throw new ApiError(this.messageOf(payload, response.status), response.status, payload);
    }
    return payload as T;
  }

  private async parse(response: Response): Promise<unknown> {
    const text = await response.text();
    if (!text) {
      return null;
    }
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return text;
    }
  }

  /** Server messages are surfaced verbatim so the UI matches the API contract. */
  private messageOf(payload: unknown, status: number): string {
    const message = (payload as { message?: unknown } | null)?.message;
    if (Array.isArray(message)) {
      return message.join(' ');
    }
    if (typeof message === 'string' && message.trim()) {
      return message;
    }
    if (status === 403) {
      return 'You do not have permission to do that.';
    }
    if (status === 404) {
      return 'That item could not be found.';
    }
    return `Request failed (${status}).`;
  }
}
