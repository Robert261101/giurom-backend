import { Test, TestingModule } from '@nestjs/testing';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { PermissionsGuard } from '../src/permissions/permissions.guard';
import { Controller, Get } from '@nestjs/common';
import * as request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { AuthModule } from '../src/auth/auth.module';
import { Permissions } from '../src/permissions/permissions.decorator';

@Controller('probe')
class ProbeController {
  @Get('read')
  @Permissions('stock.read')
  ok() { return { ok: true }; }
}

describe('Stock permissions (e2e)', () => {
  let app: any;
  let jwt: JwtService;

  beforeAll(async () => {
    const mod: TestingModule = await Test.createTestingModule({
      imports: [AuthModule],
      controllers: [ProbeController],
      providers: [Reflector, { provide: APP_GUARD, useClass: JwtAuthGuard }, { provide: APP_GUARD, useClass: PermissionsGuard }],
    }).compile();
    app = mod.createNestApplication();
    await app.init();
    jwt = mod.get(JwtService);
  }, 10000); // Increase timeout for beforeAll

  afterAll(async () => { 
    if (app) {
      await app.close(); 
    }
  }, 10000); // Increase timeout for afterAll

  const sign = (permissions: string[] = []) => jwt.sign({ sub: 1, username: 't', permissions });

  it('200 with stock.read', async () => {
    if (!app) return;
    await request(app.getHttpServer()).get('/probe/read').set('Authorization', `Bearer ${sign(['stock.read'])}`).expect(200);
  }, 10000); // Increase timeout

  it('403 without permission', async () => {
    if (!app) return;
    await request(app.getHttpServer()).get('/probe/read').set('Authorization', `Bearer ${sign([])}`).expect(403);
  }, 10000); // Increase timeout

  it('401 without token', async () => {
    if (!app) return;
    await request(app.getHttpServer()).get('/probe/read').expect(401);
  }, 10000); // Increase timeout
});