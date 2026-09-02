import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { AdminApi } from '../core/api/admin.api';
import { ClassesApi } from '../core/api/classes.api';
import { WindowApi } from '../core/api/window.api';
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
  private readonly adminApi = inject(AdminApi);
  private readonly classesApi = inject(ClassesApi);
  private readonly windowApi = inject(WindowApi);

  private readonly queryParams = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  readonly confirmPhrase = RESET_PHRASE;
  readonly typed = signal('');
  readonly resetError = signal<string | null>(null);
  readonly notice = signal<string | null>(null);

  readonly windows = signal<BiddingWindow[]>([]);
  readonly biddingWindow = computed<BiddingWindow | null>(() => this.windows()[0] ?? null);

  readonly classes = signal<ClassSeat[]>([]);
  readonly students = signal<StudentAccount[]>([]);

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
    [...this.classes()]
      .sort((a, b) => b.bidCount / Math.max(1, b.seatCap) - a.bidCount / Math.max(1, a.seatCap))
      .slice(0, 4),
  );

  readonly resetModalOpen = computed(() => this.queryParams().get('modal') === 'confirm-reset');
  readonly canReset = computed(() => this.typed().trim() === RESET_PHRASE);

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    const [classes, students, window] = await Promise.all([
      this.classesApi.list(),
      this.adminApi.listStudents(),
      this.windowApi.get(),
    ]);
    this.classes.set(classes);
    this.students.set(students);
    this.windows.set([window]);
  }

  openReset(): void {
    this.typed.set('');
    this.resetError.set(null);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { modal: 'confirm-reset' },
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

  async confirmReset(): Promise<void> {
    if (!this.canReset()) {
      this.resetError.set(`Type ${RESET_PHRASE} exactly to confirm.`);
      return;
    }
    try {
      await this.adminApi.resetPoints();
      await this.load();
      this.notice.set(
        'All balances reset to 1000 points, active bids cancelled, and the round reopened. Historical results were kept.',
      );
      this.closeModal();
    } catch (error) {
      this.resetError.set(
        error instanceof Error ? error.message : 'Points could not be reset.',
      );
    }
  }
}
