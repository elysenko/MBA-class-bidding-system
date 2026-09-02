import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
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

  private readonly queryParams = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  readonly notice = signal<string | null>(null);
  readonly formError = signal<string | null>(null);
  readonly draftName = signal('');
  readonly draftCode = signal('');
  readonly draftFaculty = signal('');
  readonly draftSeatCap = signal<number | null>(30);

  readonly classes = signal<ClassSeat[]>([
    { id: 'c1', name: 'Advanced Corporate Valuation', code: 'FIN-641', faculty: 'Prof. E. Marchetti', term: 'Spring 2026', seatCap: 30, seatsTaken: null, bidCount: 46, myBidAmount: null, myBidStatus: null },
    { id: 'c2', name: 'Negotiation & Influence', code: 'MGT-512', faculty: 'Prof. D. Okonjo', term: 'Spring 2026', seatCap: 24, seatsTaken: null, bidCount: 61, myBidAmount: null, myBidStatus: null },
    { id: 'c3', name: 'Data-Driven Marketing Strategy', code: 'MKT-528', faculty: 'Prof. L. Hartmann', term: 'Spring 2026', seatCap: 40, seatsTaken: null, bidCount: 33, myBidAmount: null, myBidStatus: null },
    { id: 'c4', name: 'Private Equity & Buyouts', code: 'FIN-702', faculty: 'Prof. S. Vandermeer', term: 'Spring 2026', seatCap: 18, seatsTaken: null, bidCount: 72, myBidAmount: null, myBidStatus: null },
    { id: 'c5', name: 'Operations & Supply Chain Analytics', code: 'OPS-544', faculty: 'Prof. R. Nakamura', term: 'Spring 2026', seatCap: 35, seatsTaken: null, bidCount: 21, myBidAmount: null, myBidStatus: null },
    { id: 'c6', name: 'Entrepreneurial Finance', code: 'ENT-611', faculty: 'Prof. A. Bekele', term: 'Spring 2026', seatCap: 30, seatsTaken: null, bidCount: 38, myBidAmount: null, myBidStatus: null },
  ]);

  readonly createModalOpen = computed(() => this.queryParams().get('modal') === 'new');

  openCreate(): void {
    this.formError.set(null);
    this.draftName.set('');
    this.draftCode.set('');
    this.draftFaculty.set('');
    this.draftSeatCap.set(30);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { modal: 'new' },
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

  create(): void {
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
    this.formError.set(null);
    this.classes.update((rows) => [
      ...rows,
      {
        id: `c${rows.length + 1}${name.length}`,
        name,
        code: this.draftCode().trim() || 'NEW-000',
        faculty: this.draftFaculty().trim() || 'To be announced',
        term: 'Spring 2026',
        seatCap,
        seatsTaken: null,
        bidCount: 0,
        myBidAmount: null,
        myBidStatus: null,
      },
    ]);
    this.notice.set(`${name} added with ${seatCap} seats.`);
    this.closeModal();
  }
}
