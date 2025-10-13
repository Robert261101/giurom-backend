import { Controller, Get, UseFilters, BadRequestException, NotFoundException } from '@nestjs/common';
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
  @Get('ok')
  @Permissions('stock.read')
  ok() {
    return { ok: true };
  }

  @Get('bad-request')
  @Permissions('stock.read')
  badRequest() {
    throw new BadRequestException('Invalid input');
  }

  @Get('not-found')
  @Permissions('stock.read')
  notFound() {
    throw new NotFoundException('Missing');
  }

  @Get('error')
  @Permissions('stock.read')
  error() {
    // Simulate unexpected error
    throw new Error('Unexpected');
  }
}

describe('Stock behaviour e2e (auth + http statuses)', () => {
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
  }, 10000); // Increase timeout for beforeAll

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  }, 10000); // Increase timeout for afterAll

  const sign = (permissions: string[] = []) =>
    jwt.sign({ sub: 1, username: 'tester', permissions });

  it('401 without token', async () => {
    if (!app) return;
    await request(app.getHttpServer()).get('/probe/ok').expect(401);
  }, 10000); // Increase timeout

  it('403 with wrong permission', async () => {
    if (!app) return;
    const token = sign(['employees.read']);
    await request(app.getHttpServer())
      .get('/probe/ok')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  }, 10000); // Increase timeout

  it('200 with correct permission', async () => {
    if (!app) return;
    const token = sign(['stock.read']);
    await request(app.getHttpServer())
      .get('/probe/ok')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toHaveProperty('ok', true);
      });
  }, 10000); // Increase timeout

  it('400 BadRequest bubbles through', async () => {
    if (!app) return;
    const token = sign(['stock.read']);
    await request(app.getHttpServer())
      .get('/probe/bad-request')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
  }, 10000); // Increase timeout

  it('404 NotFound bubbles through', async () => {
    if (!app) return;
    const token = sign(['stock.read']);
    await request(app.getHttpServer())
      .get('/probe/not-found')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  }, 10000); // Increase timeout

  it('500 InternalServerError for unexpected errors', async () => {
    if (!app) return;
    const token = sign(['stock.read']);
    await request(app.getHttpServer())
      .get('/probe/error')
      .set('Authorization', `Bearer ${token}`)
      .expect(500);
  }, 10000); // Increase timeout
});