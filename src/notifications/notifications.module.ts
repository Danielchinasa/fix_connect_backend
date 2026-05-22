import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

// No need to import PrismaModule here — it is decorated with @Global() in
// src/prisma/prisma.module.ts, which makes PrismaService available to every
// module in the application automatically.
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService],
})
export class NotificationsModule {}
