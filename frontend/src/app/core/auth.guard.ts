import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { AuthService } from './auth.service';
import { Role } from './models';

/**
 * Role-aware route guard. Unauthenticated visitors are sent to the sign-in page
 * for the area they asked for; a signed-in identity in the wrong area is sent to
 * its own home screen, so no redirect loop is possible.
 */
export const requireAuth = (role: Role): CanActivateFn => {
  return async (): Promise<boolean | UrlTree> => {
    const auth = inject(AuthService);
    const router = inject(Router);
    const identity = await auth.bootstrap();

    if (!identity) {
      return router.parseUrl(role === 'admin' ? '/admin/login' : '/login');
    }
    if (identity.role !== role) {
      return router.parseUrl(identity.role === 'admin' ? '/admin' : '/classes');
    }
    return true;
  };
};
