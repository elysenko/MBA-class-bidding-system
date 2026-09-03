import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ApiClient, ApiError } from './api.client';
import { AuthApi } from './api/auth.api';
import { Identity, Role } from './models';
import { readJson, removeKeys, writeJson } from './storage';

const SESSION_KEY = 'session';

/** Accepts anything storage hands back but only trusts a well-formed identity. */
function isIdentity(value: unknown): value is Identity {
  const v = value as Identity | null;
  return (
    !!v &&
    typeof v === 'object' &&
    typeof v.id === 'string' &&
    typeof v.email === 'string' &&
    typeof v.name === 'string' &&
    (v.role === 'admin' || v.role === 'student') &&
    typeof v.pointBalance === 'number'
  );
}

/**
 * Session state for the SPA.
 *
 * The HttpOnly `sid` cookie is the real credential; the cached copy in
 * localStorage only avoids a blank frame on reload and is always re-validated
 * against `GET /api/auth/me`.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly router = inject(Router);
  private readonly authApi = inject(AuthApi);
  private readonly api = inject(ApiClient);

  readonly identity = signal<Identity | null>(this.restore());
  readonly ready = signal(false);

  readonly isAuthenticated = computed(() => this.identity() !== null);
  readonly role = computed<Role | null>(() => this.identity()?.role ?? null);
  readonly isAdmin = computed(() => this.role() === 'admin');
  readonly isStudent = computed(() => this.role() === 'student');
  readonly isRoot = computed(() => this.identity()?.isRoot === true);
  readonly pointBalance = computed(() => this.identity()?.pointBalance ?? 0);

  private bootstrapping: Promise<Identity | null> | null = null;

  constructor() {
    // Any 401 anywhere in the app drops the cached identity exactly once.
    this.api.onUnauthorized(() => this.clear());
  }

  private restore(): Identity | null {
    const stored = readJson<unknown>(SESSION_KEY);
    if (isIdentity(stored)) {
      return stored;
    }
    if (stored !== null) {
      removeKeys([SESSION_KEY]);
    }
    return null;
  }

  private persist(identity: Identity): void {
    this.identity.set(identity);
    writeJson(SESSION_KEY, identity);
  }

  private clear(): void {
    this.identity.set(null);
    removeKeys([SESSION_KEY]);
  }

  /** Resolves the real session once per page load; route guards await this. */
  bootstrap(force = false): Promise<Identity | null> {
    if (force) {
      this.bootstrapping = null;
    }
    if (!this.bootstrapping) {
      this.bootstrapping = this.authApi
        .me()
        .then((identity) => {
          if (identity) {
            this.persist(identity);
          } else {
            this.clear();
          }
          return identity;
        })
        .catch(() => {
          this.clear();
          return null;
        })
        .finally(() => this.ready.set(true));
    }
    return this.bootstrapping;
  }

  /** Re-reads the identity (balance changes after bidding or a point reset). */
  async refresh(): Promise<Identity | null> {
    return this.bootstrap(true);
  }

  private landing(identity: Identity): string {
    return identity.role === 'admin' ? '/admin' : '/classes';
  }

  private adopt(identity: Identity): void {
    this.persist(identity);
    this.bootstrapping = Promise.resolve(identity);
    this.ready.set(true);
  }

  /** Returns the server's error message, or `null` when the sign-in succeeded. */
  async adminLogin(username: string, password: string): Promise<string | null> {
    if (!username.trim() || !password.trim()) {
      return 'Invalid username or password.';
    }
    try {
      const identity = await this.authApi.adminLogin(username.trim(), password);
      this.adopt(identity);
      await this.router.navigateByUrl(this.landing(identity));
      return null;
    } catch (error) {
      return this.messageOf(error, 'Invalid username or password.');
    }
  }

  async studentLogin(token: string): Promise<string | null> {
    const value = token.trim();
    if (!value) {
      return 'This sign-in link is invalid, expired, or has already been used. Ask an administrator to resend it.';
    }
    try {
      const identity = await this.authApi.studentLogin(value);
      this.adopt(identity);
      await this.router.navigateByUrl(this.landing(identity));
      return null;
    } catch (error) {
      return this.messageOf(
        error,
        'This sign-in link is invalid, expired, or has already been used. Ask an administrator to resend it.',
      );
    }
  }

  async signup(name: string, email: string): Promise<string | null> {
    if (!name.trim() || !/^\S+@\S+\.\S+$/.test(email.trim())) {
      return 'Enter your full name and a valid email address.';
    }
    try {
      const identity = await this.authApi.signup(name.trim(), email.trim());
      this.adopt(identity);
      await this.router.navigateByUrl(this.landing(identity));
      return null;
    } catch (error) {
      return this.messageOf(error, 'Public signup is disabled. Contact an administrator.');
    }
  }

  /** Signs in as a pre-seeded demo account — the server never creates one. */
  async demoLogin(role: Role = 'student'): Promise<string | null> {
    try {
      const identity = await this.authApi.demoLogin(role);
      this.adopt(identity);
      await this.router.navigateByUrl(this.landing(identity));
      return null;
    } catch (error) {
      return this.messageOf(error, 'Demo sign-in is not available on this deployment.');
    }
  }

  setBalance(pointBalance: number): void {
    const current = this.identity();
    if (current) {
      this.persist({ ...current, pointBalance });
    }
  }

  async logout(): Promise<void> {
    try {
      await this.authApi.logout();
    } catch {
      /* the cookie is cleared locally regardless */
    }
    this.clear();
    this.bootstrapping = Promise.resolve(null);
    await this.router.navigateByUrl('/login');
  }

  private messageOf(error: unknown, fallback: string): string {
    return error instanceof ApiError && error.message ? error.message : fallback;
  }
}
