import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { AuthService } from './auth.service';
import { Role } from './models';

/**
 * Route guard for the static preview. Every screen must be deep-linkable, so a
 * cold load of a protected route seeds the matching demo session and renders
 * rather than bouncing to /login. It never redirects, so no loop is possible.
 */
export const requireAuth = (role: Role): CanActivateFn => {
  return () => {
    inject(AuthService).ensureSession(role);
    return true;
  };
};
