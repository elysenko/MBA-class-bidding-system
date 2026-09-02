import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { ResultsApi } from '../core/api/results.api';
import { ClassResultRow, ClassSummary } from '../core/models';
import { ErrorBannerComponent } from '../shared/error-banner.component';
import { formatDateTime } from '../core/format';

/** Every bid on one class with its outcome, winners first. */
@Component({
  selector: 'app-admin-class-results',
  standalone: true,
  imports: [RouterLink, ErrorBannerComponent],
  templateUrl: './admin-class-results.component.html',
  styleUrls: ['./admin-class-results.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminClassResultsComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly resultsApi = inject(ResultsApi);

  private readonly params = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });

  readonly classId = computed(() => this.params().get('id') ?? '');

  readonly summaries = signal<ClassSummary[]>([]);

  readonly summary = computed<ClassSummary | null>(() => this.summaries()[0] ?? null);
  readonly className = computed(() => this.summary()?.name ?? 'Class');
  readonly classCode = computed(() => this.summary()?.code ?? '');
  readonly seatCap = computed(() => this.summary()?.seatCap ?? 0);
  readonly resolvedAt = computed(() =>
    this.summary()?.resolvedAt ? formatDateTime(this.summary()!.resolvedAt) : null,
  );

  readonly rows = signal<ClassResultRow[]>([]);

  readonly winners = computed(() => this.rows().filter((row) => row.outcome === 'won'));
  readonly clearingPrice = computed(() => {
    const won = this.winners();
    return won.length ? won[won.length - 1].amount : 0;
  });
  /** Ties at the clearing price were split by the random tie-break. */
  readonly tiedAtCutoff = computed(
    () => this.rows().filter((row) => row.amount === this.clearingPrice()).length > 1,
  );
  readonly pointsCollected = computed(() =>
    this.rows()
      .filter((row) => row.outcome !== 'active')
      .reduce((sum, row) => sum + row.amount, 0),
  );

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    const id = this.classId();
    if (!id) return;
    const { summary, rows } = await this.resultsApi.forClass(id);
    this.summaries.set([summary]);
    this.rows.set(rows);
  }
}
