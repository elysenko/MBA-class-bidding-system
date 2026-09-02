import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { User } from '@prisma/client';

export interface RequestWithUser extends Request {
  user?: User;
}

/** Resolves the authenticated `User` attached by {@link SessionGuard}. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): User => {
    const request = ctx.switchToHttp().getRequest<{ user?: User }>();
    return request.user as User;
  },
);
