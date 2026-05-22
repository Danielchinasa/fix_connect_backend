import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ArtisansController } from './artisans.controller';
import { ArtisansService } from './artisans.service';

const mockService = {
  findAll: jest.fn(),
  findOne: jest.fn(),
  findMyProfile: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  setCategories: jest.fn(),
  addWorkSample: jest.fn(),
  removeWorkSample: jest.fn(),
};

describe('ArtisansController', () => {
  let controller: ArtisansController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ArtisansController],
      providers: [{ provide: ArtisansService, useValue: mockService }],
    }).compile();

    controller = module.get(ArtisansController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('findAll delegates to service with optional categoryId', () => {
    const result = [{ id: 'p1' }];
    mockService.findAll.mockReturnValueOnce(result);
    expect(controller.findAll('cat-1')).toBe(result);
    expect(mockService.findAll).toHaveBeenCalledWith('cat-1');
  });

  it('findAll passes undefined when no categoryId', () => {
    mockService.findAll.mockReturnValueOnce([]);
    controller.findAll(undefined);
    expect(mockService.findAll).toHaveBeenCalledWith(undefined);
  });

  it('findMyProfile passes userId from JWT sub', async () => {
    const profile = { id: 'p1' };
    mockService.findMyProfile.mockResolvedValueOnce(profile);
    await expect(controller.findMyProfile('user-1')).resolves.toBe(profile);
    expect(mockService.findMyProfile).toHaveBeenCalledWith('user-1');
  });

  it('findOne passes id to service', async () => {
    const profile = { id: 'p1' };
    mockService.findOne.mockResolvedValueOnce(profile);
    await expect(controller.findOne('p1')).resolves.toBe(profile);
    expect(mockService.findOne).toHaveBeenCalledWith('p1');
  });

  it('create passes userId and dto to service', async () => {
    const dto = {
      specialty: 'Plumbing',
      startingPrice: 5000,
      location: 'Lagos',
    };
    const result = { id: 'p1', ...dto };
    mockService.create.mockResolvedValueOnce(result);
    await expect(controller.create('user-1', dto)).resolves.toBe(result);
    expect(mockService.create).toHaveBeenCalledWith('user-1', dto);
  });

  it('update passes userId and dto to service', async () => {
    const dto = { isOnline: true };
    const result = { id: 'p1', isOnline: true };
    mockService.update.mockResolvedValueOnce(result);
    await expect(controller.update('user-1', dto)).resolves.toBe(result);
    expect(mockService.update).toHaveBeenCalledWith('user-1', dto);
  });

  it('setCategories passes userId from full payload', async () => {
    mockService.setCategories.mockResolvedValueOnce(undefined);
    const user = { sub: 'user-1', email: 'a@b.com', role: 'ARTISAN' as const };
    await expect(
      controller.setCategories(user, { categoryIds: ['cat-1'] }),
    ).resolves.toBeUndefined();
    expect(mockService.setCategories).toHaveBeenCalledWith('user-1', {
      categoryIds: ['cat-1'],
    });
  });

  describe('addWorkSample', () => {
    const fakeFile = {
      filename: 'sample-123.jpg',
      mimetype: 'image/jpeg',
    } as Express.Multer.File;

    it('calls service with imageUrl and caption', async () => {
      const sample = {
        id: 'ws-1',
        imageUrl: '/uploads/work-samples/sample-123.jpg',
      };
      mockService.addWorkSample.mockResolvedValueOnce(sample);

      const result = await controller.addWorkSample(
        'user-1',
        fakeFile,
        'My tiling work',
      );

      expect(mockService.addWorkSample).toHaveBeenCalledWith(
        'user-1',
        '/uploads/work-samples/sample-123.jpg',
        'My tiling work',
      );
      expect(result).toBe(sample);
    });

    it('throws BadRequestException when no file is provided', () => {
      expect(() =>
        controller.addWorkSample(
          'user-1',
          undefined as unknown as Express.Multer.File,
          undefined,
        ),
      ).toThrow(BadRequestException);
      expect(mockService.addWorkSample).not.toHaveBeenCalled();
    });
  });

  describe('removeWorkSample', () => {
    it('calls service.removeWorkSample with userId and sampleId', async () => {
      mockService.removeWorkSample.mockResolvedValueOnce(undefined);
      await controller.removeWorkSample('user-1', 'ws-1');
      expect(mockService.removeWorkSample).toHaveBeenCalledWith(
        'user-1',
        'ws-1',
      );
    });
  });
});
