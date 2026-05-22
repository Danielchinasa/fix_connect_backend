import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { JwtPayload } from '../auth/types/jwt-payload.type';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingStatusDto } from './dto/update-booking-status.dto';

// ─── Access control summary ───────────────────────────────────────────────────
//  POST   /bookings              → CUSTOMER only (create a booking)
//  GET    /bookings/my           → CUSTOMER — their own bookings
//  GET    /bookings/artisan      → ARTISAN  — bookings assigned to them
//  GET    /bookings/:id          → any authenticated party to the booking
//  PATCH  /bookings/:id/status   → any authenticated party (rules enforced in service)
@Controller('bookings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BookingsController {
  constructor(private readonly service: BookingsService) {}

  @Post()
  @Roles(Role.CUSTOMER)
  create(
    @CurrentUser('sub') customerId: string,
    @Body() dto: CreateBookingDto,
  ) {
    return this.service.create(customerId, dto);
  }

  // "my" must be declared before ":id" — same ordering rule as artisans/me
  @Get('my')
  @Roles(Role.CUSTOMER)
  findMine(@CurrentUser('sub') customerId: string) {
    return this.service.findAllForCustomer(customerId);
  }

  // Artisan's job inbox — their own bookings ordered by scheduled date
  @Get('artisan')
  @Roles(Role.ARTISAN)
  findArtisanBookings(@CurrentUser() user: JwtPayload) {
    // The service needs artisanProfileId, not userId.
    // We resolve userId → profileId inside the service so the controller
    // stays thin and unaware of the artisan profile structure.
    return this.service.findAllForArtisanByUserId(user.sub);
  }

  @Get(':id')
  @Roles(Role.CUSTOMER, Role.ARTISAN, Role.ADMIN)
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.findOne(id, user);
  }

  @Patch(':id/status')
  @Roles(Role.CUSTOMER, Role.ARTISAN, Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateBookingStatusDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.updateStatus(id, dto, user);
  }
}
