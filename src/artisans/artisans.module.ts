import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ArtisansController } from './artisans.controller';
import { ArtisansService } from './artisans.service';

@Module({
  imports: [PrismaModule],
  controllers: [ArtisansController],
  providers: [ArtisansService],
  // Export the service so Bookings module can look up artisan profiles
  // without a circular dependency.
  exports: [ArtisansService],
})
export class ArtisansModule {}
