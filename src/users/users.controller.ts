import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
  Post,
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
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersService } from './users.service';

// ─── Multer configuration for avatar uploads ─────────────────────────────────
// multer is the industry-standard Node.js file upload library. NestJS wraps
// it via FileInterceptor. The config below:
//   • saves files to disk at ./uploads/avatars/
//   • generates a unique filename to prevent collisions and path traversal
//   • rejects anything that is not a JPEG, PNG or WebP image
//   • caps file size at 5 MB
//
// In production you would swap diskStorage for a cloud storage engine
// (e.g. multer-s3 for AWS S3 or @google-cloud/storage) by changing only
// this config object — the controller stays the same.
const avatarUploadConfig = {
  storage: diskStorage({
    destination: './uploads/avatars',
    filename: (
      _req: Express.Request,
      file: Express.Multer.File,
      cb: (error: Error | null, filename: string) => void,
    ) => {
      // e.g. "avatar-1716398400000-482910.jpg"
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
      cb(null, `avatar-${unique}${extname(file.originalname).toLowerCase()}`);
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
      // Pass the error to multer; NestJS will translate it to a 400 response
      cb(
        new BadRequestException('Only JPEG, PNG, and WebP images are accepted'),
        false,
      );
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB — reject before wasting bandwidth
  },
};

// ─── Access control summary ───────────────────────────────────────────────────
//  GET   /users            → ADMIN only  (list all users)
//  PATCH /users/me         → any auth'd user  (edit own profile)
//  GET   /users/me/stats   → any auth'd user  (own booking/review counts)
//  POST  /users/me/avatar  → any auth'd user  (upload profile photo)
//
// "me" must be declared BEFORE any ":id" route that might be added later.
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ─── Admin: list all users ──────────────────────────────────────────────────
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  getAllUsers() {
    return this.usersService.getUsers();
  }

  // ─── Self: update profile ───────────────────────────────────────────────────
  // No RolesGuard here — any authenticated user (customer, artisan, admin)
  // can update their own profile. We only need the identity from the JWT.
  @Patch('me')
  @UseGuards(JwtAuthGuard)
  updateMe(@CurrentUser('sub') userId: string, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateMe(userId, dto);
  }

  // ─── Self: profile stats ────────────────────────────────────────────────────
  // "me/stats" must come before any future "/:id" route to avoid
  // NestJS matching the literal string "me" as an ID parameter.
  @Get('me/stats')
  @UseGuards(JwtAuthGuard)
  getMyStats(@CurrentUser() user: JwtPayload) {
    // We pass the role so the service can conditionally fetch artisan data.
    return this.usersService.getMyStats(user.sub, user.role);
  }

  // ─── Self: upload avatar ────────────────────────────────────────────────────
  // FileInterceptor('avatar') tells multer to look for a field named "avatar"
  // in the incoming multipart/form-data request. The uploaded file is injected
  // via @UploadedFile() and saved to disk by the diskStorage config above.
  @Post('me/avatar')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('avatar', avatarUploadConfig))
  uploadAvatar(
    @CurrentUser('sub') userId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException(
        'No file received. Send the image as multipart/form-data with field name "avatar".',
      );
    }

    // Build the public URL path for the stored file.
    // main.ts serves ./uploads as /uploads so this resolves to e.g.:
    //   http://localhost:3000/uploads/avatars/avatar-1716398400000-482910.jpg
    const avatarUrl = `/uploads/avatars/${file.filename}`;
    return this.usersService.updateAvatar(userId, avatarUrl);
  }
}
