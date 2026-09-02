import { Injectable } from '@nestjs/common';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import type { Response } from 'express';
import type { UserRole } from '@prisma/client';

export const SESSION_COOKIE = 'sid';

/** Admin sessions are short; student sessions last the length of a round. */
const ADMIN_TTL_SECONDS = 12 * 60 * 60;
const STUDENT_TTL_SECONDS = 30 * 24 * 60 * 60;

export interface SessionClaims {
  sub: string;
  role: UserRole;
  jti: string;
  exp?: number;
}

@Injectable()
export class SecurityService {
  private get secret(): string {
    return (
      process.env.SESSION_SECRET ??
      process.env.JWT_SECRET ??
      'insecure-development-session-secret'
    );
  }

  /** Cookies are only marked Secure when explicitly enabled, so the app also works over plain HTTP previews. */
  private get cookieSecure(): boolean {
    return (process.env.COOKIE_SECURE ?? 'false').toLowerCase() === 'true';
  }

  hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, 10);
  }

  /**
   * Constant-time verification. When no hash exists (e.g. a student account) a
   * dummy comparison still runs so unknown-user and bad-password take the same
   * time and return the same 401.
   */
  async verifyPassword(plain: string, hash: string | null): Promise<boolean> {
    const target = hash ?? '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv';
    try {
      const ok = await bcrypt.compare(plain, target);
      return hash === null ? false : ok;
    } catch {
      return false;
    }
  }

  /** 32 random bytes, URL-safe — this is what gets emailed to the student. */
  generateLoginToken(): string {
    return randomBytes(32).toString('base64url');
  }

  hashToken(token: string): string {
    return createHash('sha256').update(token.trim()).digest('hex');
  }

  safeEquals(a: string, b: string): boolean {
    const left = Buffer.from(a);
    const right = Buffer.from(b);
    return left.length === right.length && timingSafeEqual(left, right);
  }

  ttlFor(role: UserRole): number {
    return role === 'ADMIN' ? ADMIN_TTL_SECONDS : STUDENT_TTL_SECONDS;
  }

  signSession(userId: string, role: UserRole): { token: string; maxAge: number } {
    const maxAge = this.ttlFor(role);
    const token = jwt.sign(
      { sub: userId, role, jti: randomBytes(12).toString('hex') },
      this.secret,
      { expiresIn: maxAge },
    );
    return { token, maxAge };
  }

  verifySession(token: string): SessionClaims | null {
    try {
      const decoded = jwt.verify(token, this.secret) as SessionClaims;
      return decoded?.sub ? decoded : null;
    } catch {
      return null;
    }
  }

  setSessionCookie(res: Response, token: string, maxAgeSeconds: number): void {
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.cookieSecure,
      path: '/',
      maxAge: maxAgeSeconds * 1000,
    });
  }

  clearSessionCookie(res: Response): void {
    res.clearCookie(SESSION_COOKIE, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.cookieSecure,
      path: '/',
    });
  }
}
