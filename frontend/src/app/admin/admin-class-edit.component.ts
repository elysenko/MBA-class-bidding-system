import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { ClassSeat } from '../core/models';

interface ClassDraft {
  name: string;
  code: string;
  faculty: string;
  seatCap: number | null;
}
import { ErrorBannerComponent } from '../shared/error-banner.component';

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

  private readonly params = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });

  readonly formError = signal<string | null>(null);
  readonly saved = signal(false);
  readonly draft = signal<ClassDraft | null>(null);

  readonly classes = signal<ClassSeat[]>([
    { id: 'c1', name: 'Advanced Corporate Valuation', code: 'FIN-641', faculty: 'Prof. E. Marchetti', term: 'Spring 2026', seatCap: 30, seatsTaken: null, bidCount: 46, myBidAmount: null, myBidStatus: null },
    { id: 'c2', name: 'Negotiation & Influence', code: 'MGT-512', faculty: 'Prof. D. Okonjo', term: 'Spring 2026', seatCap: 24, seatsTaken: null, bidCount: 61, myBidAmount: null, myBidStatus: null },
    { id: 'c3', name: 'Data-Driven Marketing Strategy', code: 'MKT-528', faculty: 'Prof. L. Hartmann', term: 'Spring 2026', seatCap: 40, seatsTaken: null, bidCount: 33, myBidAmount: null, myBidStatus: null },
    { id: 'c4', name: 'Private Equity & Buyouts', code: 'FIN-702', faculty: 'Prof. S. Vandermeer', term: 'Spring 2026', seatCap: 18, seatsTaken: null, bidCount: 72, myBidAmount: null, myBidStatus: null },
    { id: 'c5', name: 'Operations & Supply Chain Analytics', code: 'OPS-544', faculty: 'Prof. R. Nakamura', term: 'Spring 2026', seatCap: 35, seatsTaken: null, bidCount: 21, myBidAmount: null, myBidStatus: null },
    { id: 'c6', name: 'Entrepreneurial Finance', code: 'ENT-611', faculty: 'Prof. A. Bekele', term: 'Spring 2026', seatCap: 30, seatsTaken: null, bidCount: 38, myBidAmount: null, myBidStatus: null },
  ]);

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

  patch(key: keyof ClassDraft, value: string | number | null): void {
    this.saved.set(false);
    this.draft.set({ ...this.form(), [key]: value });
  }

  save(): void {
    const value = this.form();
    const seatCap = Number(value.seatCap ?? 0);
    if (!value.name.trim()) {
      this.formError.set('Class name cannot be empty.');
      return;
    }
    if (!Number.isFinite(seatCap) || seatCap < 1) {
      this.formError.set('Seat cap must be at least 1.');
      return;
    }
    this.formError.set(null);
    const id = this.current()?.id;
    this.classes.update((rows) =>
      rows.map((row) =>
        row.id === id
          ? { ...row, name: value.name.trim(), code: value.code.trim(), faculty: value.faculty.trim(), seatCap }
          : row,
      ),
    );
    this.saved.set(true);
  }

  done(): void {
    this.router.navigate(['/admin/classes']);
  }
}
