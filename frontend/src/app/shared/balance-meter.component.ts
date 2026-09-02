import { ChangeDetectionStrategy, Component, Input, computed, signal } from '@angular/core';

/** Shows the 1000-point allowance split into committed vs available. */
@Component({
  selector: 'app-balance-meter',
  standalone: true,
  templateUrl: './balance-meter.component.html',
  styleUrls: ['./balance-meter.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BalanceMeterComponent {
  private readonly balanceValue = signal(1000);
  private readonly committedValue = signal(0);

  @Input({ required: true }) set balance(value: number) {
    this.balanceValue.set(value);
  }
  @Input({ required: true }) set committed(value: number) {
    this.committedValue.set(value);
  }
  @Input() compact = false;

  readonly total = computed(() => this.balanceValue());
  readonly spent = computed(() => this.committedValue());
  readonly available = computed(() => Math.max(0, this.total() - this.spent()));
  readonly percent = computed(() =>
    this.total() > 0 ? Math.min(100, Math.round((this.spent() / this.total()) * 100)) : 0,
  );
}
