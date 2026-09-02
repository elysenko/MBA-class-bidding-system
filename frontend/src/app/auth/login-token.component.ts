import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { ErrorBannerComponent } from '../shared/error-banner.component';

/** Landing page for the emailed link: reads ?token= and signs the student in. */
@Component({
  selector: 'app-login-token',
  standalone: true,
  imports: [RouterLink, ErrorBannerComponent],
  templateUrl: './login-token.component.html',
  styleUrls: ['./login-token.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginTokenComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly error = signal<string | null>(null);
  readonly checking = signal(true);

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token') ?? '';
    this.checking.set(false);
    if (!token) {
      this.error.set(
        'This sign-in link is missing its token. Ask an administrator to resend your invitation.',
      );
      return;
    }
    this.error.set(this.auth.studentLogin(token));
  }

  retry(): void {
    this.router.navigate(['/login']);
  }
}
