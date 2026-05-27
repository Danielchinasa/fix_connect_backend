import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateSavedAddressDto } from './dto/create-saved-address.dto';
import { UpdateSavedAddressDto } from './dto/update-saved-address.dto';
import { SavedAddressesService } from './saved-addresses.service';

// ─── Access control summary ───────────────────────────────────────────────────
//  GET    /saved-addresses             → list my addresses
//  POST   /saved-addresses             → create a new address
//  PATCH  /saved-addresses/:id/set-default → set as default  ← BEFORE /:id
//  PATCH  /saved-addresses/:id         → update address fields
//  DELETE /saved-addresses/:id         → delete an address
//
// All routes require a valid JWT. Users can only access their own addresses.
// The service's assertOwnership() method enforces that — the controller just
// passes the userId from the JWT without trusting anything from the request body.
@Controller('saved-addresses')
@UseGuards(JwtAuthGuard)
export class SavedAddressesController {
  constructor(private readonly savedAddressesService: SavedAddressesService) {}

  // ─── List ────────────────────────────────────────────────────────────────────
  @Get()
  findMine(@CurrentUser('sub') userId: string) {
    return this.savedAddressesService.findMine(userId);
  }

  // ─── Create ──────────────────────────────────────────────────────────────────
  @Post()
  async create(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateSavedAddressDto,
  ) {
    const data = await this.savedAddressesService.create(userId, dto);
    return { message: 'Address saved successfully', data };
  }

  // ─── Set default ─────────────────────────────────────────────────────────────
  // MUST come before PATCH /:id — otherwise NestJS would match "set-default"
  // as the :id parameter value and this route would never be reached.
  @Patch(':id/set-default')
  async setDefault(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    const data = await this.savedAddressesService.setDefault(userId, id);
    return { message: 'Default address updated', data };
  }

  // ─── Update ──────────────────────────────────────────────────────────────────
  @Patch(':id')
  async update(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateSavedAddressDto,
  ) {
    const data = await this.savedAddressesService.update(userId, id, dto);
    return { message: 'Address updated successfully', data };
  }

  // ─── Delete ──────────────────────────────────────────────────────────────────
  @Delete(':id')
  async remove(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    await this.savedAddressesService.remove(userId, id);
    return { message: 'Address deleted successfully' };
  }
}
