import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: {
    getUsers: jest.Mock;
    updateMe: jest.Mock;
    updateAvatar: jest.Mock;
    getMyStats: jest.Mock;
  };

  beforeEach(async () => {
    usersService = {
      getUsers: jest.fn(),
      updateMe: jest.fn(),
      updateAvatar: jest.fn(),
      getMyStats: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: usersService }],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('getAllUsers requires ADMIN role metadata', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, controller.getAllUsers);
    expect(roles).toEqual([Role.ADMIN]);
  });

  it('getAllUsers delegates to service', async () => {
    usersService.getUsers.mockResolvedValueOnce([{ id: 'u_1' }]);
    await expect(controller.getAllUsers()).resolves.toEqual([{ id: 'u_1' }]);
  });

  it('updateMe passes userId and dto to service', async () => {
    const dto = { firstName: 'Updated' };
    const user = { id: 'user-1', firstName: 'Updated' };
    usersService.updateMe.mockResolvedValueOnce(user);

    await expect(controller.updateMe('user-1', dto)).resolves.toBe(user);
    expect(usersService.updateMe).toHaveBeenCalledWith('user-1', dto);
  });

  it('getMyStats passes userId and role from JWT payload', async () => {
    const payload = { sub: 'user-1', email: 'a@b.com', role: Role.CUSTOMER };
    usersService.getMyStats.mockResolvedValueOnce({ totalBookings: 3 });

    await controller.getMyStats(payload);
    expect(usersService.getMyStats).toHaveBeenCalledWith(
      'user-1',
      Role.CUSTOMER,
    );
  });

  it('uploadAvatar saves file and delegates URL to service', async () => {
    const file = { filename: 'avatar-123.jpg' } as Express.Multer.File;
    const user = { id: 'user-1', avatarUrl: '/uploads/avatars/avatar-123.jpg' };
    usersService.updateAvatar.mockResolvedValueOnce(user);

    await expect(controller.uploadAvatar('user-1', file)).resolves.toBe(user);
    expect(usersService.updateAvatar).toHaveBeenCalledWith(
      'user-1',
      '/uploads/avatars/avatar-123.jpg',
    );
  });

  it('uploadAvatar throws BadRequestException when no file is provided', () => {
    // uploadAvatar throws synchronously before any async work, so we use
    // toThrow (not rejects) — there is no Promise to reject here.
    expect(() => controller.uploadAvatar('user-1', undefined as any)).toThrow(
      BadRequestException,
    );
  });
});
