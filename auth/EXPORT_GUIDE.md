# 🚀 Ghid Export Guards - Veziv Auth2

## 📋 Prezentare Generală

Sistemul de guards din Veziv Auth2 este pregătit pentru export și utilizare în alte microservicii. Oferă protecție completă pentru rute cu autentificare, roluri și permisiuni.

## 🔧 Componente Disponibile

### Guards
- **AuthGuard** - Verifică autentificarea JWT
- **RolesGuard** - Verifică rolurile și permisiunile

### Decorators
- **@Roles()** - Specifică rolurile necesare
- **@Permissions()** - Specifică permisiunile necesare

### Module
- **GuardsModule** - Modulul complet pentru export

## 📦 Instalare în Alt Microserviciu

### Pasul 1: Importă GuardsModule
```typescript
// În app.module.ts al microserviciului
import { GuardsModule } from 'veziv-auth2/guards';

@Module({
  imports: [
    GuardsModule,
    // alte module...
  ],
})
export class AppModule {}
```

### Pasul 2: Folosește Guards în Controllers
```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard, RolesGuard, Roles, Permissions } from 'veziv-auth2/guards';

@Controller('products')
export class ProductsController {
  
  // Rute publice
  @Get('public')
  getPublicProducts() {
    return ['product1', 'product2'];
  }

  // Rute protejate - doar autentificare
  @UseGuards(AuthGuard)
  @Get('protected')
  getProtectedProducts() {
    return ['premium-product1', 'premium-product2'];
  }

  // Rute cu roluri
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  @Get('admin')
  getAdminProducts() {
    return ['admin-product1', 'admin-product2'];
  }

  // Rute cu permisiuni
  @UseGuards(AuthGuard, RolesGuard)
  @Permissions('products:read', 'products:write')
  @Get('detailed')
  getDetailedProducts() {
    return ['detailed-product1', 'detailed-product2'];
  }

  // Rute cu roluri și permisiuni
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin')
  @Permissions('products:delete')
  @Delete(':id')
  deleteProduct(@Param('id') id: string) {
    return { message: `Product ${id} deleted` };
  }
}
```

## 🔐 Tipuri de Protecție

### 1. **Autentificare Simplă**
```typescript
@UseGuards(AuthGuard)
@Get('profile')
getProfile(@Request() req) {
  return req.user; // Conține sub, email, roles, permissions
}
```

### 2. **Protecție cu Roluri**
```typescript
@UseGuards(AuthGuard, RolesGuard)
@Roles('admin', 'manager')
@Get('admin-only')
adminOnly() {
  return 'Doar admin și manager';
}
```

### 3. **Protecție cu Permisiuni**
```typescript
@UseGuards(AuthGuard, RolesGuard)
@Permissions('users:read', 'users:write')
@Get('users')
getUsers() {
  return 'Utilizatori cu permisiuni';
}
```

### 4. **Protecție Combinată**
```typescript
@UseGuards(AuthGuard, RolesGuard)
@Roles('admin')
@Permissions('system:config')
@Post('config')
updateConfig() {
  return 'Configurare actualizată';
}
```

## 📊 Structura Token JWT

Token-ul JWT conține:
```json
{
  "sub": 1,
  "email": "admin@example.com",
  "roles": ["admin", "user"],
  "permissions": ["users:read", "users:write", "products:delete"],
  "iat": 1640995200,
  "exp": 1640996100
}
```

## 🚨 Mesaje de Eroare

### AuthGuard
- `Token de autentificare lipsă` - Nu este furnizat token
- `Token invalidat prin logout` - Token-ul a fost invalidat
- `Token invalid` - Token-ul este expirat sau invalid

### RolesGuard
- `Utilizatorul nu este autentificat` - Nu există user în request
- `Acces interzis. Roluri necesare: admin, manager` - Roluri insuficiente
- `Acces interzis. Permisiuni necesare: users:read` - Permisiuni insuficiente

## 🔧 Configurare

### Variabile de Mediu Necesare
```env
# În microserviciul care folosește guards
JWT_SECRET=your-super-secret-key
JWT_ACCESS_EXPIRES_IN=15m
```

### Configurare Avansată
```typescript
// În microserviciul care folosește guards
import { GuardsModule } from 'veziv-auth2/guards';

@Module({
  imports: [
    GuardsModule.forRoot({
      jwtSecret: process.env.JWT_SECRET,
      jwtExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN,
    }),
  ],
})
export class AppModule {}
```

## 📝 Exemple Complete

### Controller cu Toate Tipurile de Protecție
```typescript
import { Controller, Get, Post, Delete, UseGuards, Request } from '@nestjs/common';
import { AuthGuard, RolesGuard, Roles, Permissions } from 'veziv-auth2/guards';

@Controller('api')
export class ApiController {

  // Rute publice
  @Get('health')
  health() {
    return { status: 'OK' };
  }

  // Rute protejate
  @UseGuards(AuthGuard)
  @Get('profile')
  getProfile(@Request() req) {
    return {
      id: req.user.sub,
      email: req.user.email,
      roles: req.user.roles,
      permissions: req.user.permissions
    };
  }

  // Rute cu roluri
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin')
  @Get('admin-stats')
  getAdminStats() {
    return { users: 100, products: 500 };
  }

  // Rute cu permisiuni
  @UseGuards(AuthGuard, RolesGuard)
  @Permissions('users:write')
  @Post('users')
  createUser() {
    return { message: 'User created' };
  }

  // Rute cu roluri și permisiuni
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  @Permissions('system:config')
  @Post('config')
  updateConfig() {
    return { message: 'Config updated' };
  }
}
```

### Middleware Personalizat
```typescript
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggingMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    if (req.user) {
      console.log(`User ${req.user.email} accessing ${req.path}`);
    }
    next();
  }
}
```

## 🎯 Best Practices

### 1. **Ordinea Guards**
```typescript
// Corect - AuthGuard înainte de RolesGuard
@UseGuards(AuthGuard, RolesGuard)
@Roles('admin')
getAdminData() {}

// Greșit - RolesGuard înainte de AuthGuard
@UseGuards(RolesGuard, AuthGuard)
@Roles('admin')
getAdminData() {}
```

### 2. **Decoratori Multiple**
```typescript
// Corect - Folosește array pentru multiple roluri
@Roles('admin', 'manager', 'supervisor')

// Corect - Folosește array pentru multiple permisiuni
@Permissions('users:read', 'users:write', 'users:delete')
```

### 3. **Gestionarea Erorilor**
```typescript
import { ExceptionFilter, Catch, ArgumentsHost, HttpStatus } from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception.message.includes('Acces interzis')) {
      return response.status(HttpStatus.FORBIDDEN).json({
        error: 'Forbidden',
        message: exception.message,
        timestamp: new Date().toISOString(),
      });
    }

    // Alte erori...
  }
}
```

## 🔍 Debugging

### Verifică Token-ul
```typescript
@UseGuards(AuthGuard)
@Get('debug')
debugToken(@Request() req) {
  return {
    user: req.user,
    headers: req.headers.authorization,
    timestamp: new Date().toISOString()
  };
}
```

### Log Token Details
```typescript
@UseGuards(AuthGuard)
@Get('token-info')
tokenInfo(@Request() req) {
  console.log('Token payload:', req.user);
  console.log('User roles:', req.user.roles);
  console.log('User permissions:', req.user.permissions);
  
  return {
    userId: req.user.sub,
    email: req.user.email,
    roles: req.user.roles,
    permissions: req.user.permissions
  };
}
```

## 📞 Suport

Pentru întrebări sau probleme:
1. Verifică dacă JWT_SECRET este configurat corect
2. Verifică dacă token-ul conține rolurile și permisiunile necesare
3. Verifică ordinea guards-urilor
4. Consultă log-urile pentru detalii despre erori

---

**🎉 Sistemul de guards este gata pentru export și utilizare în alte microservicii!** 