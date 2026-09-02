import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { ClassResultRow, ClassSummary } from '../core/models';
import { ErrorBannerComponent } from '../shared/error-banner.component';

/** Every bid on one class with its outcome, highest first. */
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
  private readonly params = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });

  readonly classId = computed(() => this.params().get('id') ?? '');

  readonly summaries = signal<ClassSummary[]>([
    {
      id: 'c4',
      name: 'Private Equity & Buyouts',
      code: 'FIN-702',
      seatCap: 6,
      resolvedAt: '12 Jan 2026, 17:00',
    },
  ]);

  readonly summary = computed<ClassSummary | null>(() => this.summaries()[0] ?? null);
  readonly className = computed(() => this.summary()?.name ?? 'Class');
  readonly classCode = computed(() => this.summary()?.code ?? '');
  readonly seatCap = computed(() => this.summary()?.seatCap ?? 0);
  readonly resolvedAt = computed(() => this.summary()?.resolvedAt ?? null);

  readonly rows = signal<ClassResultRow[]>([
    { id: 'x1', studentName: 'Amara Nwosu', studentEmail: 'amara.nwosu@mba.example.edu', amount: 420, outcome: 'won', rank: 1 },
    { id: 'x2', studentName: 'Tomas Delacroix', studentEmail: 'tomas.delacroix@mba.example.edu', amount: 398, outcome: 'won', rank: 2 },
    { id: 'x3', studentName: 'Wen Li Zhang', studentEmail: 'wenli.zhang@mba.example.edu', amount: 375, outcome: 'won', rank: 3 },
    { id: 'x4', studentName: 'Jonas Lindberg', studentEmail: 'jonas.lindberg@mba.example.edu', amount: 360, outcome: 'won', rank: 4 },
    { id: 'x5', studentName: 'Fatima Al-Rashid', studentEmail: 'fatima.alrashid@mba.example.edu', amount: 355, outcome: 'won', rank: 5 },
    { id: 'x6', studentName: 'Hugo Bernal', studentEmail: 'hugo.bernal@mba.example.edu', amount: 355, outcome: 'won', rank: 6 },
    { id: 'x7', studentName: 'Sofia Karlsson', studentEmail: 'sofia.karlsson@mba.example.edu', amount: 355, outcome: 'lost', rank: 7 },
    { id: 'x8', studentName: 'Priya Raghunathan', studentEmail: 'priya.raghunathan@mba.example.edu', amount: 180, outcome: 'lost', rank: 8 },
    { id: 'x9', studentName: 'Marcus Whitfield', studentEmail: 'marcus.whitfield@mba.example.edu', amount: 95, outcome: 'lost', rank: 9 },
  ]);

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
    this.rows().reduce((sum, row) => sum + row.amount, 0),
  );
}
