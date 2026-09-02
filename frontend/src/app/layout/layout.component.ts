import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { BiddingWindow } from '../core/models';
import { WindowStatusComponent } from '../shared/window-status.component';

interface NavItem {
  label: string;
  short: string;
  path: string;
  glyph: string;
  exact: boolean;
}

const STUDENT_NAV: NavItem[] = [
  { label: 'Classes', short: 'Classes', path: '/classes', glyph: '▤', exact: false },
  { label: 'My bids', short: 'Bids', path: '/my-bids', glyph: '◈', exact: true },
  { label: 'Results', short: 'Results', path: '/results', glyph: '★', exact: true },
];

const ADMIN_NAV: NavItem[] = [
  { label: 'Dashboard', short: 'Home', path: '/admin', glyph: '⬒', exact: true },
  { label: 'Classes', short: 'Classes', path: '/admin/classes', glyph: '▤', exact: false },
  { label: 'Accounts', short: 'People', path: '/admin/accounts', glyph: '☺', exact: false },
  { label: 'Window', short: 'Window', path: '/admin/window', glyph: '◷', exact: true },
  { label: 'Settings', short: 'Setup', path: '/admin/settings', glyph: '⚙', exact: true },
];

/** Application shell: role-aware sidebar on desktop, bottom tab bar on mobile. */
@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, WindowStatusComponent],
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LayoutComponent {
  private readonly auth = inject(AuthService);

  readonly identity = this.auth.identity;
  readonly isAdmin = this.auth.isAdmin;
  readonly nav = computed(() => (this.isAdmin() ? ADMIN_NAV : STUDENT_NAV));
  readonly initials = computed(() =>
    (this.identity()?.name ?? '?')
      .split(' ')
      .map((part) => part.charAt(0))
      .slice(0, 2)
      .join('')
      .toUpperCase(),
  );

  readonly windows = signal<BiddingWindow[]>([
    {
      opensAt: '12 Mar 2026, 09:00',
      closesAt: '19 Mar 2026, 17:00',
      resolvedAt: null,
      state: 'open',
    },
  ]);

  readonly biddingWindow = computed<BiddingWindow | null>(() => this.windows()[0] ?? null);

  logout(): void {
    this.auth.logout();
  }
}
