import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminApi } from '../core/api/admin.api';
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
  private readonly adminApi = inject(AdminApi);

  readonly notice = signal<string | null>(null);
  readonly drafts = signal<Record<string, string>>({});
  readonly settings = signal<SettingEntry[]>([]);

  readonly services = computed(() => [...new Set(this.settings().map((row) => row.service))]);
  readonly unconfigured = computed(() =>
    [...new Set(this.settings().filter((row) => !row.configured).map((row) => row.service))],
  );

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      this.settings.set(await this.adminApi.listSettings());
    } catch (error) {
      this.notice.set(
        error instanceof Error ? error.message : 'Service settings could not be loaded.',
      );
    }
  }

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

  async save(entry: SettingEntry): Promise<void> {
    const value = this.draftFor(entry.id).trim();
    if (!value) {
      this.notice.set(`Enter a value for ${entry.label} before saving.`);
      return;
    }
    try {
      await this.adminApi.saveSetting(entry.envKey, value);
      await this.load();
      this.setDraft(entry.id, '');
      this.notice.set(`${entry.label} saved. ${entry.service} is now configured.`);
    } catch (error) {
      this.notice.set(
        error instanceof Error ? error.message : `${entry.label} could not be saved.`,
      );
    }
  }
}
