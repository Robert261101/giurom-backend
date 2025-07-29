import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Request,
  UseGuards,
  BadRequestException
} from '@nestjs/common';
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiBody,
  ApiBearerAuth
} from '@nestjs/swagger';
import { AuthGuard } from '../guards/auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../guards/decorators/roles.decorator';
import { AuthService } from './auth.service';
import { SignInDto } from './dto/sign-in.dto';
import { LogoutDto } from './dto/logout.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ValidateIdentifierDto } from './dto/validate-identifier.dto';

@ApiTags('Autentificare')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @ApiOperation({ 
    summary: 'Validează email-ul sau telefonul utilizatorului',
    description: 'Verifică dacă un email sau număr de telefon există în sistem, fără a verifica parola'
  })
  @ApiBody({ type: ValidateIdentifierDto })
  @ApiResponse({ 
    status: 200, 
    description: 'Validare reușită',
    schema: {
      type: 'object',
      properties: {
        exists: {
          type: 'boolean',
          example: true,
          description: 'Dacă utilizatorul există în sistem'
        },
        type: {
          type: 'string',
          enum: ['email', 'phone'],
          example: 'email',
          description: 'Tipul de identificator (email sau telefon)'
        }
      }
    }
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Format invalid pentru email sau telefon'
  })
  @HttpCode(HttpStatus.OK)
  @Post('validate-identifier')
  validateIdentifier(@Body() validateIdentifierDto: ValidateIdentifierDto) {
    return this.authService.validateIdentifier(validateIdentifierDto.identifier);
  }

  @ApiOperation({ 
    summary: 'Autentificare utilizator',
    description: 'Autentifică un utilizator cu email sau telefon și parolă, returnează access token și refresh token'
  })
  @ApiBody({ type: SignInDto })
  @ApiResponse({ 
    status: 200, 
    description: 'Autentificare reușită',
    schema: {
      type: 'object',
      properties: {
        access_token: {
          type: 'string',
          example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsImVtYWlsIjoiam9obkBleGFtcGxlLmNvbSIsInJvbGVzIjpbInVzZXIiXSwicGVybWlzc2lvbnMiOlsicmVhZDp1c2VycyJdLCJpYXQiOjE2MzQ1NjgwMDAsImV4cCI6MTYzNDU2ODA2MH0.example'
        },
        refresh_token: {
          type: 'string',
          example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.refresh_token_example'
        }
      }
    }
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Credențiale invalide'
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Format invalid pentru email sau telefon'
  })
  @HttpCode(HttpStatus.OK)
  @Post('login')
  signIn(@Body() signInDto: SignInDto, @Request() req) {
    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    
    return this.authService.signIn(
      signInDto.identifier, 
      signInDto.password,
      ipAddress,
      userAgent
    );
  }

  @ApiOperation({ 
    summary: 'Reînnoiește access token-ul',
    description: 'Folosește refresh token-ul pentru a obține un access token nou fără să te loghezi din nou'
  })
  @ApiBody({ type: RefreshTokenDto })
  @ApiResponse({ 
    status: 200, 
    description: 'Token-uri reînnoite cu succes',
    schema: {
      type: 'object',
      properties: {
        access_token: {
          type: 'string',
          example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.new_access_token_example'
        },
        refresh_token: {
          type: 'string',
          example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.new_refresh_token_example'
        }
      }
    }
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Refresh token invalid'
  })
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  refreshToken(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshToken(refreshTokenDto.refresh_token);
  }

  @ApiOperation({ 
    summary: 'Logout utilizator',
    description: 'Invalidă JWT token-ul curent și revocă toate sesiunile utilizatorului'
  })
  @ApiBody({ type: LogoutDto })
  @ApiResponse({ 
    status: 200, 
    description: 'Logout reușit',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Logout realizat cu succes - toate sesiunile au fost închise'
        }
      }
    }
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Token invalid'
  })
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  logout(@Body() logoutDto: LogoutDto) {
    return this.authService.logout(logoutDto.token);
  }

  @ApiOperation({ 
    summary: 'Revocă toate token-urile unui utilizator (Admin)',
    description: 'Revocă toate token-urile active pentru un utilizator specific (pentru admin)'
  })
  @ApiBearerAuth()
  @ApiResponse({ 
    status: 200, 
    description: 'Token-uri revocate cu succes',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Toate token-urile pentru utilizatorul 1 au fost revocate'
        }
      }
    }
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Token invalid sau lipsă'
  })
  @ApiResponse({ 
    status: 403, 
    description: 'Acces interzis - roluri insuficiente'
  })
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin')
  @Post('revoke/:userId')
  revokeAllUserTokens(@Request() req) {
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) {
      throw new BadRequestException('ID utilizator invalid');
    }
    return this.authService.revokeAllUserTokens(userId);
  }

  @ApiOperation({ 
    summary: 'Obține profilul utilizatorului',
    description: 'Returnează informațiile despre utilizatorul autentificat din JWT token'
  })
  @ApiBearerAuth()
  @ApiResponse({ 
    status: 200, 
    description: 'Profilul utilizatorului',
    schema: {
      type: 'object',
      properties: {
        sub: { type: 'number', example: 1 },
        email: { type: 'string', example: 'john@example.com' },
        roles: { 
          type: 'array', 
          items: { type: 'string' },
          example: ['user', 'admin']
        },
        permissions: { 
          type: 'array', 
          items: { type: 'string' },
          example: ['read:users', 'write:users']
        }
      }
    }
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Token invalid sau lipsă'
  })
  @UseGuards(AuthGuard)
  @Get('profile')
  getProfile(@Request() req) {
    return req.user;
  }
} 