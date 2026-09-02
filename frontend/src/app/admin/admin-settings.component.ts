import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SettingEntry } from '../core/models';
import { ErrorBannerComponent } from '../shared/error-banner.component';

/** Credential configuration for provisioned services and integrations. */
@Component({
  selector: 'app-admin-settings',
  standalone: true,
  imports: [FormsModule, ErrorBannerComponent],
  templateUrl: './admin-settings.component.html',
  styleUrls: ['./admin-settings.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminSettingsComponent {
  readonly notice = signal<string | null>(null);
  readonly drafts = signal<Record<string, string>>({});

  readonly settings = signal<SettingEntry[]>([
    {
      id: 'set1',
      service: 'Resend REST API',
      label: 'Resend API key',
      envKey: 'RESEND_REST_API_POST_HTTPS_API_RESEND_COM_EMAILS_API_KEY',
      maskedValue: null,
      configured: false,
      description:
        'Sends student sign-in links. Until this is set, accounts can still be created but every invitation email fails.',
    },
    {
      id: 'set2',
      service: 'Resend REST API',
      label: 'From address',
      envKey: 'RESEND_FROM',
      maskedValue: 'no-reply@mba.example.edu',
      configured: true,
      description: 'Must belong to a domain verified in your Resend account.',
    },
    {
      id: 'set3',
      service: 'PostgreSQL',
      label: 'PostgreSQL API key',
      envKey: 'POSTGRESQL_API_KEY',
      maskedValue: null,
      configured: false,
      description: 'Credential for the managed PostgreSQL integration.',
    },
    {
      id: 'set4',
      service: 'PostgreSQL',
      label: 'Database URL',
      envKey: 'DATABASE_URL',
      maskedValue: 'postgres://app_db:••••••••@app-db-postgresql:5432/bidwell',
      configured: true,
      description: 'Primary datastore connection string. Injected by the platform.',
    },
    {
      id: 'set5',
      service: 'MinIO',
      label: 'MinIO access key',
      envKey: 'MINIO_ACCESS_KEY',
      maskedValue: null,
      configured: false,
      description: 'Object storage is provisioned but not yet used by any feature.',
    },
    {
      id: 'set6',
      service: 'Application',
      label: 'Public base URL',
      envKey: 'APP_BASE_URL',
      maskedValue: 'https://bidwell.example.edu',
      configured: true,
      description: 'Used to build the sign-in links emailed to students.',
    },
  ]);

  readonly services = computed(() => [...new Set(this.settings().map((row) => row.service))]);
  readonly unconfigured = computed(() =>
    [...new Set(this.settings().filter((row) => !row.configured).map((row) => row.service))],
  );

  forService(service: string): SettingEntry[] {
    return this.settings().filter((row) => row.service === service);
  }

  serviceConfigured(service: string): boolean {
    return this.forService(service).every((row) => row.configured);
  }

  draftFor(id: string): string {
    return this.drafts()[id] ?? '';
  }

  setDraft(id: string, value: string): void {
    this.drafts.update((current) => ({ ...current, [id]: value }));
  }

  save(entry: SettingEntry): void {
    const value = this.draftFor(entry.id).trim();
    if (!value) {
      this.notice.set(`Enter a value for ${entry.label} before saving.`);
      return;
    }
    this.settings.update((rows) =>
      rows.map((row) =>
        row.id === entry.id
          ? { ...row, configured: true, maskedValue: `${value.slice(0, 4)}••••••••${value.slice(-2)}` }
          : row,
      ),
    );
    this.setDraft(entry.id, '');
    this.notice.set(`${entry.label} saved. ${entry.service} is now configured.`);
  }
}
