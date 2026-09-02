import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { BiddingWindow } from '../core/models';
import { ErrorBannerComponent } from '../shared/error-banner.component';
import { WindowStatusComponent } from '../shared/window-status.component';

/** Editor for the single global bidding window shared by every class. */
@Component({
  selector: 'app-admin-window',
  standalone: true,
  imports: [FormsModule, RouterLink, WindowStatusComponent, ErrorBannerComponent],
  templateUrl: './admin-window.component.html',
  styleUrls: ['./admin-window.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminWindowComponent {
  readonly formError = signal<string | null>(null);
  readonly saved = signal(false);

  readonly opensAt = signal('2026-03-12T09:00');
  readonly closesAt = signal('2026-03-19T17:00');

  readonly windows = signal<BiddingWindow[]>([
    {
      opensAt: '12 Mar 2026, 09:00',
      closesAt: '19 Mar 2026, 17:00',
      resolvedAt: null,
      state: 'open',
    },
  ]);

  readonly current = computed(() => this.windows()[0] ?? null);

  /** Mirrors the server's CHECK (closes_at > opens_at). */
  readonly rangeValid = computed(() => {
    const opens = Date.parse(this.opensAt());
    const closes = Date.parse(this.closesAt());
    return Number.isFinite(opens) && Number.isFinite(closes) && closes > opens;
  });

  readonly reopensRound = computed(() => this.current()?.resolvedAt !== null);

  private format(value: string): string {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime())
      ? value
      : parsed.toLocaleString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
  }

  save(): void {
    if (!this.rangeValid()) {
      this.formError.set('The close time must be later than the open time.');
      this.saved.set(false);
      return;
    }
    this.formError.set(null);
    this.windows.update((rows) => [
      {
        opensAt: this.format(this.opensAt()),
        closesAt: this.format(this.closesAt()),
        resolvedAt: null,
        state: 'open',
      },
      ...rows.slice(1),
    ]);
    this.saved.set(true);
  }
}
