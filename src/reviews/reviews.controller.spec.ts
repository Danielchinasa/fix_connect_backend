import { Test, TestingModule } from '@nestjs/testing';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';

const mockService = {
  create: jest.fn(),
  findMine: jest.fn(),
  findForArtisan: jest.fn(),
};

describe('ReviewsController', () => {
  let controller: ReviewsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReviewsController],
      providers: [{ provide: ReviewsService, useValue: mockService }],
    }).compile();

    controller = module.get(ReviewsController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('create passes customerId and dto to service', async () => {
    const dto = { bookingId: 'b1', rating: 5 };
    const result = { id: 'r1', ...dto };
    mockService.create.mockResolvedValueOnce(result);

    await expect(controller.create('user-1', dto)).resolves.toBe(result);
    expect(mockService.create).toHaveBeenCalledWith('user-1', dto);
  });

  it('findMine passes customerId to service', async () => {
    mockService.findMine.mockResolvedValueOnce([]);
    await controller.findMine('user-1');
    expect(mockService.findMine).toHaveBeenCalledWith('user-1');
  });

  it('findForArtisan passes artisanId to service', async () => {
    mockService.findForArtisan.mockResolvedValueOnce([]);
    await controller.findForArtisan('profile-1');
    expect(mockService.findForArtisan).toHaveBeenCalledWith('profile-1');
  });
});
