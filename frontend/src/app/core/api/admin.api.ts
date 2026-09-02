import { Injectable, inject } from '@angular/core';
import { ApiClient } from '../api.client';
import { AdminAccount, SettingEntry, StudentAccount } from '../models';

export interface StudentMutationResult {
  student: StudentAccount;
  emailDelivered: boolean;
}

interface StudentMutationPayload {
  student: StudentAccount;
  emailDelivered: boolean;
  email_delivered: boolean;
}

/** Account provisioning, service credentials, and the destructive point reset. */
@Injectable({ providedIn: 'root' })
export class AdminApi {
  private readonly api = inject(ApiClient);

  listStudents(): Promise<StudentAccount[]> {
    return this.api.get<StudentAccount[]>('/admin/accounts/students');
  }

  listAdmins(): Promise<AdminAccount[]> {
    return this.api.get<AdminAccount[]>('/admin/accounts/admins');
  }

  async createStudent(name: string, email: string): Promise<StudentMutationResult> {
    const payload = await this.api.post<StudentMutationPayload>('/admin/accounts/students', {
      name,
      email,
    });
    return { student: payload.student, emailDelivered: payload.emailDelivered };
  }

  async resendToken(studentId: string): Promise<StudentMutationResult> {
    const payload = await this.api.post<StudentMutationPayload>(
      `/admin/accounts/students/${encodeURIComponent(studentId)}/resend-token`,
    );
    return { student: payload.student, emailDelivered: payload.emailDelivered };
  }

  async createAdmin(username: string, password: string): Promise<AdminAccount> {
    const payload = await this.api.post<{ admin: AdminAccount }>('/admin/accounts/admins', {
      username,
      password,
    });
    return payload.admin;
  }

  resetPoints(): Promise<{ bidsCancelled: number; studentsReset: number }> {
    return this.api.post<{ bidsCancelled: number; studentsReset: number }>('/admin/points/reset');
  }

  listSettings(): Promise<SettingEntry[]> {
    return this.api.get<SettingEntry[]>('/admin/settings');
  }

  saveSetting(key: string, value: string): Promise<{ maskedValue: string }> {
    return this.api.patch<{ maskedValue: string }>('/admin/settings', { key, value });
  }
}
