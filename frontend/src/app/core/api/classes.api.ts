import { Injectable, inject } from '@angular/core';
import { ApiClient } from '../api.client';
import { ClassSeat } from '../models';

export interface ClassInput {
  name: string;
  code?: string;
  faculty?: string;
  term?: string;
  seatCap?: number;
}

/** Class catalogue (read for everyone, write for administrators). */
@Injectable({ providedIn: 'root' })
export class ClassesApi {
  private readonly api = inject(ApiClient);

  list(): Promise<ClassSeat[]> {
    return this.api.get<ClassSeat[]>('/classes');
  }

  get(id: string): Promise<ClassSeat> {
    return this.api.get<ClassSeat>(`/classes/${encodeURIComponent(id)}`);
  }

  create(input: ClassInput): Promise<ClassSeat> {
    return this.api.post<ClassSeat>('/admin/classes', input);
  }

  update(id: string, input: ClassInput): Promise<ClassSeat> {
    return this.api.patch<ClassSeat>(`/admin/classes/${encodeURIComponent(id)}`, input);
  }
}
