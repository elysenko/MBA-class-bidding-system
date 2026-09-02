import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { Bid, BiddingWindow } from '../core/models';
import { BalanceMeterComponent } from '../shared/balance-meter.component';
import { ErrorBannerComponent } from '../shared/error-banner.component';
import { WindowStatusComponent } from '../shared/window-status.component';

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

  readonly balance = this.auth.pointBalance;
  readonly notice = signal<string | null>(null);

  readonly windows = signal<BiddingWindow[]>([
    {
      opensAt: '12 Mar 2026, 09:00',
      closesAt: '19 Mar 2026, 17:00',
      resolvedAt: null,
      state: 'open',
    },
  ]);

  readonly biddingWindow = computed<BiddingWindow | null>(() => this.windows()[0] ?? null);

  readonly bids = signal<Bid[]>([
    { id: 'b1', classId: 'c2', className: 'Negotiation & Influence', classCode: 'MGT-512', amount: 310, status: 'active', updatedAt: '14 Mar 2026, 11:42' },
    { id: 'b2', classId: 'c1', className: 'Advanced Corporate Valuation', classCode: 'FIN-641', amount: 240, status: 'active', updatedAt: '13 Mar 2026, 19:05' },
    { id: 'b3', classId: 'c4', className: 'Private Equity & Buyouts', classCode: 'FIN-702', amount: 180, status: 'active', updatedAt: '12 Mar 2026, 09:31' },
    { id: 'b4', classId: 'c6', className: 'Entrepreneurial Finance', classCode: 'ENT-611', amount: 90, status: 'cancelled', updatedAt: '12 Mar 2026, 09:12' },
  ]);

  readonly windowOpen = computed(() => this.biddingWindow()?.state === 'open');
  readonly active = computed(() => this.bids().filter((bid) => bid.status === 'active'));
  readonly committed = computed(() =>
    this.active().reduce((sum, bid) => sum + bid.amount, 0),
  );

  cancel(bid: Bid): void {
    this.bids.update((rows) =>
      rows.map((row) => (row.id === bid.id ? { ...row, status: 'cancelled' as const } : row)),
    );
    this.notice.set(`${bid.amount} points released from ${bid.className}.`);
  }
}
