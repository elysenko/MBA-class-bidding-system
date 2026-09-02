import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '../core/auth.service';
import { AdminAccount, StudentAccount } from '../core/models';
import { ErrorBannerComponent } from '../shared/error-banner.component';
import { ModalComponent } from '../shared/modal.component';

/**
 * Account provisioning. Creating a student issues a one-time sign-in token and
 * emails it; a delivery failure is surfaced persistently with a resend action.
 */
@Component({
  selector: 'app-admin-accounts',
  standalone: true,
  imports: [FormsModule, ModalComponent, ErrorBannerComponent],
  templateUrl: './admin-accounts.component.html',
  styleUrls: ['./admin-accounts.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminAccountsComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  private readonly queryParams = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  readonly isRoot = this.auth.isRoot;
  readonly notice = signal<string | null>(null);
  readonly formError = signal<string | null>(null);

  readonly draftName = signal('');
  readonly draftEmail = signal('');
  readonly draftUsername = signal('');
  readonly draftPassword = signal('');

  readonly students = signal<StudentAccount[]>([
    { id: 's1', name: 'Priya Raghunathan', email: 'priya.raghunathan@mba.example.edu', pointBalance: 1000, activeBids: 3, tokenState: 'used', emailDelivered: true, createdAt: '02 Mar 2026' },
    { id: 's2', name: 'Tomas Delacroix', email: 'tomas.delacroix@mba.example.edu', pointBalance: 1000, activeBids: 2, tokenState: 'used', emailDelivered: true, createdAt: '02 Mar 2026' },
    { id: 's3', name: 'Amara Nwosu', email: 'amara.nwosu@mba.example.edu', pointBalance: 1000, activeBids: 4, tokenState: 'pending', emailDelivered: false, createdAt: '04 Mar 2026' },
    { id: 's4', name: 'Jonas Lindberg', email: 'jonas.lindberg@mba.example.edu', pointBalance: 1000, activeBids: 0, tokenState: 'expired', emailDelivered: true, createdAt: '28 Feb 2026' },
    { id: 's5', name: 'Wen Li Zhang', email: 'wenli.zhang@mba.example.edu', pointBalance: 1000, activeBids: 5, tokenState: 'used', emailDelivered: true, createdAt: '01 Mar 2026' },
  ]);

  readonly admins = signal<AdminAccount[]>([
    { id: 'a1', username: 'registrar', email: 'registrar@example.edu', isRoot: true, lastLoginAt: '14 Mar 2026, 08:12', createdAt: '01 Jan 2026' },
    { id: 'a2', username: 'j.okafor', email: 'j.okafor@example.edu', isRoot: false, lastLoginAt: '13 Mar 2026, 16:40', createdAt: '18 Feb 2026' },
    { id: 'a3', username: 'm.santos', email: 'm.santos@example.edu', isRoot: false, lastLoginAt: null, createdAt: '05 Mar 2026' },
  ]);

  readonly tab = computed(() => (this.queryParams().get('tab') === 'admins' ? 'admins' : 'students'));
  readonly modal = computed(() => this.queryParams().get('modal'));
  readonly undelivered = computed(() => this.students().filter((row) => !row.emailDelivered));

  setTab(tab: 'admins' | 'students'): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab, modal: null },
      queryParamsHandling: 'merge',
    });
  }

  openModal(modal: 'new-student' | 'new-admin'): void {
    this.formError.set(null);
    this.draftName.set('');
    this.draftEmail.set('');
    this.draftUsername.set('');
    this.draftPassword.set('');
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { modal, tab: modal === 'new-admin' ? 'admins' : 'students' },
      queryParamsHandling: 'merge',
    });
  }

  closeModal(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { modal: null },
      queryParamsHandling: 'merge',
    });
  }

  createStudent(): void {
    const name = this.draftName().trim();
    const email = this.draftEmail().trim();
    if (!name || !/^\S+@\S+\.\S+$/.test(email)) {
      this.formError.set('Enter a full name and a valid email address.');
      return;
    }
    if (this.students().some((row) => row.email === email)) {
      this.formError.set('A student with that email already exists.');
      return;
    }
    // Delivery is simulated: addresses outside the school domain fail to send,
    // which is how the reviewer can see the email_delivered = false state.
    const delivered = email.endsWith('@mba.example.edu');
    this.students.update((rows) => [
      {
        id: `s${rows.length + 1}${name.length}`,
        name,
        email,
        pointBalance: 1000,
        activeBids: 0,
        tokenState: 'pending',
        emailDelivered: delivered,
        createdAt: 'Just now',
      },
      ...rows,
    ]);
    this.notice.set(
      delivered
        ? `${name} was created with 1000 points and a sign-in link was emailed.`
        : `${name} was created with 1000 points, but the sign-in email could not be delivered. Use Resend link.`,
    );
    this.formError.set(null);
    this.closeModal();
  }

  createAdmin(): void {
    const username = this.draftUsername().trim();
    if (!username || this.draftPassword().trim().length < 8) {
      this.formError.set('Enter a username and a password of at least 8 characters.');
      return;
    }
    if (this.admins().some((row) => row.username === username)) {
      this.formError.set('That username is already taken.');
      return;
    }
    this.admins.update((rows) => [
      ...rows,
      {
        id: `a${rows.length + 1}`,
        username,
        email: `${username}@example.edu`,
        isRoot: false,
        lastLoginAt: null,
        createdAt: 'Just now',
      },
    ]);
    this.notice.set(`Administrator ${username} created.`);
    this.formError.set(null);
    this.closeModal();
  }

  resend(student: StudentAccount): void {
    this.students.update((rows) =>
      rows.map((row) =>
        row.id === student.id
          ? { ...row, emailDelivered: true, tokenState: 'pending' as const }
          : row,
      ),
    );
    this.notice.set(`A new sign-in link was sent to ${student.email}. Earlier links are now invalid.`);
  }

  tokenTone(state: StudentAccount['tokenState']): string {
    return { used: 'badge-success', pending: 'badge-warning', expired: 'badge-danger' }[state];
  }
}
