import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  // Typed as NestExpressApplication so we can call Express-specific methods
  // like useStaticAssets below.
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // All routes will be prefixed with /api/v1
  // e.g. GET /api/v1/users, POST /api/v1/auth/login
  app.setGlobalPrefix('api/v1');

  // Serve uploaded files (avatars, etc.) as static assets.
  // A file saved at ./uploads/avatars/avatar-123.jpg is accessible at:
  //   http://localhost:3000/uploads/avatars/avatar-123.jpg
  // Note: static files bypass the /api/v1 prefix intentionally.
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads',
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`FixConnect API running on http://localhost:${port}/api/v1`);
}
bootstrap();
