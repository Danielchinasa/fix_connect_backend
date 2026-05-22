import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';

// ─── Access control summary ───────────────────────────────────────────────────
//  POST /reviews             → CUSTOMER only (submit a review)
//  GET  /reviews/my          → CUSTOMER only (my submitted reviews)
//  GET  /reviews/artisan/:id → public (visible on artisan profile page)
//
// Note: "my" must be declared BEFORE ":id" — same ordering rule seen
// in artisans/me and bookings/my.
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly service: ReviewsService) {}

  // Returns 201 Created by default in NestJS (POST handler).
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CUSTOMER)
  create(@CurrentUser('sub') customerId: string, @Body() dto: CreateReviewDto) {
    return this.service.create(customerId, dto);
  }

  @Get('my')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CUSTOMER)
  @HttpCode(HttpStatus.OK)
  findMine(@CurrentUser('sub') customerId: string) {
    return this.service.findMine(customerId);
  }

  // Public — no guard needed. The artisan's profile page shows this to everyone.
  @Get('artisan/:artisanId')
  @HttpCode(HttpStatus.OK)
  findForArtisan(@Param('artisanId') artisanId: string) {
    return this.service.findForArtisan(artisanId);
  }
}
