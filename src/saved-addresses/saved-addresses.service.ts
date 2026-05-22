import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSavedAddressDto } from './dto/create-saved-address.dto';
import { UpdateSavedAddressDto } from './dto/update-saved-address.dto';

@Injectable()
export class SavedAddressesService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── List my saved addresses ──────────────────────────────────────────────────
  // Default address is sorted to the top, then ordered oldest-first so the list
  // is stable as the user adds more addresses.
  findMine(userId: string) {
    return this.prisma.savedAddress.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
  }

  // ─── Create a new saved address ───────────────────────────────────────────────
  // If the new address is marked as default we must unset ALL existing defaults
  // first — otherwise the user could end up with two default addresses.
  // We wrap both writes in a $transaction so they either both succeed or both
  // fail; a crash between them would leave the data inconsistent.
  async create(userId: string, dto: CreateSavedAddressDto) {
    // Cap at 3 addresses — enough for home, office, and one other.
    const count = await this.prisma.savedAddress.count({ where: { userId } });
    if (count >= 3) {
      throw new BadRequestException('You can save a maximum of 3 addresses');
    }

    if (dto.isDefault) {
      return this.prisma.$transaction(async (tx) => {
        // Unset every existing default for this user
        await tx.savedAddress.updateMany({
          where: { userId },
          data: { isDefault: false },
        });
        // Create the new address as the sole default
        return tx.savedAddress.create({ data: { ...dto, userId } });
      });
    }

    // Simple create when isDefault is false or omitted
    return this.prisma.savedAddress.create({ data: { ...dto, userId } });
  }

  // ─── Update an existing address ───────────────────────────────────────────────
  // Same default-unset transaction logic applies if the caller promotes this
  // address to default via the update payload.
  async update(userId: string, id: string, dto: UpdateSavedAddressDto) {
    await this.assertOwnership(userId, id);

    if (dto.isDefault) {
      return this.prisma.$transaction(async (tx) => {
        await tx.savedAddress.updateMany({
          where: { userId },
          data: { isDefault: false },
        });
        return tx.savedAddress.update({ where: { id }, data: dto });
      });
    }

    return this.prisma.savedAddress.update({ where: { id }, data: dto });
  }

  // ─── Delete a saved address ───────────────────────────────────────────────────
  async remove(userId: string, id: string) {
    await this.assertOwnership(userId, id);
    return this.prisma.savedAddress.delete({ where: { id } });
  }

  // ─── Set an address as the default ───────────────────────────────────────────
  // Dedicated endpoint for the mobile app's "Set as default" button.
  // Atomically: unset all → set target.
  async setDefault(userId: string, id: string) {
    await this.assertOwnership(userId, id);

    return this.prisma.$transaction(async (tx) => {
      await tx.savedAddress.updateMany({
        where: { userId },
        data: { isDefault: false },
      });
      return tx.savedAddress.update({
        where: { id },
        data: { isDefault: true },
      });
    });
  }

  // ─── Private: ownership check ────────────────────────────────────────────────
  // Centralised so all mutating methods (update, remove, setDefault) reuse the
  // same 404 + 403 logic rather than duplicating it.
  private async assertOwnership(userId: string, id: string) {
    const address = await this.prisma.savedAddress.findUnique({
      where: { id },
    });

    if (!address) {
      throw new NotFoundException(`Address '${id}' not found`);
    }

    if (address.userId !== userId) {
      throw new ForbiddenException('You do not have access to this address');
    }

    return address;
  }
}
