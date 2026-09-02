import { Injectable, inject } from '@angular/core';
import { ApiClient } from '../api.client';
import { Bid } from '../models';

export interface BalanceView {
  pointBalance: number;
  committed: number;
  available: number;
}

interface BidResponse {
  bid: Bid;
  balance: BalanceView;
}

interface MyBidsResponse {
  bids: Bid[];
  balance: BalanceView;
}

/** Placing, editing, and cancelling the signed-in student's bids. */
@Injectable({ providedIn: 'root' })
export class BidsApi {
  private readonly api = inject(ApiClient);

  /** A second bid on the same class edits the existing one rather than duplicating it. */
  place(classId: string, amount: number): Promise<BidResponse> {
    return this.api.post<BidResponse>('/bids', { classId, amount });
  }

  cancel(bidId: string): Promise<{ balance: BalanceView }> {
    return this.api.delete<{ balance: BalanceView }>(`/bids/${encodeURIComponent(bidId)}`);
  }

  mine(): Promise<MyBidsResponse> {
    return this.api.get<MyBidsResponse>('/me/bids');
  }
}
