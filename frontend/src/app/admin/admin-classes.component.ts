import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { ClassesApi } from '../core/api/classes.api';
import { ClassSeat } from '../core/models';
import { ErrorBannerComponent } from '../shared/error-banner.component';
import { ModalComponent } from '../shared/modal.component';

/** Class CRUD for the round. The create dialog is addressable at ?modal=new. */
@Component({
  selector: 'app-admin-classes',
  standalone: true,
  imports: [FormsModule, RouterLink, ModalComponent, ErrorBannerComponent],
  templateUrl: './admin-classes.component.html',
  styleUrls: ['./admin-classes.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminClassesComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly classesApi = inject(ClassesApi);

  private readonly queryParams = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  readonly notice = signal<string | null>(null);
  readonly formError = signal<string | null>(null);
  readonly draftName = signal('');
  readonly draftCode = signal('');
  readonly draftFaculty = signal('');
  readonly draftSeatCap = signal<number | null>(30);

  readonly classes = signal<ClassSeat[]>([]);

  readonly createModalOpen = computed(() => this.queryParams().get('modal') === 'new');

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    this.classes.set(await this.classesApi.list());
  }

  openCreate(): void {
    this.formError.set(null);
    this.draftName.set('');
    this.draftCode.set('');
    this.draftFaculty.set('');
    this.draftSeatCap.set(30);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { modal: 'new' },
      queryParamsHandling: 'merge',
    });
  }

  closeModal(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { modal: null },
      queryParamsHandling: 'merge',
    });
  }

  async create(): Promise<void> {
    const name = this.draftName().trim();
    const seatCap = Number(this.draftSeatCap() ?? 0);
    if (!name) {
      this.formError.set('Class name cannot be empty.');
      return;
    }
    if (!Number.isFinite(seatCap) || seatCap < 1) {
      this.formError.set('Seat cap must be at least 1.');
      return;
    }
    try {
      await this.classesApi.create({
        name,
        code: this.draftCode().trim(),
        faculty: this.draftFaculty().trim(),
        term: this.classes()[0]?.term ?? '',
        seatCap,
      });
      this.formError.set(null);
      await this.load();
      this.notice.set(`${name} added with ${seatCap} seats.`);
      this.closeModal();
    } catch (error) {
      this.formError.set(
        error instanceof Error ? error.message : 'That class could not be created.',
      );
    }
  }
}
