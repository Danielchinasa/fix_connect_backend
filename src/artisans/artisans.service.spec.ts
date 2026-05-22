import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ArtisansService } from './artisans.service';
import { PrismaService } from '../prisma/prisma.service';

const makeProfile = (overrides = {}) => ({
  id: 'profile-1',
  userId: 'user-1',
  bio: 'Experienced plumber',
  specialty: 'Plumbing',
  startingPrice: 5000,
  location: 'Lagos',
  isVerified: false,
  isOnline: false,
  completedJobs: 0,
  rating: 0,
  responseTime: null,
  weeklySchedule: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  user: { firstName: 'John', lastName: 'Doe', avatarUrl: null },
  categories: [],
  workSamples: [],
  ...overrides,
});

describe('ArtisansService', () => {
  let service: ArtisansService;
  let prisma: {
    artisanProfile: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    serviceCategory: { findMany: jest.Mock };
    artisanCategory: { deleteMany: jest.Mock; createMany: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      artisanProfile: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      serviceCategory: { findMany: jest.fn() },
      artisanCategory: { deleteMany: jest.fn(), createMany: jest.fn() },
      // Simulate $transaction by executing the callback with the prisma mock
      $transaction: jest.fn().mockImplementation((cb) => cb(prisma)),
    };

    service = new ArtisansService(prisma as unknown as PrismaService);
  });

  // ─── findAll ────────────────────────────────────────────────────────────────
  describe('findAll', () => {
    it('returns profiles ordered by rating', () => {
      const profiles = [makeProfile()];
      prisma.artisanProfile.findMany.mockReturnValueOnce(profiles);
      expect(service.findAll()).toBe(profiles);
    });

    it('passes categoryId filter when provided', () => {
      prisma.artisanProfile.findMany.mockReturnValueOnce([]);
      service.findAll('cat-1');
      expect(prisma.artisanProfile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            categories: { some: { categoryId: 'cat-1' } },
          }),
        }),
      );
    });
  });

  // ─── findOne ────────────────────────────────────────────────────────────────
  describe('findOne', () => {
    it('returns profile when found', async () => {
      prisma.artisanProfile.findUnique.mockResolvedValueOnce(makeProfile());
      await expect(service.findOne('profile-1')).resolves.toMatchObject({
        id: 'profile-1',
      });
    });

    it('throws NotFoundException when profile does not exist', async () => {
      prisma.artisanProfile.findUnique.mockResolvedValueOnce(null);
      await expect(service.findOne('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  // ─── findMyProfile ──────────────────────────────────────────────────────────
  describe('findMyProfile', () => {
    it('returns own profile by userId', async () => {
      const profile = makeProfile();
      prisma.artisanProfile.findUnique.mockResolvedValueOnce(profile);
      await expect(service.findMyProfile('user-1')).resolves.toBe(profile);
    });

    it('throws NotFoundException when user has no profile', async () => {
      prisma.artisanProfile.findUnique.mockResolvedValueOnce(null);
      await expect(service.findMyProfile('user-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  // ─── create ─────────────────────────────────────────────────────────────────
  describe('create', () => {
    it('creates and returns the profile', async () => {
      prisma.artisanProfile.findUnique.mockResolvedValueOnce(null);
      const created = makeProfile();
      prisma.artisanProfile.create.mockResolvedValueOnce(created);

      await expect(
        service.create('user-1', {
          specialty: 'Plumbing',
          startingPrice: 5000,
          location: 'Lagos',
        }),
      ).resolves.toBe(created);
    });

    it('throws ConflictException when profile already exists', async () => {
      prisma.artisanProfile.findUnique.mockResolvedValueOnce(makeProfile());

      await expect(
        service.create('user-1', {
          specialty: 'Plumbing',
          startingPrice: 5000,
          location: 'Lagos',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  // ─── update ─────────────────────────────────────────────────────────────────
  describe('update', () => {
    it('updates and returns the profile', async () => {
      prisma.artisanProfile.findUnique.mockResolvedValueOnce(makeProfile());
      const updated = makeProfile({ location: 'Abuja' });
      prisma.artisanProfile.update.mockResolvedValueOnce(updated);

      await expect(
        service.update('user-1', { location: 'Abuja' }),
      ).resolves.toBe(updated);
    });

    it('throws NotFoundException when user has no profile', async () => {
      prisma.artisanProfile.findUnique.mockResolvedValueOnce(null);
      await expect(
        service.update('user-1', { location: 'Abuja' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // ─── setCategories ──────────────────────────────────────────────────────────
  describe('setCategories', () => {
    it('replaces categories atomically', async () => {
      prisma.artisanProfile.findUnique.mockResolvedValueOnce(makeProfile());
      prisma.serviceCategory.findMany.mockResolvedValueOnce([
        { id: 'cat-1' },
        { id: 'cat-2' },
      ]);
      prisma.artisanCategory.deleteMany.mockResolvedValueOnce({});
      prisma.artisanCategory.createMany.mockResolvedValueOnce({ count: 2 });

      await expect(
        service.setCategories('user-1', { categoryIds: ['cat-1', 'cat-2'] }),
      ).resolves.toBeUndefined();

      expect(prisma.artisanCategory.deleteMany).toHaveBeenCalledWith({
        where: { artisanProfileId: 'profile-1' },
      });
      expect(prisma.artisanCategory.createMany).toHaveBeenCalledWith({
        data: [
          { artisanProfileId: 'profile-1', categoryId: 'cat-1' },
          { artisanProfileId: 'profile-1', categoryId: 'cat-2' },
        ],
      });
    });

    it('throws BadRequestException when a category ID is invalid', async () => {
      prisma.artisanProfile.findUnique.mockResolvedValueOnce(makeProfile());
      // Only 1 of 2 IDs found — one is invalid
      prisma.serviceCategory.findMany.mockResolvedValueOnce([{ id: 'cat-1' }]);

      await expect(
        service.setCategories('user-1', {
          categoryIds: ['cat-1', 'invalid-id'],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
