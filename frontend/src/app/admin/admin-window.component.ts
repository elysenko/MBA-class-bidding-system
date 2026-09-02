import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { WindowApi } from '../core/api/window.api';
import { toLocalInputValue } from '../core/format';
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
  private readonly windowApi = inject(WindowApi);

  readonly formError = signal<string | null>(null);
  readonly saved = signal(false);
  readonly loading = signal(true);

  readonly opensAt = signal('');
  readonly closesAt = signal('');

  readonly current = signal<BiddingWindow | null>(null);

  /** Mirrors the server's CHECK (closes_at > opens_at). */
  readonly rangeValid = computed(() => {
    const opens = Date.parse(this.opensAt());
    const closes = Date.parse(this.closesAt());
    return Number.isFinite(opens) && Number.isFinite(closes) && closes > opens;
  });

  /** A future close time clears resolution, so saving starts another round. */
  readonly reopensRound = computed(() => this.current()?.resolvedAtIso != null);

  constructor() {
    void this.load();
  }

  private apply(bidding: BiddingWindow): void {
    this.current.set(bidding);
    this.opensAt.set(toLocalInputValue(bidding.opensAtIso));
    this.closesAt.set(toLocalInputValue(bidding.closesAtIso));
  }

  private async load(): Promise<void> {
    try {
      this.apply(await this.windowApi.get());
    } catch (error) {
      this.formError.set(
        error instanceof Error ? error.message : 'The bidding window could not be loaded.',
      );
    } finally {
      this.loading.set(false);
    }
  }

  edit(field: 'opensAt' | 'closesAt', value: string): void {
    this.saved.set(false);
    this[field].set(value);
  }

  async save(): Promise<void> {
    if (!this.rangeValid()) {
      this.formError.set('The close time must be later than the open time.');
      this.saved.set(false);
      return;
    }
    try {
      this.apply(await this.windowApi.save(this.opensAt(), this.closesAt()));
      this.formError.set(null);
      this.saved.set(true);
    } catch (error) {
      this.saved.set(false);
      this.formError.set(
        error instanceof Error ? error.message : 'The bidding window could not be saved.',
      );
    }
  }
}
