import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { ErrorBannerComponent } from '../shared/error-banner.component';

/**
 * Public signup is gated behind ALLOW_PUBLIC_SIGNUP and is off by default —
 * accounts are provisioned by the root administrator. Both states are shown so
 * the disabled copy and the working form can each be reviewed.
 */
@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [FormsModule, RouterLink, ErrorBannerComponent],
  templateUrl: './signup.component.html',
  styleUrls: ['./signup.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SignupComponent {
  private readonly auth = inject(AuthService);

  /** Mirrors the backend flag; false renders the "disabled" state. */
  readonly signupEnabled = signal(false);

  readonly name = signal('');
  readonly email = signal('');
  readonly error = signal<string | null>(null);

  submit(): void {
    this.error.set(this.auth.signup(this.name(), this.email()));
  }

  toggleFlag(): void {
    this.signupEnabled.update((value) => !value);
  }
}
