import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { ServiceCategoriesModule } from './service-categories/service-categories.module';
import { ArtisansModule } from './artisans/artisans.module';

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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
