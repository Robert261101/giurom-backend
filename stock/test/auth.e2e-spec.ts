import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AuthModule } from '../src/auth/auth.module';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { PermissionsGuard } from '../src/permissions/permissions.guard';
import { JwtService } from '@nestjs/jwt';
import { Controller, Get } from '@nestjs/common';
import { Permissions } from '../src/permissions/permissions.decorator';

@Controller('test')
class TestController {
  @Get('protected')
  @Permissions('stock.read')
  protectedRoute() {
    return { message: 'protected' };
  }
}

describe('Auth Guards (e2e)', () => {
  let app: any; // Remove explicit type to avoid conflicts
  let jwtService: JwtService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AuthModule],
      controllers: [TestController],
      providers: [
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: PermissionsGuard },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    
    jwtService = moduleFixture.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('should return 401 when accessing protected endpoint without token', () => {
    return request(app.getHttpServer())
      .get('/test/protected')
      .expect(401);
  });

  it('should return 401 when accessing protected endpoint with invalid token', () => {
    return request(app.getHttpServer())
      .get('/test/protected')
      .set('Authorization', 'Bearer invalid-token')
      .expect(401);
  });
  
  it('should return 403 when accessing protected endpoint with valid token but insufficient permissions', () => {
    // Create a valid token but without the required permissions
    const token = jwtService.sign({ 
      sub: 1, 
      username: 'test-user', 
      permissions: ['employees.read'] // Different permission than required
    });
    
    return request(app.getHttpServer())
      .get('/test/protected')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });
  
  it('should return 200 when accessing protected endpoint with valid token and sufficient permissions', () => {
    // Create a valid token with the required permissions
    const token = jwtService.sign({ 
      sub: 1, 
      username: 'test-user', 
      permissions: ['stock.read'] // Correct permission
    });
    
    return request(app.getHttpServer())
      .get('/test/protected')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });
});