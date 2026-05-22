import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
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
  create(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateSavedAddressDto,
  ) {
    return this.savedAddressesService.create(userId, dto);
  }

  // ─── Set default ─────────────────────────────────────────────────────────────
  // MUST come before PATCH /:id — otherwise NestJS would match "set-default"
  // as the :id parameter value and this route would never be reached.
  @Patch(':id/set-default')
  setDefault(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.savedAddressesService.setDefault(userId, id);
  }

  // ─── Update ──────────────────────────────────────────────────────────────────
  @Patch(':id')
  update(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateSavedAddressDto,
  ) {
    return this.savedAddressesService.update(userId, id, dto);
  }

  // ─── Delete ──────────────────────────────────────────────────────────────────
  // 204 No Content is the correct HTTP status for a successful delete —
  // the resource is gone so there is nothing to return in the body.
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.savedAddressesService.remove(userId, id);
  }
}
