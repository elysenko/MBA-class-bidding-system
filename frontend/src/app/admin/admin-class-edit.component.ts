import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { ClassesApi } from '../core/api/classes.api';
import { ClassSeat } from '../core/models';
import { ErrorBannerComponent } from '../shared/error-banner.component';

interface ClassDraft {
  name: string;
  code: string;
  faculty: string;
  seatCap: number | null;
}

/** Edit one class. Seat cap >= 1 and a non-empty name are enforced before submit. */
@Component({
  selector: 'app-admin-class-edit',
  standalone: true,
  imports: [FormsModule, RouterLink, ErrorBannerComponent],
  templateUrl: './admin-class-edit.component.html',
  styleUrls: ['./admin-class-edit.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminClassEditComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly classesApi = inject(ClassesApi);

  private readonly params = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });

  readonly formError = signal<string | null>(null);
  readonly saved = signal(false);
  readonly draft = signal<ClassDraft | null>(null);

  readonly classes = signal<ClassSeat[]>([]);

  readonly current = computed(
    () => this.classes().find((row) => row.id === this.params().get('id')) ?? null,
  );

  /** The draft starts as a copy of the stored record and diverges as the user types. */
  readonly form = computed<ClassDraft>(() => {
    const edited = this.draft();
    if (edited) return edited;
    const row = this.current();
    return row
      ? { name: row.name, code: row.code, faculty: row.faculty, seatCap: row.seatCap }
      : { name: '', code: '', faculty: '', seatCap: 30 };
  });

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    this.classes.set(await this.classesApi.list());
  }

  patch(key: keyof ClassDraft, value: string | number | null): void {
    this.saved.set(false);
    this.draft.set({ ...this.form(), [key]: value });
  }

  async save(): Promise<void> {
    const value = this.form();
    const seatCap = Number(value.seatCap ?? 0);
    const id = this.current()?.id;
    if (!id) return;
    if (!value.name.trim()) {
      this.formError.set('Class name cannot be empty.');
      return;
    }
    if (!Number.isFinite(seatCap) || seatCap < 1) {
      this.formError.set('Seat cap must be at least 1.');
      return;
    }
    try {
      await this.classesApi.update(id, {
        name: value.name.trim(),
        code: value.code.trim(),
        faculty: value.faculty.trim(),
        seatCap,
      });
      this.formError.set(null);
      this.draft.set(null);
      await this.load();
      this.saved.set(true);
    } catch (error) {
      this.formError.set(
        error instanceof Error ? error.message : 'That class could not be saved.',
      );
    }
  }

  done(): void {
    void this.router.navigate(['/admin/classes']);
  }
}
