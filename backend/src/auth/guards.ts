import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SecurityService, SESSION_COOKIE } from './security.service';

type AuthedRequest = Request & { user?: User; cookies?: Record<string, string> };

/**
 * 401 for anyone without a valid session cookie. Every protected route lists
 * this guard first, so the role guards below can assume `request.user` exists.
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly security: SecurityService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const raw =
      request.cookies?.[SESSION_COOKIE] ??
      (request.headers.authorization?.startsWith('Bearer ')
        ? request.headers.authorization.slice(7)
        : undefined);

    if (!raw) {
      throw new UnauthorizedException('Sign in to continue.');
    }
    const claims = this.security.verifySession(raw);
    if (!claims) {
      throw new UnauthorizedException('Your session has expired. Sign in again.');
    }
    const user = await this.prisma.user.findUnique({ where: { id: claims.sub } });
    if (!user) {
      throw new UnauthorizedException('Your session is no longer valid.');
    }
    request.user = user;
    return true;
  }
}

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest<AuthedRequest>().user;
    if (!user || user.role !== 'ADMIN') {
      throw new ForbiddenException('Administrator access is required.');
    }
    return true;
  }
}

@Injectable()
export class RootAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest<AuthedRequest>().user;
    if (!user || user.role !== 'ADMIN' || !user.isRoot) {
      throw new ForbiddenException('Only the root administrator can manage accounts.');
    }
    return true;
  }
}

@Injectable()
export class StudentGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest<AuthedRequest>().user;
    if (!user || user.role !== 'USER') {
      throw new ForbiddenException('Only students can bid.');
    }
    return true;
  }
}
