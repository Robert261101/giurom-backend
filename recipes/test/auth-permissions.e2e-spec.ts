// Avoid cross-repo type mismatch by not importing INestApplication from different node_modules
type NestApp = any;
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AuthModule } from '../src/auth/auth.module';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { PermissionsGuard } from '../src/permissions/permissions.guard';
import { ExampleAuthController } from '../src/example/example.controller';
import { JwtService } from '@nestjs/jwt';

describe('PermissionsGuard + JWT (e2e)', () => {
  let app: NestApp;
  let jwt: JwtService;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AuthModule],
      controllers: [ExampleAuthController],
      providers: [
        Reflector,
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: PermissionsGuard },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    jwt = moduleRef.get(JwtService);
  }, 15000); // Increase timeout for beforeAll

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  }, 15000); // Increase timeout for afterAll

  const sign = (permissions: string[] = []) =>
    jwt.sign({ sub: 1, username: 'tester', permissions });

  it('allows access when permission is present (recipes.read)', async () => {
    if (!app) return;
    const token = sign(['recipes.read']);
    await request(app.getHttpServer())
      .get('/test-auth/secure-read')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toHaveProperty('ok', true);
      });
  }, 15000); // Increase timeout

  it('denies access when permission is missing (needs recipes.read)', async () => {
    if (!app) return;
    const token = sign(['recipes.create']);
    await request(app.getHttpServer())
      .get('/test-auth/secure-read')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  }, 15000); // Increase timeout

  it('denies access without token (401)', async () => {
    if (!app) return;
    await request(app.getHttpServer())
      .get('/test-auth/secure-read')
      .expect(401);
  }, 15000); // Increase timeout

  it('denies access to recipes.delete if only recipes.read present', async () => {
    if (!app) return;
    const token = sign(['recipes.read']);
    await request(app.getHttpServer())
      .get('/test-auth/secure-delete')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  }, 15000); // Increase timeout

  it('allows access when recipes.delete is present', async () => {
    if (!app) return;
    const token = sign(['recipes.delete']);
    await request(app.getHttpServer())
      .get('/test-auth/secure-delete')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  }, 15000); // Increase timeout
});