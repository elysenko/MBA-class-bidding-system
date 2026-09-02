import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BiddingWindow, ResultRow } from '../core/models';
import { ErrorBannerComponent } from '../shared/error-banner.component';
import { WindowStatusComponent } from '../shared/window-status.component';

/** Per-class outcomes once the window has closed and seats were awarded. */
@Component({
  selector: 'app-my-results',
  standalone: true,
  imports: [RouterLink, WindowStatusComponent, ErrorBannerComponent],
  templateUrl: './my-results.component.html',
  styleUrls: ['./my-results.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyResultsComponent {
  readonly windows = signal<BiddingWindow[]>([
    {
      opensAt: '05 Jan 2026, 09:00',
      closesAt: '12 Jan 2026, 17:00',
      resolvedAt: '12 Jan 2026, 17:00',
      state: 'closed',
    },
  ]);

  readonly biddingWindow = computed<BiddingWindow | null>(() => this.windows()[0] ?? null);

  readonly results = signal<ResultRow[]>([
    { id: 'r1', classId: 'c2', className: 'Negotiation & Influence', classCode: 'MGT-512', amount: 310, outcome: 'won', clearingPrice: 285 },
    { id: 'r2', classId: 'c1', className: 'Advanced Corporate Valuation', classCode: 'FIN-641', amount: 240, outcome: 'won', clearingPrice: 190 },
    { id: 'r3', classId: 'c4', className: 'Private Equity & Buyouts', classCode: 'FIN-702', amount: 180, outcome: 'lost', clearingPrice: 355 },
    { id: 'r4', classId: 'c8', className: 'Global Macro & Policy', classCode: 'ECO-708', amount: 120, outcome: 'lost', clearingPrice: 145 },
  ]);

  readonly resolved = computed(() => !!this.biddingWindow()?.resolvedAt);
  readonly won = computed(() => this.results().filter((row) => row.outcome === 'won'));
  readonly lost = computed(() => this.results().filter((row) => row.outcome === 'lost'));
  readonly spent = computed(() =>
    this.results()
      .filter((row) => row.outcome === 'won' || row.outcome === 'lost')
      .reduce((sum, row) => sum + row.amount, 0),
  );
  readonly forfeited = computed(() =>
    this.lost().reduce((sum, row) => sum + row.amount, 0),
  );
}
