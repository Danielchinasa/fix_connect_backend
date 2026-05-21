import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: { getUsers: jest.Mock };

  beforeEach(async () => {
    usersService = {
      getUsers: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: usersService,
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should require ADMIN role metadata on getAllUsers', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, controller.getAllUsers);
    expect(roles).toEqual([Role.ADMIN]);
  });

  it('should delegate getAllUsers to UsersService', async () => {
    usersService.getUsers.mockResolvedValueOnce([{ id: 'u_1' }]);

    await expect(controller.getAllUsers()).resolves.toEqual([{ id: 'u_1' }]);
    expect(usersService.getUsers).toHaveBeenCalledTimes(1);
  });
});
