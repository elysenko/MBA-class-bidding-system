import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

/**
 * Dialog shell. On viewports <= 768px it docks to the bottom of the screen as a
 * sheet so the primary action stays inside thumb reach.
 */
@Component({
  selector: 'app-modal',
  standalone: true,
  templateUrl: './modal.component.html',
  styleUrls: ['./modal.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModalComponent {
  @Input({ required: true }) title = '';
  @Input() subtitle: string | null = null;
  @Input() testid = 'modal';
  @Output() closed = new EventEmitter<void>();
}
