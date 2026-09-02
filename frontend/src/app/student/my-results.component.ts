import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ResultsApi } from '../core/api/results.api';
import { WindowApi } from '../core/api/window.api';
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
  private readonly resultsApi = inject(ResultsApi);
  private readonly windowApi = inject(WindowApi);

  readonly windows = signal<BiddingWindow[]>([]);
  readonly biddingWindow = computed<BiddingWindow | null>(() => this.windows()[0] ?? null);

  readonly results = signal<ResultRow[]>([]);

  readonly resolved = computed(() => !!this.biddingWindow()?.resolvedAtIso);
  readonly won = computed(() => this.results().filter((row) => row.outcome === 'won'));
  readonly lost = computed(() => this.results().filter((row) => row.outcome === 'lost'));
  readonly spent = computed(() =>
    this.results()
      .filter((row) => row.outcome === 'won' || row.outcome === 'lost')
      .reduce((sum, row) => sum + row.amount, 0),
  );
  readonly forfeited = computed(() => this.lost().reduce((sum, row) => sum + row.amount, 0));

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    const [results, window] = await Promise.all([
      this.resultsApi.mine(),
      this.windowApi.get(),
    ]);
    this.results.set(results);
    this.windows.set([window]);
  }
}
