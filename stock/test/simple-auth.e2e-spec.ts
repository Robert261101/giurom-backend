import { Controller, Get } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { APP_GUARD } from '@nestjs/core';
import * as request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { AuthModule } from '../src/auth/auth.module';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { Permissions } from '../src/permissions/permissions.decorator';
import { PermissionsGuard } from '../src/permissions/permissions.guard';

@Controller('probe')
class ProbeController {
  @Get('public')
  publicRoute() {
    return { message: 'public' };
  }

  @Get('protected')
  @Permissions('stock.read')
  protectedRoute() {
    return { message: 'protected' };
  }
}

describe('Simple Auth Test', () => {
  let app: any;
  let jwt: JwtService;

  beforeAll(async () => {
    const mod: TestingModule = await Test.createTestingModule({
      imports: [AuthModule],
      controllers: [ProbeController],
      providers: [
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: PermissionsGuard },
      ],
    }).compile();

    app = mod.createNestApplication();
    await app.init();
    jwt = mod.get(JwtService);
  }, 10000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  }, 10000);

  it('should allow access to public routes without token', async () => {
    if (!app) return;
    await request(app.getHttpServer()).get('/probe/public').expect(200);
  }, 5000);

  it('should deny access to protected routes without token', async () => {
    if (!app) return;
    await request(app.getHttpServer()).get('/probe/protected').expect(401);
  }, 5000);
});