import { Injectable, inject } from '@angular/core';
import { ApiClient } from '../api.client';
import { Identity, Role } from '../models';

interface LoginResponse {
  identity: Identity;
}

/** Session endpoints: admin password, student one-time token, demo, signup. */
@Injectable({ providedIn: 'root' })
export class AuthApi {
  private readonly api = inject(ApiClient);

  me(): Promise<Identity> {
    return this.api.get<Identity>('/auth/me');
  }

  async adminLogin(username: string, password: string): Promise<Identity> {
    const response = await this.api.post<LoginResponse>('/auth/admin/login', {
      username,
      password,
    });
    return response.identity;
  }

  async studentLogin(token: string): Promise<Identity> {
    const response = await this.api.post<LoginResponse>('/auth/student/login', { token });
    return response.identity;
  }

  async demoLogin(role: Role): Promise<Identity> {
    const response = await this.api.post<LoginResponse>('/auth/demo-login', { role });
    return response.identity;
  }

  async signup(name: string, email: string): Promise<Identity> {
    const response = await this.api.post<LoginResponse>('/auth/signup', { name, email });
    return response.identity;
  }

  logout(): Promise<unknown> {
    return this.api.post('/auth/logout');
  }
}
