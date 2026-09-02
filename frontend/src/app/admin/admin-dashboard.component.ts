import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { BiddingWindow, ClassSeat, StudentAccount } from '../core/models';
import { ErrorBannerComponent } from '../shared/error-banner.component';
import { ModalComponent } from '../shared/modal.component';
import { WindowStatusComponent } from '../shared/window-status.component';

const RESET_PHRASE = 'RESET POINTS';

/** Registrar overview: window state, round counts, and the destructive reset. */
@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [FormsModule, RouterLink, ModalComponent, WindowStatusComponent, ErrorBannerComponent],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminDashboardComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly queryParams = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  readonly confirmPhrase = RESET_PHRASE;
  readonly typed = signal('');
  readonly resetError = signal<string | null>(null);
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
    { id: 'c1', name: 'Advanced Corporate Valuation', code: 'FIN-641', faculty: 'Prof. E. Marchetti', term: 'Spring 2026', seatCap: 30, seatsTaken: null, bidCount: 46, myBidAmount: null, myBidStatus: null },
    { id: 'c2', name: 'Negotiation & Influence', code: 'MGT-512', faculty: 'Prof. D. Okonjo', term: 'Spring 2026', seatCap: 24, seatsTaken: null, bidCount: 61, myBidAmount: null, myBidStatus: null },
    { id: 'c4', name: 'Private Equity & Buyouts', code: 'FIN-702', faculty: 'Prof. S. Vandermeer', term: 'Spring 2026', seatCap: 18, seatsTaken: null, bidCount: 72, myBidAmount: null, myBidStatus: null },
    { id: 'c3', name: 'Data-Driven Marketing Strategy', code: 'MKT-528', faculty: 'Prof. L. Hartmann', term: 'Spring 2026', seatCap: 40, seatsTaken: null, bidCount: 33, myBidAmount: null, myBidStatus: null },
  ]);

  readonly students = signal<StudentAccount[]>([
    { id: 's1', name: 'Priya Raghunathan', email: 'priya.raghunathan@mba.example.edu', pointBalance: 1000, activeBids: 3, tokenState: 'used', emailDelivered: true, createdAt: '02 Mar 2026' },
    { id: 's2', name: 'Tomas Delacroix', email: 'tomas.delacroix@mba.example.edu', pointBalance: 1000, activeBids: 2, tokenState: 'used', emailDelivered: true, createdAt: '02 Mar 2026' },
    { id: 's3', name: 'Amara Nwosu', email: 'amara.nwosu@mba.example.edu', pointBalance: 1000, activeBids: 4, tokenState: 'pending', emailDelivered: false, createdAt: '04 Mar 2026' },
    { id: 's4', name: 'Jonas Lindberg', email: 'jonas.lindberg@mba.example.edu', pointBalance: 1000, activeBids: 0, tokenState: 'expired', emailDelivered: true, createdAt: '28 Feb 2026' },
  ]);

  readonly totalSeats = computed(() =>
    this.classes().reduce((sum, row) => sum + row.seatCap, 0),
  );
  readonly totalBids = computed(() =>
    this.classes().reduce((sum, row) => sum + row.bidCount, 0),
  );
  readonly studentsBidding = computed(
    () => this.students().filter((row) => row.activeBids > 0).length,
  );
  readonly undelivered = computed(
    () => this.students().filter((row) => !row.emailDelivered).length,
  );
  readonly hottest = computed(() =>
    [...this.classes()].sort((a, b) => b.bidCount / b.seatCap - a.bidCount / a.seatCap).slice(0, 4),
  );

  readonly resetModalOpen = computed(() => this.queryParams().get('modal') === 'confirm-reset');
  readonly canReset = computed(() => this.typed().trim() === RESET_PHRASE);

  openReset(): void {
    this.typed.set('');
    this.resetError.set(null);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { modal: 'confirm-reset' },
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

  confirmReset(): void {
    if (!this.canReset()) {
      this.resetError.set(`Type ${RESET_PHRASE} exactly to confirm.`);
      return;
    }
    this.students.update((rows) =>
      rows.map((row) => ({ ...row, pointBalance: 1000, activeBids: 0 })),
    );
    this.windows.update((rows) => rows.map((row) => ({ ...row, resolvedAt: null })));
    this.notice.set(
      'All balances reset to 1000 points, active bids cancelled, and the round reopened. Historical results were kept.',
    );
    this.closeModal();
  }
}
