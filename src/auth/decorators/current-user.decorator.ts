import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { JwtPayload } from '../types/jwt-payload.type';

// ─── @CurrentUser() decorator ─────────────────────────────────────────────────
// Usage in a controller method:
//   @CurrentUser()           → the full JwtPayload { sub, email, role }
//   @CurrentUser('sub')      → just the user's ID string
//   @CurrentUser('role')     → just the role
//
// This only works on routes protected by JwtAuthGuard (which populates req.user
// via the JWT Passport strategy's validate() return value).
export const CurrentUser = createParamDecorator(
  (field: keyof JwtPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ user: JwtPayload }>();
    return field ? request.user[field] : request.user;
  },
);
