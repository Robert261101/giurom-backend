import { Controller, Post, Body } from '@nestjs/common';

@Controller('auth')
export class AuthController {
  @Post('login')
  async login(@Body() loginDto: any) {
    const mockUser = {
      id: 1,
      username: loginDto?.username || 'admin',
      email: loginDto?.email || 'admin@giurom.com',
      permissions: [
        'stock:products:create', 'stock:products:read', 'stock:products:update', 'stock:products:delete',
        'stock:items:create', 'stock:items:read', 'stock:items:update', 'stock:items:delete',
        'stock:transactions:create', 'stock:transactions:read',
        'recipes:create', 'recipes:read', 'recipes:update', 'recipes:delete',
        'recipes:categories:create', 'recipes:categories:read', 'recipes:categories:update', 'recipes:categories:delete',
        'recipes:products:create', 'recipes:products:read', 'recipes:products:update', 'recipes:products:delete',
      ],
      roles: ['admin'],
    };

    // Simple static token; other services currently don't validate JWT server-side
    const accessToken = 'mock-token-' + Date.now();

    return {
      access_token: accessToken,
      user: {
        id: mockUser.id,
        username: mockUser.username,
        email: mockUser.email,
        permissions: mockUser.permissions,
      },
    };
  }
}


