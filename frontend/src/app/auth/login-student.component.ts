import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { ErrorBannerComponent } from '../shared/error-banner.component';

/** Students sign in with the one-time token emailed to them — no password. */
@Component({
  selector: 'app-login-student',
  standalone: true,
  imports: [FormsModule, RouterLink, ErrorBannerComponent],
  templateUrl: './login-student.component.html',
  styleUrls: ['./login-student.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginStudentComponent {
  private readonly auth = inject(AuthService);

  readonly token = signal('');
  readonly error = signal<string | null>(null);
  readonly requested = signal(false);

  async submit(): Promise<void> {
    this.error.set(await this.auth.studentLogin(this.token()));
  }

  /**
   * Links are re-issued by an administrator (there is no self-service email
   * step), so this only explains what to expect.
   */
  requestLink(): void {
    this.requested.set(true);
  }

  /** Signs in as the first seeded student account. */
  async demo(): Promise<void> {
    this.error.set(await this.auth.demoLogin('student'));
  }
}
