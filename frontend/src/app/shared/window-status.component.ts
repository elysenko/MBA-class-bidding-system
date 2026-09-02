import { ChangeDetectionStrategy, Component, Input, computed, signal } from '@angular/core';
import { BiddingWindow, WindowState } from '../core/models';
import { countdownTo } from '../core/format';

/** Renders the single global bidding window as pending | open | closed. */
@Component({
  selector: 'app-window-status',
  standalone: true,
  templateUrl: './window-status.component.html',
  styleUrls: ['./window-status.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WindowStatusComponent {
  private readonly windowValue = signal<BiddingWindow | null>(null);

  @Input({ required: true }) set biddingWindow(value: BiddingWindow | null) {
    this.windowValue.set(value);
  }
  @Input() dense = false;

  readonly current = computed(() => this.windowValue());
  readonly state = computed<WindowState>(() => this.current()?.state ?? 'pending');

  readonly headline = computed(() => {
    switch (this.state()) {
      case 'open':
        return 'Bidding is open';
      case 'closed':
        return 'Bidding is closed';
      default:
        return 'Bidding has not opened yet';
    }
  });

  readonly detail = computed(() => {
    const w = this.current();
    if (!w || !w.closesAtIso) {
      return 'No bidding window has been configured.';
    }
    switch (this.state()) {
      case 'open':
        return `Closes ${w.closesAt} — ${this.countdown()} remaining`;
      case 'closed':
        return w.resolvedAt
          ? `Closed ${w.closesAt} · seats awarded ${w.resolvedAt}`
          : `Closed ${w.closesAt} · awaiting resolution`;
      default:
        return `Opens ${w.opensAt}`;
    }
  });

  /** Time left until the real close instant. */
  readonly countdown = computed(() => countdownTo(this.current()?.closesAtIso ?? null));

  readonly tone = computed(
    () => ({ open: 'open', closed: 'closed', pending: 'pending' })[this.state()],
  );
}
