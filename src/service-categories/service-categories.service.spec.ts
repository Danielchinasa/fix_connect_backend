import { ConflictException, NotFoundException } from '@nestjs/common';
import { ServiceCategoriesService } from './service-categories.service';
import { PrismaService } from '../prisma/prisma.service';

const makeCategory = (overrides = {}) => ({
  id: 'cat-1',
  name: 'Plumbing',
  iconUrl: null,
  description: 'All plumbing services',
  isActive: true,
  createdAt: new Date(),
  ...overrides,
});

describe('ServiceCategoriesService', () => {
  let service: ServiceCategoriesService;
  let prisma: {
    serviceCategory: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };

  beforeEach(() => {
    prisma = {
      serviceCategory: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    service = new ServiceCategoriesService(prisma as unknown as PrismaService);
  });

  // ─── findAll ────────────────────────────────────────────────────────────────
  describe('findAll', () => {
    it('returns active categories ordered by name', () => {
      const categories = [makeCategory()];
      prisma.serviceCategory.findMany.mockReturnValueOnce(categories);

      expect(service.findAll()).toBe(categories);
      expect(prisma.serviceCategory.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { name: 'asc' },
      });
    });
  });

  // ─── findOne ────────────────────────────────────────────────────────────────
  describe('findOne', () => {
    it('returns the category when found', async () => {
      prisma.serviceCategory.findFirst.mockResolvedValueOnce(makeCategory());
      await expect(service.findOne('cat-1')).resolves.toMatchObject({
        id: 'cat-1',
      });
    });

    it('throws NotFoundException when category does not exist', async () => {
      prisma.serviceCategory.findFirst.mockResolvedValueOnce(null);
      await expect(service.findOne('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  // ─── create ─────────────────────────────────────────────────────────────────
  describe('create', () => {
    it('creates and returns the new category', async () => {
      prisma.serviceCategory.findUnique.mockResolvedValueOnce(null);
      const created = makeCategory();
      prisma.serviceCategory.create.mockResolvedValueOnce(created);

      await expect(service.create({ name: 'Plumbing' })).resolves.toBe(created);
    });

    it('throws ConflictException when name already exists', async () => {
      prisma.serviceCategory.findUnique.mockResolvedValueOnce(makeCategory());

      await expect(service.create({ name: 'Plumbing' })).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  // ─── update ─────────────────────────────────────────────────────────────────
  describe('update', () => {
    it('updates and returns the category', async () => {
      prisma.serviceCategory.findFirst.mockResolvedValueOnce(makeCategory());
      const updated = makeCategory({ name: 'Electrical' });
      prisma.serviceCategory.update.mockResolvedValueOnce(updated);

      await expect(
        service.update('cat-1', { name: 'Electrical' }),
      ).resolves.toBe(updated);
    });

    it('throws NotFoundException when category to update does not exist', async () => {
      prisma.serviceCategory.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.update('missing', { name: 'X' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // ─── remove ─────────────────────────────────────────────────────────────────
  describe('remove', () => {
    it('soft-deletes by setting isActive to false', async () => {
      prisma.serviceCategory.findFirst.mockResolvedValueOnce(makeCategory());
      prisma.serviceCategory.update.mockResolvedValueOnce({});

      await service.remove('cat-1');

      expect(prisma.serviceCategory.update).toHaveBeenCalledWith({
        where: { id: 'cat-1' },
        data: { isActive: false },
      });
    });

    it('throws NotFoundException when category to remove does not exist', async () => {
      prisma.serviceCategory.findFirst.mockResolvedValueOnce(null);

      await expect(service.remove('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
