import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '../core/auth.service';
import { BiddingWindow, ClassSeat } from '../core/models';
import { BalanceMeterComponent } from '../shared/balance-meter.component';
import { ErrorBannerComponent } from '../shared/error-banner.component';
import { ModalComponent } from '../shared/modal.component';
import { WindowStatusComponent } from '../shared/window-status.component';
import { BidFormComponent } from './bid-form.component';

/** Single class view. The bid dialog is addressable at ?modal=bid. */
@Component({
  selector: 'app-class-detail',
  standalone: true,
  imports: [
    RouterLink,
    ModalComponent,
    BidFormComponent,
    BalanceMeterComponent,
    ErrorBannerComponent,
    WindowStatusComponent,
  ],
  templateUrl: './class-detail.component.html',
  styleUrls: ['./class-detail.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClassDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  private readonly params = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });
  private readonly queryParams = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

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

  readonly current = computed(
    () => this.classes().find((row) => row.id === this.params().get('id')) ?? null,
  );
  readonly windowOpen = computed(() => this.biddingWindow()?.state === 'open');
  readonly bidModalOpen = computed(() => this.queryParams().get('modal') === 'bid');

  readonly committed = computed(() =>
    this.classes()
      .filter((row) => row.myBidStatus === 'active')
      .reduce((sum, row) => sum + (row.myBidAmount ?? 0), 0),
  );

  /** Headroom excludes this class's own bid, which is being replaced. */
  readonly availableForThisClass = computed(
    () => this.balance() - this.committed() + (this.current()?.myBidAmount ?? 0),
  );

  openBid(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { modal: 'bid' },
      queryParamsHandling: 'merge',
    });
  }

  closeModal(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { modal: null },
      queryParamsHandling: 'merge',
    });
  }

  placeBid(amount: number): void {
    const id = this.current()?.id;
    this.classes.update((rows) =>
      rows.map((row) =>
        row.id === id ? { ...row, myBidAmount: amount, myBidStatus: 'active' as const } : row,
      ),
    );
    this.notice.set(`Bid of ${amount} points recorded for ${this.current()?.name}.`);
    this.closeModal();
  }

  cancelBid(): void {
    const id = this.current()?.id;
    this.classes.update((rows) =>
      rows.map((row) => (row.id === id ? { ...row, myBidAmount: null, myBidStatus: null } : row)),
    );
    this.notice.set('Bid cancelled. Those points are available to commit again.');
    this.closeModal();
  }
}
