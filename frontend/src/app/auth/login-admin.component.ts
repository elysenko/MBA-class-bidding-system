import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { ErrorBannerComponent } from '../shared/error-banner.component';

/** Administrators sign in with username + password. */
@Component({
  selector: 'app-login-admin',
  standalone: true,
  imports: [FormsModule, RouterLink, ErrorBannerComponent],
  templateUrl: './login-admin.component.html',
  styleUrls: ['./login-admin.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginAdminComponent {
  private readonly auth = inject(AuthService);

  readonly username = signal('');
  readonly password = signal('');
  readonly error = signal<string | null>(null);

  async submit(): Promise<void> {
    this.error.set(await this.auth.adminLogin(this.username(), this.password()));
  }

  /** Signs in as the seeded root administrator. */
  async demo(): Promise<void> {
    this.error.set(await this.auth.demoLogin('admin'));
  }
}
