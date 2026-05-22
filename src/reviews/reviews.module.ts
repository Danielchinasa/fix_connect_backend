import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';

@Module({
  imports: [PrismaModule],
  controllers: [ReviewsController],
  providers: [ReviewsService],
  // Export ReviewsService so ArtisansModule can call findForArtisan
  // when building the artisan detail response (upcoming enrichment).
  exports: [ReviewsService],
})
export class ReviewsModule {}
