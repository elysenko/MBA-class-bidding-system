import { Injectable, inject } from '@angular/core';
import { ApiClient } from '../api.client';
import { AdminAccount, SettingEntry, StudentAccount } from '../models';
import { formatDate, formatDateTime } from '../format';

export interface StudentMutationResult {
  student: StudentAccount;
  emailDelivered: boolean;
}

interface StudentMutationPayload {
  student: StudentAccount;
  emailDelivered: boolean;
  email_delivered: boolean;
}

/** The API speaks ISO instants; the accounts table renders display strings. */
function toAdminAccount(row: AdminAccount): AdminAccount {
  return {
    ...row,
    lastLoginAt: row.lastLoginAt ? formatDateTime(row.lastLoginAt) : null,
    createdAt: formatDate(row.createdAt),
  };
}

/** Account provisioning, service credentials, and the destructive point reset. */
@Injectable({ providedIn: 'root' })
export class AdminApi {
  private readonly api = inject(ApiClient);

  listStudents(): Promise<StudentAccount[]> {
    return this.api.get<StudentAccount[]>('/admin/accounts/students');
  }

  async listAdmins(): Promise<AdminAccount[]> {
    const rows = await this.api.get<AdminAccount[]>('/admin/accounts/admins');
    return rows.map((row) => toAdminAccount(row));
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
    return toAdminAccount(payload.admin);
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
