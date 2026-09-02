import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { AdminApi } from '../core/api/admin.api';
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
  private readonly adminApi = inject(AdminApi);

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

  readonly students = signal<StudentAccount[]>([]);
  readonly admins = signal<AdminAccount[]>([]);

  readonly tab = computed(() => (this.queryParams().get('tab') === 'admins' ? 'admins' : 'students'));
  readonly modal = computed(() => this.queryParams().get('modal'));
  readonly undelivered = computed(() => this.students().filter((row) => !row.emailDelivered));

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      const [students, admins] = await Promise.all([
        this.adminApi.listStudents(),
        this.adminApi.listAdmins(),
      ]);
      this.students.set(students);
      this.admins.set(admins);
    } catch (error) {
      this.formError.set(
        error instanceof Error ? error.message : 'Accounts could not be loaded.',
      );
    }
  }

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

  async createStudent(): Promise<void> {
    const name = this.draftName().trim();
    const email = this.draftEmail().trim();
    if (!name || !/^\S+@\S+\.\S+$/.test(email)) {
      this.formError.set('Enter a full name and a valid email address.');
      return;
    }
    try {
      const { student, emailDelivered } = await this.adminApi.createStudent(name, email);
      await this.load();
      // A delivery failure never blocks the account — it is reported instead.
      this.notice.set(
        emailDelivered
          ? `${student.name} was created with ${student.pointBalance} points and a sign-in link was emailed.`
          : `${student.name} was created with ${student.pointBalance} points, but the sign-in email could not be delivered. Use Resend link.`,
      );
      this.formError.set(null);
      this.closeModal();
    } catch (error) {
      this.formError.set(
        error instanceof Error ? error.message : 'That student could not be created.',
      );
    }
  }

  async createAdmin(): Promise<void> {
    const username = this.draftUsername().trim();
    const password = this.draftPassword().trim();
    if (!username || password.length < 8) {
      this.formError.set('Enter a username and a password of at least 8 characters.');
      return;
    }
    try {
      const admin = await this.adminApi.createAdmin(username, password);
      await this.load();
      this.notice.set(`Administrator ${admin.username} created.`);
      this.formError.set(null);
      this.closeModal();
    } catch (error) {
      this.formError.set(
        error instanceof Error ? error.message : 'That administrator could not be created.',
      );
    }
  }

  async resend(student: StudentAccount): Promise<void> {
    try {
      const { emailDelivered } = await this.adminApi.resendToken(student.id);
      await this.load();
      this.notice.set(
        emailDelivered
          ? `A new sign-in link was sent to ${student.email}. Earlier links are now invalid.`
          : `A new sign-in link was issued for ${student.email}, but it could not be delivered.`,
      );
    } catch (error) {
      this.formError.set(
        error instanceof Error ? error.message : 'The sign-in link could not be resent.',
      );
    }
  }

  tokenTone(state: StudentAccount['tokenState']): string {
    return { used: 'badge-success', pending: 'badge-warning', expired: 'badge-danger' }[state];
  }
}
