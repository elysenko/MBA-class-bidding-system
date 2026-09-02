import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Identity, Role } from './models';
import { readJson, removeKeys, writeJson } from './storage';

const SESSION_KEY = 'session';

const DEMO_STUDENT: Identity = {
  id: 'stu_204',
  name: 'Priya Raghunathan',
  email: 'priya.raghunathan@mba.example.edu',
  role: 'student',
  isRoot: false,
  pointBalance: 1000,
};

const DEMO_ADMIN: Identity = {
  id: 'adm_001',
  name: 'Registrar (root)',
  email: 'registrar',
  role: 'admin',
  isRoot: true,
  pointBalance: 0,
};

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

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly router = inject(Router);

  readonly identity = signal<Identity | null>(this.restore());

  readonly isAuthenticated = computed(() => this.identity() !== null);
  readonly role = computed<Role | null>(() => this.identity()?.role ?? null);
  readonly isAdmin = computed(() => this.role() === 'admin');
  readonly isStudent = computed(() => this.role() === 'student');
  readonly isRoot = computed(() => this.identity()?.isRoot === true);
  readonly pointBalance = computed(() => this.identity()?.pointBalance ?? 0);

  /** Restores a prior session; any unrecognised value is cleared, never thrown. */
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

  /** Admin sign-in. Resolves entirely client-side — no network in the preview. */
  adminLogin(username: string, password: string): string | null {
    if (!username.trim() || !password.trim()) {
      return 'Invalid username or password.';
    }
    this.persist({
      ...DEMO_ADMIN,
      email: username.trim(),
      name: username.trim() === 'registrar' ? 'Registrar (root)' : username.trim(),
      isRoot: username.trim() === 'registrar',
    });
    this.router.navigate(['/admin']);
    return null;
  }

  /** Student one-time token sign-in. Any plausible token succeeds. */
  studentLogin(token: string): string | null {
    const value = token.trim();
    if (value.length < 6) {
      return 'This sign-in link is invalid, expired, or has already been used. Ask an administrator to resend it.';
    }
    this.persist({ ...DEMO_STUDENT });
    this.router.navigate(['/classes']);
    return null;
  }

  signup(name: string, email: string): string | null {
    if (!name.trim() || !/^\S+@\S+\.\S+$/.test(email.trim())) {
      return 'Enter your full name and a valid email address.';
    }
    this.persist({ ...DEMO_STUDENT, name: name.trim(), email: email.trim() });
    this.router.navigate(['/classes']);
    return null;
  }

  /** Seeds a signed-in session without credentials (demo shortcut + route guard). */
  demoLogin(role: Role = 'student'): Identity {
    const identity = role === 'admin' ? { ...DEMO_ADMIN } : { ...DEMO_STUDENT };
    this.persist(identity);
    return identity;
  }

  ensureSession(role: Role): void {
    const current = this.identity();
    if (!current || current.role !== role) {
      this.demoLogin(role);
    }
  }

  setBalance(pointBalance: number): void {
    const current = this.identity();
    if (current) {
      this.persist({ ...current, pointBalance });
    }
  }

  logout(): void {
    this.identity.set(null);
    removeKeys([SESSION_KEY]);
    this.router.navigate(['/login']);
  }
}
