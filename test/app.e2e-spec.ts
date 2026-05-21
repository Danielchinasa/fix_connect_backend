import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { UsersService } from '../src/users/users.service';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;

  const usersServiceMock = {
    getUsers: jest.fn(),
  };

  const buildAccessToken = (role: Role) => {
    return jwtService.sign(
      {
        sub: 'e2e-user-id',
        email:
          role === Role.ADMIN
            ? 'admin@fixconnect.test'
            : 'user@fixconnect.test',
        role,
      },
      {
        secret: process.env.JWT_ACCESS_SECRET ?? 'change_this_access_secret',
        expiresIn: '15m',
      },
    );
  };

  beforeEach(async () => {
    usersServiceMock.getUsers.mockReset();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(UsersService)
      .useValue(usersServiceMock)
      .compile();

    app = moduleFixture.createNestApplication();
    jwtService = moduleFixture.get(JwtService);
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Welcome to FixConnect API!');
  });

  it('/users (GET) should return 401 without token', () => {
    return request(app.getHttpServer()).get('/users').expect(401);
  });

  it('/users (GET) should return 403 for non-admin token', () => {
    const token = buildAccessToken(Role.CUSTOMER);

    return request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('/users (GET) should return 200 for admin token', () => {
    const token = buildAccessToken(Role.ADMIN);
    usersServiceMock.getUsers.mockResolvedValueOnce([
      {
        id: 'user-1',
        email: 'admin@fixconnect.test',
      },
    ]);

    return request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect([
        {
          id: 'user-1',
          email: 'admin@fixconnect.test',
        },
      ]);
  });

  afterEach(async () => {
    await app.close();
  });
});
