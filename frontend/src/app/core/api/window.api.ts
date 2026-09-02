import { Injectable, inject } from '@angular/core';
import { ApiClient } from '../api.client';
import { BiddingWindow, WindowState } from '../models';
import { formatDateTime, fromLocalInputValue } from '../format';

interface WindowPayload {
  opensAt: string | null;
  closesAt: string | null;
  resolvedAt: string | null;
  state: WindowState;
}

export function toBiddingWindow(payload: WindowPayload): BiddingWindow {
  return {
    opensAt: formatDateTime(payload.opensAt) || 'not set',
    closesAt: formatDateTime(payload.closesAt) || 'not set',
    resolvedAt: payload.resolvedAt ? formatDateTime(payload.resolvedAt) : null,
    state: payload.state,
    opensAtIso: payload.opensAt,
    closesAtIso: payload.closesAt,
    resolvedAtIso: payload.resolvedAt,
  };
}

/** The single global bidding window shared by every class. */
@Injectable({ providedIn: 'root' })
export class WindowApi {
  private readonly api = inject(ApiClient);

  async get(): Promise<BiddingWindow> {
    return toBiddingWindow(await this.api.get<WindowPayload>('/window'));
  }

  /** Accepts `datetime-local` values and sends instants. */
  async save(opensAtLocal: string, closesAtLocal: string): Promise<BiddingWindow> {
    const payload = await this.api.put<WindowPayload>('/admin/window', {
      opensAt: fromLocalInputValue(opensAtLocal),
      closesAt: fromLocalInputValue(closesAtLocal),
    });
    return toBiddingWindow(payload);
  }
}
