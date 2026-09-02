import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '../core/auth.service';
import { ClassesApi } from '../core/api/classes.api';
import { WindowApi } from '../core/api/window.api';
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
  private readonly classesApi = inject(ClassesApi);
  private readonly windowApi = inject(WindowApi);

  private readonly params = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  readonly loading = signal(true);
  readonly balance = this.auth.pointBalance;

  readonly windows = signal<BiddingWindow[]>([]);
  readonly biddingWindow = computed<BiddingWindow | null>(() => this.windows()[0] ?? null);
  readonly windowOpen = computed(() => this.biddingWindow()?.state === 'open');

  readonly classes = signal<ClassSeat[]>([]);

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

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      const [classes, window] = await Promise.all([
        this.classesApi.list(),
        this.windowApi.get(),
      ]);
      this.classes.set(classes);
      this.windows.set([window]);
      await this.auth.refresh();
    } catch {
      this.classes.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  setQuery(value: string): void {
    this.patch({ q: value || null });
  }

  setSort(value: string): void {
    this.patch({ sort: value });
  }

  private patch(queryParams: Record<string, string | null>): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
    });
  }

  pressure(row: ClassSeat): string {
    const ratio = row.bidCount / Math.max(1, row.seatCap);
    if (ratio >= 2) return 'Very high demand';
    if (ratio >= 1) return 'Oversubscribed';
    return 'Seats likely available';
  }

  pressureTone(row: ClassSeat): string {
    const ratio = row.bidCount / Math.max(1, row.seatCap);
    if (ratio >= 2) return 'badge-danger';
    if (ratio >= 1) return 'badge-warning';
    return 'badge-success';
  }
}
