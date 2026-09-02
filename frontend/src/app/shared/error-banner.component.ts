import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

export type BannerTone = 'error' | 'warning' | 'info' | 'success';

@Component({
  selector: 'app-error-banner',
  standalone: true,
  templateUrl: './error-banner.component.html',
  styleUrls: ['./error-banner.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErrorBannerComponent {
  @Input({ required: true }) message = '';
  @Input() tone: BannerTone = 'error';
  @Input() title: string | null = null;
  @Input() testid = 'banner';

  get glyph(): string {
    return { error: '!', warning: '!', info: 'i', success: '✓' }[this.tone];
  }
}
