import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ErrorBannerComponent } from '../shared/error-banner.component';

/**
 * Bid entry. Client-side guards mirror the server rules (amount > 0,
 * amount <= available) so the reviewer sees the same messages the API returns.
 */
@Component({
  selector: 'app-bid-form',
  standalone: true,
  imports: [FormsModule, ErrorBannerComponent],
  templateUrl: './bid-form.component.html',
  styleUrls: ['./bid-form.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BidFormComponent {
  private readonly availableValue = signal(1000);

  @Input({ required: true }) className = '';
  @Input({ required: true }) set available(value: number) {
    this.availableValue.set(value);
  }
  @Input() currentAmount: number | null = null;
  @Input() windowOpen = true;

  @Output() submitted = new EventEmitter<number>();
  @Output() cancelledBid = new EventEmitter<void>();

  readonly amount = signal<number | null>(null);
  readonly error = signal<string | null>(null);

  readonly headroom = computed(() => this.availableValue());
  readonly quickAmounts = computed(() => {
    const cap = this.headroom();
    return [25, 50, 100, 200, 400].filter((value) => value <= cap);
  });

  /**
   * Lets the host surface a server rejection (closed window, over balance) in
   * the same place the client-side guards report, verbatim.
   */
  showServerError(message: string): void {
    this.error.set(message);
  }

  setAmount(value: number): void {
    this.amount.set(value);
  }

  submit(): void {
    const value = Number(this.amount() ?? this.currentAmount ?? 0);
    if (!Number.isFinite(value) || value <= 0) {
      this.error.set('Bid amount must be greater than 0.');
      return;
    }
    if (value > this.headroom()) {
      this.error.set(
        `Bid exceeds your available balance. You have ${this.headroom()} points left to commit.`,
      );
      return;
    }
    this.error.set(null);
    this.submitted.emit(value);
  }
}
