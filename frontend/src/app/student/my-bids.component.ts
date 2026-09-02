import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { BidsApi } from '../core/api/bids.api';
import { WindowApi } from '../core/api/window.api';
import { Bid, BiddingWindow } from '../core/models';
import { BalanceMeterComponent } from '../shared/balance-meter.component';
import { ErrorBannerComponent } from '../shared/error-banner.component';
import { WindowStatusComponent } from '../shared/window-status.component';
import { formatDateTime } from '../core/format';

/** Every active bid the signed-in student holds, with cancel actions. */
@Component({
  selector: 'app-my-bids',
  standalone: true,
  imports: [RouterLink, BalanceMeterComponent, WindowStatusComponent, ErrorBannerComponent],
  templateUrl: './my-bids.component.html',
  styleUrls: ['./my-bids.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyBidsComponent {
  private readonly auth = inject(AuthService);
  private readonly bidsApi = inject(BidsApi);
  private readonly windowApi = inject(WindowApi);

  readonly balance = this.auth.pointBalance;
  readonly notice = signal<string | null>(null);

  readonly windows = signal<BiddingWindow[]>([]);
  readonly biddingWindow = computed<BiddingWindow | null>(() => this.windows()[0] ?? null);

  readonly bids = signal<Bid[]>([]);

  readonly windowOpen = computed(() => this.biddingWindow()?.state === 'open');
  readonly active = computed(() => this.bids().filter((bid) => bid.status === 'active'));
  readonly committed = computed(() => this.active().reduce((sum, bid) => sum + bid.amount, 0));

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    const [mine, window] = await Promise.all([this.bidsApi.mine(), this.windowApi.get()]);
    this.bids.set(
      mine.bids.map((bid) => ({ ...bid, updatedAt: formatDateTime(bid.updatedAt) })),
    );
    this.windows.set([window]);
    this.auth.setBalance(mine.balance.pointBalance);
  }

  async cancel(bid: Bid): Promise<void> {
    try {
      const response = await this.bidsApi.cancel(bid.id);
      this.auth.setBalance(response.balance.pointBalance);
      this.notice.set(`${bid.amount} points released from ${bid.className}.`);
      await this.load();
    } catch (error) {
      this.notice.set(
        error instanceof Error ? error.message : 'That bid could not be cancelled.',
      );
    }
  }
}
