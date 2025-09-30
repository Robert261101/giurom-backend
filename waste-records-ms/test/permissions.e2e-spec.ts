import { Test, TestingModule } from '@nestjs/testing';
import { APP_GUARD, BaseExceptionFilter, Reflector } from '@nestjs/core';
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
  @Permissions('waste-records.read')
  ok() { return { ok: true }; }
}

describe('Waste-Records permissions (e2e)', () => {
  let app: any;
  let jwt: JwtService;

  beforeAll(async () => {
    const mod: TestingModule = await Test.createTestingModule({
      imports: [AuthModule],
      controllers: [ProbeController],
      providers: [Reflector, { provide: APP_GUARD, useClass: JwtAuthGuard }, { provide: APP_GUARD, useClass: PermissionsGuard }],
    }).compile();
    app = mod.createNestApplication();
    app.useGlobalFilters(new BaseExceptionFilter());
    await app.init();
    jwt = mod.get(JwtService);
  });

  afterAll(async () => { await app.close(); });

  const sign = (permissions: string[] = []) => jwt.sign({ sub: 1, username: 't', permissions });

  it('200 with waste-records.read', async () => {
    await request(app.getHttpServer()).get('/probe/read').set('Authorization', `Bearer ${sign(['waste-records.read'])}`).expect(200);
  });

  it('403 without permission', async () => {
    await request(app.getHttpServer()).get('/probe/read').set('Authorization', `Bearer ${sign([])}`).expect(403);
  });

  it('401 without token', async () => {
    await request(app.getHttpServer()).get('/probe/read').expect(401);
  });
});


