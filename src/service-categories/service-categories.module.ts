import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ServiceCategoriesController } from './service-categories.controller';
import { ServiceCategoriesService } from './service-categories.service';

@Module({
  imports: [PrismaModule],
  controllers: [ServiceCategoriesController],
  providers: [ServiceCategoriesService],
  // We export the service so other modules (e.g. ArtisanProfiles, Bookings)
  // can inject it for cross-module reads without a circular dependency.
  exports: [ServiceCategoriesService],
})
export class ServiceCategoriesModule {}
