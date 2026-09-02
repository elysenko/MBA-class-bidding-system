import {
  ChangeDetectionStrategy,
  Component,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '../core/auth.service';
import { ClassesApi } from '../core/api/classes.api';
import { WindowApi } from '../core/api/window.api';
import { BidsApi } from '../core/api/bids.api';
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
  /** Present only while the bid dialog is open; used to echo server errors. */
  @ViewChild(BidFormComponent) private bidForm?: BidFormComponent;

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly classesApi = inject(ClassesApi);
  private readonly windowApi = inject(WindowApi);
  private readonly bidsApi = inject(BidsApi);

  private readonly params = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });
  private readonly queryParams = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  readonly balance = this.auth.pointBalance;
  readonly notice = signal<string | null>(null);
  readonly loaded = signal(false);

  readonly windows = signal<BiddingWindow[]>([]);
  readonly biddingWindow = computed<BiddingWindow | null>(() => this.windows()[0] ?? null);

  readonly classes = signal<ClassSeat[]>([]);

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

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      const [classes, window] = await Promise.all([
        this.classesApi.list(),
        this.windowApi.get(),
      ]);
      this.classes.set(classes);
      this.windows.set([window]);
      await this.auth.refresh();
    } finally {
      this.loaded.set(true);
    }
  }

  openBid(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { modal: 'bid' },
      queryParamsHandling: 'merge',
    });
  }

  closeModal(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { modal: null },
      queryParamsHandling: 'merge',
    });
  }

  async placeBid(amount: number): Promise<void> {
    const row = this.current();
    if (!row) return;
    try {
      const response = await this.bidsApi.place(row.id, amount);
      this.auth.setBalance(response.balance.pointBalance);
      this.notice.set(`Bid of ${amount} points recorded for ${row.name}.`);
      this.closeModal();
      await this.load();
    } catch (error) {
      this.notice.set(null);
      this.bidForm?.showServerError(
        error instanceof Error ? error.message : 'That bid could not be saved.',
      );
    }
  }

  async cancelBid(): Promise<void> {
    const row = this.current();
    if (!row?.myBidId) return;
    try {
      const response = await this.bidsApi.cancel(row.myBidId);
      this.auth.setBalance(response.balance.pointBalance);
      this.notice.set('Bid cancelled. Those points are available to commit again.');
      this.closeModal();
      await this.load();
    } catch (error) {
      this.notice.set(null);
      this.bidForm?.showServerError(
        error instanceof Error ? error.message : 'That bid could not be cancelled.',
      );
    }
  }
}
