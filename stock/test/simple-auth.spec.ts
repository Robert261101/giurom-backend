import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { PermissionsGuard } from '../src/permissions/permissions.guard';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';

describe('Auth Guards', () => {
  let jwtAuthGuard: JwtAuthGuard;
  let permissionsGuard: PermissionsGuard;
  let reflector: Reflector;
  let jwtService: JwtService;

  beforeEach(() => {
    reflector = new Reflector();
    jwtService = new JwtService({
      secret: 'test-secret',
      signOptions: { expiresIn: '1h' },
    });
    jwtAuthGuard = new JwtAuthGuard();
    permissionsGuard = new PermissionsGuard(reflector);
  });

  it('should be defined', () => {
    expect(jwtAuthGuard).toBeDefined();
    expect(permissionsGuard).toBeDefined();
  });
});