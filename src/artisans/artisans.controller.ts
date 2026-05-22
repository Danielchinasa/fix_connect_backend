import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { JwtPayload } from '../auth/types/jwt-payload.type';
import { ArtisansService } from './artisans.service';
import { CreateArtisanProfileDto } from './dto/create-artisan-profile.dto';
import { SetCategoriesDto } from './dto/set-categories.dto';
import { UpdateArtisanProfileDto } from './dto/update-artisan-profile.dto';

// ─── Multer config for work sample uploads ────────────────────────────────────
// Stored in ./uploads/work-samples/ (served as /uploads/work-samples/ by main.ts)
// Same rules as avatar: JPEG / PNG / WebP, 5 MB max.
const workSampleUploadConfig = {
  storage: diskStorage({
    destination: './uploads/work-samples',
    filename: (
      _req: Express.Request,
      file: Express.Multer.File,
      cb: (error: Error | null, filename: string) => void,
    ) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
      cb(null, `sample-${unique}${extname(file.originalname).toLowerCase()}`);
    },
  }),
  fileFilter: (
    _req: Express.Request,
    file: Express.Multer.File,
    cb: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new BadRequestException('Only JPEG, PNG, and WebP images are accepted'),
        false,
      );
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 },
};

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

  // ─── Artisan: upload a work sample image ──────────────────────────────────────
  // Accepts multipart/form-data with:
  //   image   — required image file (JPEG / PNG / WebP, max 5 MB)
  //   caption — optional text shown under the image in the portfolio
  // Limited to 10 samples per artisan (enforced in the service).
  @Post('work-samples')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ARTISAN)
  @UseInterceptors(FileInterceptor('image', workSampleUploadConfig))
  addWorkSample(
    @CurrentUser('sub') userId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('caption') caption?: string,
  ) {
    if (!file) {
      throw new BadRequestException(
        'No image received. Send the image as multipart/form-data with field name "image".',
      );
    }
    const imageUrl = `/uploads/work-samples/${file.filename}`;
    return this.service.addWorkSample(userId, imageUrl, caption);
  }

  // ─── Artisan: delete a work sample ───────────────────────────────────────────
  // Returns 204 No Content. Ownership is verified inside the service.
  @Delete('work-samples/:sampleId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ARTISAN)
  @HttpCode(HttpStatus.NO_CONTENT)
  removeWorkSample(
    @CurrentUser('sub') userId: string,
    @Param('sampleId') sampleId: string,
  ) {
    return this.service.removeWorkSample(userId, sampleId);
  }
}
