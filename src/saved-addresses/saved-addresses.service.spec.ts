import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SavedAddressesService } from './saved-addresses.service';

const makeAddress = (overrides = {}) => ({
  id: 'addr-1',
  userId: 'user-1',
  label: 'Home',
  address: '5 Lagos Street',
  city: 'Lagos',
  state: 'Lagos',
  isDefault: false,
  createdAt: new Date(),
  ...overrides,
});

describe('SavedAddressesService', () => {
  let service: SavedAddressesService;
  let prisma: {
    savedAddress: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
      delete: jest.Mock;
      count: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      savedAddress: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        delete: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      $transaction: jest.fn().mockImplementation((cb) => cb(prisma)),
    };
    service = new SavedAddressesService(prisma as unknown as PrismaService);
  });

  it('should be defined', () => expect(service).toBeDefined());

  // ─── findMine ─────────────────────────────────────────────────────────────────
  describe('findMine', () => {
    it('returns addresses sorted default-first', () => {
      const addresses = [makeAddress()];
      prisma.savedAddress.findMany.mockReturnValueOnce(addresses);
      expect(service.findMine('user-1')).toBe(addresses);
      expect(prisma.savedAddress.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      });
    });
  });

  // ─── create ───────────────────────────────────────────────────────────────────
  describe('create', () => {
    const dto = {
      label: 'Home',
      address: '5 Lagos St',
      city: 'Lagos',
      state: 'Lagos',
    };

    it('creates a non-default address directly', async () => {
      const created = makeAddress();
      prisma.savedAddress.create.mockResolvedValueOnce(created);
      await expect(service.create('user-1', dto)).resolves.toBe(created);
      // No updateMany should be called for a non-default address
      expect(prisma.savedAddress.updateMany).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when the user already has 3 addresses', async () => {
      prisma.savedAddress.count.mockResolvedValueOnce(3);
      await expect(service.create('user-1', dto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.savedAddress.create).not.toHaveBeenCalled();
    });

    it('unsets existing defaults in a transaction when isDefault is true', async () => {
      const created = makeAddress({ isDefault: true });
      prisma.savedAddress.updateMany.mockResolvedValueOnce({ count: 1 });
      prisma.savedAddress.create.mockResolvedValueOnce(created);

      await expect(
        service.create('user-1', { ...dto, isDefault: true }),
      ).resolves.toBe(created);

      expect(prisma.savedAddress.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: { isDefault: false },
      });
    });
  });

  // ─── update ───────────────────────────────────────────────────────────────────
  describe('update', () => {
    it('updates address fields', async () => {
      prisma.savedAddress.findUnique.mockResolvedValueOnce(makeAddress());
      const updated = makeAddress({ label: 'Work' });
      prisma.savedAddress.update.mockResolvedValueOnce(updated);
      await expect(
        service.update('user-1', 'addr-1', { label: 'Work' }),
      ).resolves.toBe(updated);
    });

    it('throws NotFoundException for unknown address', async () => {
      prisma.savedAddress.findUnique.mockResolvedValueOnce(null);
      await expect(service.update('user-1', 'bad', {})).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws ForbiddenException when caller is not the owner', async () => {
      prisma.savedAddress.findUnique.mockResolvedValueOnce(
        makeAddress({ userId: 'user-2' }),
      );
      await expect(
        service.update('user-1', 'addr-1', {}),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  // ─── remove ───────────────────────────────────────────────────────────────────
  describe('remove', () => {
    it('deletes an address owned by the caller', async () => {
      prisma.savedAddress.findUnique.mockResolvedValueOnce(makeAddress());
      prisma.savedAddress.delete.mockResolvedValueOnce(makeAddress());
      await expect(service.remove('user-1', 'addr-1')).resolves.toBeDefined();
      expect(prisma.savedAddress.delete).toHaveBeenCalledWith({
        where: { id: 'addr-1' },
      });
    });

    it('throws ForbiddenException when caller is not the owner', async () => {
      prisma.savedAddress.findUnique.mockResolvedValueOnce(
        makeAddress({ userId: 'user-2' }),
      );
      await expect(service.remove('user-1', 'addr-1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  // ─── setDefault ───────────────────────────────────────────────────────────────
  describe('setDefault', () => {
    it('atomically unsets all addresses then sets the target as default', async () => {
      prisma.savedAddress.findUnique.mockResolvedValueOnce(makeAddress());
      prisma.savedAddress.updateMany.mockResolvedValueOnce({ count: 2 });
      const updated = makeAddress({ isDefault: true });
      prisma.savedAddress.update.mockResolvedValueOnce(updated);

      await expect(service.setDefault('user-1', 'addr-1')).resolves.toBe(
        updated,
      );

      expect(prisma.savedAddress.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: { isDefault: false },
      });
      expect(prisma.savedAddress.update).toHaveBeenCalledWith({
        where: { id: 'addr-1' },
        data: { isDefault: true },
      });
    });

    it('throws ForbiddenException when caller is not the owner', async () => {
      prisma.savedAddress.findUnique.mockResolvedValueOnce(
        makeAddress({ userId: 'user-2' }),
      );
      await expect(
        service.setDefault('user-1', 'addr-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
