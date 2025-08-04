import { Controller, Post, Body, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { Public } from './decorators/public.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @Public()
  @ApiOperation({ summary: 'Autentificare utilizator și generare token JWT' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Autentificare reușită',
    schema: {
      type: 'object',
      properties: {
        access_token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
        user: {
          type: 'object',
          properties: {
            id: { type: 'number', example: 1 },
            username: { type: 'string', example: 'admin' },
            email: { type: 'string', example: 'admin@giurom.com' },
            permissions: { type: 'array', items: { type: 'string' }, example: ['stock:create', 'recipes:read'] },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Credențiale invalide',
  })
  async login(@Body() loginDto: any) {
    // Simulare autentificare - în realitate ar verifica în baza de date
    const mockUser = {
      id: 1,
      username: loginDto.username || 'admin',
      email: loginDto.email || 'admin@giurom.com',
      permissions: [
        // Stock permissions
        'stock:products:create', 'stock:products:read', 'stock:products:update', 'stock:products:delete',
        'stock:items:create', 'stock:items:read', 'stock:items:update', 'stock:items:delete',
        'stock:transactions:create', 'stock:transactions:read',
        
        // Recipes permissions
        'recipes:create', 'recipes:read', 'recipes:update', 'recipes:delete',
        'recipes:categories:create', 'recipes:categories:read', 'recipes:categories:update', 'recipes:categories:delete',
        'recipes:products:create', 'recipes:products:read', 'recipes:products:update', 'recipes:products:delete',
        
        // Leave requests permissions
        'leave-requests:create', 'leave-requests:read', 'leave-requests:approve',
        
        // Shift change requests permissions
        'shift-change-requests:create', 'shift-change-requests:read', 'shift-change-requests:approve',
        
        // Calendar permissions
        'calendar:events:create', 'calendar:events:read', 'calendar:events:update',
        'calendar:recurrence-rules:create',
      ],
      roles: ['admin'],
    };

    const token = await this.authService.generateToken(mockUser);

    return {
      access_token: token,
      user: {
        id: mockUser.id,
        username: mockUser.username,
        email: mockUser.email,
        permissions: mockUser.permissions,
      },
    };
  }

  @Post('test-token')
  @Public()
  @ApiOperation({ summary: 'Generează un token de test cu permisiuni limitate' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Token de test generat',
  })
  async generateTestToken() {
    const testUser = {
      id: 2,
      username: 'test-user',
      email: 'test@giurom.com',
      permissions: [
        'stock:products:read',
        'recipes:read',
        'leave-requests:create',
        'calendar:events:read',
      ],
      roles: ['user'],
    };

    const token = await this.authService.generateToken(testUser);

    return {
      access_token: token,
      user: {
        id: testUser.id,
        username: testUser.username,
        email: testUser.email,
        permissions: testUser.permissions,
      },
      note: 'Acest token are permisiuni limitate pentru testare',
    };
  }
}
