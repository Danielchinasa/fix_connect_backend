import {
  ForbiddenException,
  type ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  const handler = () => undefined;
  const controllerClass = class TestController {};

  const makeContext = (role?: Role): ExecutionContext => {
    return {
      getClass: () => controllerClass,
      getHandler: () => handler,
      switchToHttp: () => ({
        getRequest: () => ({
          user: role ? { role } : undefined,
        }),
      }),
    } as unknown as ExecutionContext;
  };

  it('allows access when no roles metadata is present', () => {
    const reflector = new Reflector();
    const guard = new RolesGuard(reflector);
    const context = makeContext();

    expect(guard.canActivate(context)).toBe(true);
  });

  it('throws UnauthorizedException when role is missing for protected route', () => {
    const reflector = new Reflector();
    Reflect.defineMetadata(ROLES_KEY, [Role.ADMIN], handler);

    const guard = new RolesGuard(reflector);
    const context = makeContext();

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);

    Reflect.deleteMetadata(ROLES_KEY, handler);
  });

  it('throws ForbiddenException when role is not allowed', () => {
    const reflector = new Reflector();
    Reflect.defineMetadata(ROLES_KEY, [Role.ADMIN], handler);

    const guard = new RolesGuard(reflector);
    const context = makeContext(Role.CUSTOMER);

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);

    Reflect.deleteMetadata(ROLES_KEY, handler);
  });

  it('allows access when user role is allowed', () => {
    const reflector = new Reflector();
    Reflect.defineMetadata(ROLES_KEY, [Role.ADMIN], handler);

    const guard = new RolesGuard(reflector);
    const context = makeContext(Role.ADMIN);

    expect(guard.canActivate(context)).toBe(true);

    Reflect.deleteMetadata(ROLES_KEY, handler);
  });
});
