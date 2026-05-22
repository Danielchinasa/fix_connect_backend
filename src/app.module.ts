import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { ServiceCategoriesModule } from './service-categories/service-categories.module';
import { ArtisansModule } from './artisans/artisans.module';
import { BookingsModule } from './bookings/bookings.module';
import { ReviewsModule } from './reviews/reviews.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SavedAddressesModule } from './saved-addresses/saved-addresses.module';
import { PaymentsModule } from './payments/payments.module';
import { BankAccountsModule } from './bank-accounts/bank-accounts.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    UsersModule,
    AuthModule,
    ServiceCategoriesModule,
    ArtisansModule,
    BookingsModule,
    ReviewsModule,
    NotificationsModule,
    SavedAddressesModule,
    PaymentsModule,
    BankAccountsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
