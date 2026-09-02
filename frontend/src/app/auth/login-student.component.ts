import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
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
  private readonly router = inject(Router);

  readonly token = signal('');
  readonly error = signal<string | null>(null);
  readonly requested = signal(false);

  submit(): void {
    this.error.set(this.auth.studentLogin(this.token()));
  }

  requestLink(): void {
    this.requested.set(true);
  }

  demo(): void {
    this.auth.demoLogin('student');
    this.router.navigate(['/classes']);
  }
}
