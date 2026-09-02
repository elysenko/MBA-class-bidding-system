import { Injectable, inject } from '@angular/core';
import { ApiClient } from '../api.client';
import { ClassResultRow, ClassSummary, ResultRow } from '../models';

interface ClassResultsPayload {
  summary: { id: string; name: string; code: string; seatCap: number; resolvedAt: string | null };
  rows: ClassResultRow[];
}

/** Outcomes once the window has closed and seats were awarded. */
@Injectable({ providedIn: 'root' })
export class ResultsApi {
  private readonly api = inject(ApiClient);

  mine(): Promise<ResultRow[]> {
    return this.api.get<ResultRow[]>('/me/results');
  }

  forStudent(studentId: string): Promise<ResultRow[]> {
    return this.api.get<ResultRow[]>(`/students/${encodeURIComponent(studentId)}/results`);
  }

  forClass(classId: string): Promise<{ summary: ClassSummary; rows: ClassResultRow[] }> {
    return this.api
      .get<ClassResultsPayload>(`/admin/classes/${encodeURIComponent(classId)}/results`)
      .then((payload) => ({
        summary: {
          id: payload.summary.id,
          name: payload.summary.name,
          code: payload.summary.code,
          seatCap: payload.summary.seatCap,
          resolvedAt: payload.summary.resolvedAt,
        },
        rows: payload.rows,
      }));
  }
}
