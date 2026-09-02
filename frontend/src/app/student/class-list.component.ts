import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '../core/auth.service';
import { BiddingWindow, ClassSeat } from '../core/models';
import { BalanceMeterComponent } from '../shared/balance-meter.component';
import { WindowStatusComponent } from '../shared/window-status.component';

/** Catalogue of every class a student may bid on. Search + sort live in the URL. */
@Component({
  selector: 'app-class-list',
  standalone: true,
  imports: [FormsModule, RouterLink, BalanceMeterComponent, WindowStatusComponent],
  templateUrl: './class-list.component.html',
  styleUrls: ['./class-list.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClassListComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  private readonly params = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  readonly loading = signal(false);
  readonly balance = this.auth.pointBalance;

  readonly windows = signal<BiddingWindow[]>([
    {
      opensAt: '12 Mar 2026, 09:00',
      closesAt: '19 Mar 2026, 17:00',
      resolvedAt: null,
      state: 'open',
    },
  ]);

  readonly biddingWindow = computed<BiddingWindow | null>(() => this.windows()[0] ?? null);
  readonly windowOpen = computed(() => this.biddingWindow()?.state === 'open');

  readonly classes = signal<ClassSeat[]>([
    { id: 'c1', name: 'Advanced Corporate Valuation', code: 'FIN-641', faculty: 'Prof. E. Marchetti', term: 'Spring 2026', seatCap: 30, seatsTaken: null, bidCount: 46, myBidAmount: 240, myBidStatus: 'active' },
    { id: 'c2', name: 'Negotiation & Influence', code: 'MGT-512', faculty: 'Prof. D. Okonjo', term: 'Spring 2026', seatCap: 24, seatsTaken: null, bidCount: 61, myBidAmount: 310, myBidStatus: 'active' },
    { id: 'c3', name: 'Data-Driven Marketing Strategy', code: 'MKT-528', faculty: 'Prof. L. Hartmann', term: 'Spring 2026', seatCap: 40, seatsTaken: null, bidCount: 33, myBidAmount: null, myBidStatus: null },
    { id: 'c4', name: 'Private Equity & Buyouts', code: 'FIN-702', faculty: 'Prof. S. Vandermeer', term: 'Spring 2026', seatCap: 18, seatsTaken: null, bidCount: 72, myBidAmount: 180, myBidStatus: 'active' },
    { id: 'c5', name: 'Operations & Supply Chain Analytics', code: 'OPS-544', faculty: 'Prof. R. Nakamura', term: 'Spring 2026', seatCap: 35, seatsTaken: null, bidCount: 21, myBidAmount: null, myBidStatus: null },
    { id: 'c6', name: 'Entrepreneurial Finance', code: 'ENT-611', faculty: 'Prof. A. Bekele', term: 'Spring 2026', seatCap: 30, seatsTaken: null, bidCount: 38, myBidAmount: null, myBidStatus: null },
    { id: 'c7', name: 'Behavioural Economics for Managers', code: 'ECO-533', faculty: 'Prof. C. Lindqvist', term: 'Spring 2026', seatCap: 45, seatsTaken: null, bidCount: 12, myBidAmount: null, myBidStatus: null },
    { id: 'c8', name: 'Global Macro & Policy', code: 'ECO-708', faculty: 'Prof. M. Alvarez', term: 'Spring 2026', seatCap: 30, seatsTaken: null, bidCount: 29, myBidAmount: null, myBidStatus: null },
  ]);

  readonly query = computed(() => this.params().get('q') ?? '');
  readonly sort = computed(() => this.params().get('sort') ?? 'name');

  readonly committed = computed(() =>
    this.classes()
      .filter((c) => c.myBidStatus === 'active')
      .reduce((sum, c) => sum + (c.myBidAmount ?? 0), 0),
  );

  readonly visible = computed(() => {
    const q = this.query().trim().toLowerCase();
    const rows = this.classes().filter(
      (c) =>
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        c.faculty.toLowerCase().includes(q),
    );
    const sorted = [...rows];
    switch (this.sort()) {
      case 'seats':
        sorted.sort((a, b) => b.seatCap - a.seatCap);
        break;
      case 'demand':
        sorted.sort((a, b) => b.bidCount / b.seatCap - a.bidCount / a.seatCap);
        break;
      case 'my-bid':
        sorted.sort((a, b) => (b.myBidAmount ?? -1) - (a.myBidAmount ?? -1));
        break;
      default:
        sorted.sort((a, b) => a.name.localeCompare(b.name));
    }
    return sorted;
  });

  setQuery(value: string): void {
    this.patch({ q: value || null });
  }

  setSort(value: string): void {
    this.patch({ sort: value });
  }

  private patch(queryParams: Record<string, string | null>): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
    });
  }

  pressure(row: ClassSeat): string {
    const ratio = row.bidCount / row.seatCap;
    if (ratio >= 2) return 'Very high demand';
    if (ratio >= 1) return 'Oversubscribed';
    return 'Seats likely available';
  }

  pressureTone(row: ClassSeat): string {
    const ratio = row.bidCount / row.seatCap;
    if (ratio >= 2) return 'badge-danger';
    if (ratio >= 1) return 'badge-warning';
    return 'badge-success';
  }
}
