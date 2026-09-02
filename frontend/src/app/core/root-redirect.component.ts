import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';

/** `/` sends each identity to its own home screen. */
@Component({
  selector: 'app-root-redirect',
  standalone: true,
  template: `<p class="redirecting" data-testid="root-redirect">Loading your workspace…</p>`,
  styles: [
    `
      .redirecting {
        min-height: 100svh;
        display: grid;
        place-items: center;
        color: var(--color-text-subtle);
        font-size: var(--text-sm);
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RootRedirectComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  ngOnInit(): void {
    if (this.auth.isAdmin()) {
      this.router.navigate(['/admin']);
      return;
    }
    this.auth.ensureSession('student');
    this.router.navigate(['/classes']);
  }
}
