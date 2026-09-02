import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SecurityService } from './security.service';

/** Identical message for every failed sign-in — never reveals which half was wrong. */
const BAD_CREDENTIALS = 'Invalid username or password.';
const BAD_TOKEN =
  'This sign-in link is invalid, expired, or has already been used. Ask an administrator to resend it.';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly security: SecurityService,
  ) {}

  /** Administrators sign in with username (or email) + password. */
  async authenticateAdmin(usernameOrEmail: string, password: string): Promise<User> {
    const identifier = usernameOrEmail.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: {
        role: 'ADMIN',
        OR: [{ username: identifier }, { email: identifier }],
      },
    });
    const ok = await this.security.verifyPassword(password, user?.passwordHash ?? null);
    if (!user || !ok) {
      throw new UnauthorizedException(BAD_CREDENTIALS);
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    return user;
  }

  /**
   * Students sign in with the one-time token from their email. The token row is
   * claimed inside a transaction so a link cannot be redeemed twice, even if the
   * student double-clicks.
   */
  async authenticateStudent(token: string): Promise<User> {
    const tokenHash = this.security.hashToken(token);

    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ id: string; user_id: string }>>`
        SELECT id, user_id
        FROM login_tokens
        WHERE token_hash = ${tokenHash}
          AND used_at IS NULL
          AND expires_at > NOW()
        FOR UPDATE
      `;
      const row = rows[0];
      if (!row) {
        throw new UnauthorizedException(BAD_TOKEN);
      }
      await tx.loginToken.update({
        where: { id: row.id },
        data: { usedAt: new Date() },
      });
      const user = await tx.user.update({
        where: { id: row.user_id },
        data: { lastLoginAt: new Date() },
      });
      if (user.role !== 'USER') {
        throw new UnauthorizedException(BAD_TOKEN);
      }
      return user;
    });
  }

  /** Shape returned by `/api/auth/me` and every login route. */
  identity(user: User): Record<string, unknown> {
    return {
      id: user.id,
      name: user.name ?? user.username ?? user.email,
      email: user.email,
      username: user.username,
      role: user.role === 'ADMIN' ? 'admin' : 'student',
      isRoot: user.isRoot,
      pointBalance: user.role === 'ADMIN' ? 0 : user.pointBalance,
    };
  }
}
