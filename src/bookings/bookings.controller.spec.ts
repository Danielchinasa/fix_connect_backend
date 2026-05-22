import { Test, TestingModule } from '@nestjs/testing';
import { BookingStatus, Role } from '@prisma/client';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';

const mockService = {
  create: jest.fn(),
  findAllForCustomer: jest.fn(),
  findAllForArtisanByUserId: jest.fn(),
  findOne: jest.fn(),
  updateStatus: jest.fn(),
};

const customerPayload = {
  sub: 'user-1',
  email: 'c@test.com',
  role: Role.CUSTOMER,
};
const artisanPayload = {
  sub: 'user-2',
  email: 'a@test.com',
  role: Role.ARTISAN,
};

describe('BookingsController', () => {
  let controller: BookingsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BookingsController],
      providers: [{ provide: BookingsService, useValue: mockService }],
    }).compile();

    controller = module.get(BookingsController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('create passes customerId and dto to service', async () => {
    const dto = {
      artisanProfileId: 'p1',
      categoryId: 'c1',
      serviceDescription: 'Fix the pipes please',
      scheduledDate: '2026-06-15',
      timeSlot: '09:00 - 11:00',
      address: '5 Test St',
      totalAmount: 5000,
    };
    const result = { id: 'b1', ...dto };
    mockService.create.mockResolvedValueOnce(result);

    await expect(controller.create('user-1', dto)).resolves.toBe(result);
    expect(mockService.create).toHaveBeenCalledWith('user-1', dto);
  });

  it('findMine passes customerId to service', async () => {
    mockService.findAllForCustomer.mockResolvedValueOnce([]);
    await controller.findMine('user-1');
    expect(mockService.findAllForCustomer).toHaveBeenCalledWith('user-1');
  });

  it('findArtisanBookings passes userId to service', async () => {
    mockService.findAllForArtisanByUserId.mockResolvedValueOnce([]);
    await controller.findArtisanBookings(artisanPayload);
    expect(mockService.findAllForArtisanByUserId).toHaveBeenCalledWith(
      'user-2',
    );
  });

  it('findOne passes id and caller to service', async () => {
    const booking = { id: 'b1' };
    mockService.findOne.mockResolvedValueOnce(booking);
    await expect(controller.findOne('b1', customerPayload)).resolves.toBe(
      booking,
    );
    expect(mockService.findOne).toHaveBeenCalledWith('b1', customerPayload);
  });

  it('updateStatus passes id, dto and caller to service', async () => {
    const dto = { status: BookingStatus.CANCELLED };
    const updated = { id: 'b1', status: BookingStatus.CANCELLED };
    mockService.updateStatus.mockResolvedValueOnce(updated);

    await expect(
      controller.updateStatus('b1', dto, customerPayload),
    ).resolves.toBe(updated);
    expect(mockService.updateStatus).toHaveBeenCalledWith(
      'b1',
      dto,
      customerPayload,
    );
  });
});
