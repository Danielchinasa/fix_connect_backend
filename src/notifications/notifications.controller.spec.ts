import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let service: {
    findMine: jest.Mock;
    markOneRead: jest.Mock;
    markAllRead: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      findMine: jest.fn(),
      markOneRead: jest.fn(),
      markAllRead: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [{ provide: NotificationsService, useValue: service }],
    }).compile();

    controller = module.get<NotificationsController>(NotificationsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ─── findMine ────────────────────────────────────────────────────────────────
  it('findMine passes userId from JWT to service', () => {
    const notifications = [{ id: 'n1', isRead: false }];
    service.findMine.mockReturnValueOnce(notifications);

    expect(controller.findMine('user-1')).toBe(notifications);
    expect(service.findMine).toHaveBeenCalledWith('user-1');
  });

  // ─── markAllRead ─────────────────────────────────────────────────────────────
  // This test comes before markOneRead to mirror the CONTROLLER route order.
  // Keeping the same order in tests makes the spec easier to scan.
  it('markAllRead passes userId to service and returns count', async () => {
    service.markAllRead.mockResolvedValueOnce({ updated: 3 });

    await expect(controller.markAllRead('user-1')).resolves.toEqual({
      updated: 3,
    });
    expect(service.markAllRead).toHaveBeenCalledWith('user-1');
  });

  // ─── markOneRead ─────────────────────────────────────────────────────────────
  it('markOneRead passes userId and notificationId to service', async () => {
    const updated = { id: 'n1', isRead: true };
    service.markOneRead.mockResolvedValueOnce(updated);

    await expect(controller.markOneRead('user-1', 'n1')).resolves.toBe(updated);

    expect(service.markOneRead).toHaveBeenCalledWith('user-1', 'n1');
  });
});
