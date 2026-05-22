import { Test, TestingModule } from '@nestjs/testing';
import { ServiceCategoriesController } from './service-categories.controller';
import { ServiceCategoriesService } from './service-categories.service';

const mockService = {
  findAll: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
};

describe('ServiceCategoriesController', () => {
  let controller: ServiceCategoriesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ServiceCategoriesController],
      providers: [{ provide: ServiceCategoriesService, useValue: mockService }],
    }).compile();

    controller = module.get(ServiceCategoriesController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('findAll delegates to service', () => {
    const result = [{ id: 'cat-1', name: 'Plumbing' }];
    mockService.findAll.mockReturnValueOnce(result);
    expect(controller.findAll()).toBe(result);
    expect(mockService.findAll).toHaveBeenCalledTimes(1);
  });

  it('findOne passes the id to service', async () => {
    const result = { id: 'cat-1', name: 'Plumbing' };
    mockService.findOne.mockResolvedValueOnce(result);
    await expect(controller.findOne('cat-1')).resolves.toBe(result);
    expect(mockService.findOne).toHaveBeenCalledWith('cat-1');
  });

  it('create passes dto to service', async () => {
    const dto = { name: 'Electrical' };
    const result = { id: 'cat-2', ...dto };
    mockService.create.mockResolvedValueOnce(result);
    await expect(controller.create(dto)).resolves.toBe(result);
    expect(mockService.create).toHaveBeenCalledWith(dto);
  });

  it('update passes id and dto to service', async () => {
    const dto = { name: 'Electrical (Updated)' };
    const result = { id: 'cat-2', ...dto };
    mockService.update.mockResolvedValueOnce(result);
    await expect(controller.update('cat-2', dto)).resolves.toBe(result);
    expect(mockService.update).toHaveBeenCalledWith('cat-2', dto);
  });

  it('remove passes id to service', async () => {
    mockService.remove.mockResolvedValueOnce(undefined);
    await expect(controller.remove('cat-1')).resolves.toBeUndefined();
    expect(mockService.remove).toHaveBeenCalledWith('cat-1');
  });
});
