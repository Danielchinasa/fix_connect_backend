import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Put,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { JwtPayload } from '../auth/types/jwt-payload.type';
import { ArtisansService } from './artisans.service';
import { CreateArtisanProfileDto } from './dto/create-artisan-profile.dto';
import { SetCategoriesDto } from './dto/set-categories.dto';
import { UpdateArtisanProfileDto } from './dto/update-artisan-profile.dto';

// ─── Route ordering note ───────────────────────────────────────────────────────
// In NestJS, literal routes must be declared BEFORE parameterised routes in the
// same controller, otherwise NestJS matches "me" or "categories" as :id.
// Rule: specific → generic. See: GET /me before GET /:id.
@Controller('artisans')
export class ArtisansController {
  constructor(private readonly service: ArtisansService) {}

  // ─── Public reads ────────────────────────────────────────────────────────────
  // Optional ?categoryId=xxx filters the list to artisans in that category —
  // used when a customer taps a category tile on the home screen.
  @Get()
  findAll(@Query('categoryId') categoryId?: string) {
    return this.service.findAll(categoryId);
  }

  // ─── Artisan: own profile ("me" must come before :id) ───────────────────────
  @Get('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ARTISAN)
  findMyProfile(@CurrentUser('sub') userId: string) {
    return this.service.findMyProfile(userId);
  }

  // ─── Public: single artisan detail ──────────────────────────────────────────
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  // ─── Artisan: create profile ─────────────────────────────────────────────────
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ARTISAN)
  create(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateArtisanProfileDto,
  ) {
    return this.service.create(userId, dto);
  }

  // ─── Artisan: update own profile ─────────────────────────────────────────────
  @Patch()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ARTISAN)
  update(
    @CurrentUser('sub') userId: string,
    @Body() dto: UpdateArtisanProfileDto,
  ) {
    return this.service.update(userId, dto);
  }

  // ─── Artisan: replace service categories ─────────────────────────────────────
  // PUT (not PATCH) because the client sends the complete desired state,
  // not a partial change. The entire category list is replaced.
  @Put('categories')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ARTISAN)
  @HttpCode(HttpStatus.NO_CONTENT)
  setCategories(
    @CurrentUser() user: JwtPayload,
    @Body() dto: SetCategoriesDto,
  ) {
    return this.service.setCategories(user.sub, dto);
  }
}
