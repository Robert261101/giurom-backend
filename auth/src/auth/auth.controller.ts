import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Request,
  UseGuards,
  BadRequestException,
  Logger
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
import {
  RegisterSupplierCompanyLookupDto,
  RegisterSupplierDto,
} from './dto/register-supplier.dto';
import {
  RegisterClientCompanyLookupDto,
  RegisterClientDto,
} from './dto/register-client.dto';
import { HttpService } from '@nestjs/axios';
import { logAction } from '../common/logging.util';

@ApiTags('Autentificare')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private authService: AuthService,
    private readonly httpService: HttpService
  ) {}

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
  async validateIdentifier(@Body() validateIdentifierDto: ValidateIdentifierDto, @Request() req: any) {
    this.logger.log(`Validating identifier: ${validateIdentifierDto.identifier}`);
    try {
      const result = await this.authService.validateIdentifier(validateIdentifierDto.identifier);
      await logAction(
        this.httpService,
        this.logger,
        'validate_identifier',
        'success',
        0,
        'auth',
        0,
        { identifier: validateIdentifierDto.identifier },
        undefined,
        req.ip,
        req.headers['user-agent']
      );
      return result;
    } catch (error) {
      await logAction(
        this.httpService,
        this.logger,
        'validate_identifier',
        'failure',
        0,
        'auth',
        0,
        { identifier: validateIdentifierDto.identifier, error: error.message },
        undefined,
        req.ip,
        req.headers['user-agent']
      );
      this.logger.warn('Logging-service indisponibil.');
      throw error;
    }
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
  async signIn(@Body() signInDto: SignInDto, @Request() req: any) {
    this.logger.log(`Login attempt for: ${signInDto.identifier}`);
    try {
      const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.headers['user-agent'] || 'unknown';
      
      const result = await this.authService.signIn(
        signInDto.identifier, 
        signInDto.password,
        ipAddress,
        userAgent
      );
      
      await logAction(
        this.httpService,
        this.logger,
        'login',
        'success',
        0,
        'auth',
        0,
        { identifier: signInDto.identifier },
        undefined,
        req.ip,
        req.headers['user-agent']
      );
      this.logger.log(`Login successful for: ${signInDto.identifier}`);
      return result;
    } catch (error) {
      await logAction(
        this.httpService,
        this.logger,
        'login',
        'failure',
        0,
        'auth',
        0,
        { identifier: signInDto.identifier, error: error.message },
        undefined,
        req.ip,
        req.headers['user-agent']
      );
      this.logger.error(`Login failed for ${signInDto.identifier}: ${error.message}`);
      this.logger.warn('Logging-service indisponibil.');
      throw error;
    }
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
  async refreshToken(@Body() refreshTokenDto: RefreshTokenDto, @Request() req: any) {
    this.logger.log(`Refresh token attempt`);
    try {
      const result = await this.authService.refreshToken(refreshTokenDto.refresh_token);
      await logAction(
        this.httpService,
        this.logger,
        'refresh_token',
        'success',
        0,
        'auth',
        0,
        undefined,
        undefined,
        req.ip,
        req.headers['user-agent']
      );
      this.logger.log(`Token refreshed successfully`);
      return result;
    } catch (error) {
      await logAction(
        this.httpService,
        this.logger,
        'refresh_token',
        'failure',
        0,
        'auth',
        0,
        { error: error.message },
        undefined,
        req.ip,
        req.headers['user-agent']
      );
      this.logger.error(`Token refresh failed: ${error.message}`);
      this.logger.warn('Logging-service indisponibil.');
      throw error;
    }
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
  async logout(@Body() logoutDto: LogoutDto, @Request() req: any) {
    this.logger.log(`Logout attempt`);
    try {
      const result = await this.authService.logout(logoutDto.token);
      await logAction(
        this.httpService,
        this.logger,
        'logout',
        'success',
        0,
        'auth',
        0,
        undefined,
        undefined,
        req.ip,
        req.headers['user-agent']
      );
      this.logger.log(`Logout successful`);
      return result;
    } catch (error) {
      await logAction(
        this.httpService,
        this.logger,
        'logout',
        'failure',
        0,
        'auth',
        0,
        { error: error.message },
        undefined,
        req.ip,
        req.headers['user-agent']
      );
      this.logger.error(`Logout failed: ${error.message}`);
      this.logger.warn('Logging-service indisponibil.');
      throw error;
    }
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
  async revokeAllUserTokens(@Request() req: any) {
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) {
      throw new BadRequestException('ID utilizator invalid');
    }
    
    this.logger.log(`Revoking all tokens for user: ${userId}`);
    try {
      const result = await this.authService.revokeAllUserTokens(userId);
      await logAction(
        this.httpService,
        this.logger,
        'revoke_all_tokens',
        'success',
        req.user?.sub || 0,
        'auth',
        userId,
        undefined,
        undefined,
        req.ip,
        req.headers['user-agent']
      );
      this.logger.log(`All tokens revoked for user: ${userId}`);
      return result;
    } catch (error) {
      await logAction(
        this.httpService,
        this.logger,
        'revoke_all_tokens',
        'failure',
        req.user?.sub || 0,
        'auth',
        userId,
        { error: error.message },
        undefined,
        req.ip,
        req.headers['user-agent']
      );
      this.logger.error(`Failed to revoke tokens for user ${userId}: ${error.message}`);
      this.logger.warn('Logging-service indisponibil.');
      throw error;
    }
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
  async getProfile(@Request() req: any) {
    this.logger.log(`Getting profile for user: ${req.user?.sub}`);
    try {
      const result = req.user;
      await logAction(
        this.httpService,
        this.logger,
        'get_profile',
        'success',
        req.user?.sub || 0,
        'auth',
        req.user?.sub || 0,
        undefined,
        undefined,
        req.ip,
        req.headers['user-agent']
      );
      return result;
    } catch (error) {
      await logAction(
        this.httpService,
        this.logger,
        'get_profile',
        'failure',
        req.user?.sub || 0,
        'auth',
        req.user?.sub || 0,
        { error: error.message },
        undefined,
        req.ip,
        req.headers['user-agent']
      );
      this.logger.error(`Failed to get profile for user ${req.user?.sub}: ${error.message}`);
      this.logger.warn('Logging-service indisponibil.');
      throw error;
    }
  }

  @ApiOperation({
    summary: 'Caută datele firmei după CUI (proxy ANAF, public)',
    description:
      'Normalizează CUI-ul, interoghează serviciul oficial ANAF și returnează un snapshot intern normalizat plus un token semnat care dovedește proveniența datelor',
  })
  @ApiBody({ type: RegisterSupplierCompanyLookupDto })
  @HttpCode(HttpStatus.OK)
  @Post('register/supplier/company-lookup')
  lookupRegisterSupplierCompany(@Body() dto: RegisterSupplierCompanyLookupDto) {
    return this.authService.lookupRegisterSupplierCompany(dto.cui);
  }

  @ApiOperation({
    summary: 'Înregistrare cont furnizor (public)',
    description:
      'Creează compania, locația principală, furnizorul, angajatul reprezentant, contul utilizator și rolul furnizor, cu rollback compensatoriu la eșec',
  })
  @ApiBody({ type: RegisterSupplierDto })
  @HttpCode(HttpStatus.CREATED)
  @Post('register/supplier')
  registerSupplier(@Body() dto: RegisterSupplierDto) {
    return this.authService.registerSupplier(dto);
  }

  @ApiOperation({
    summary: 'Caută datele firmei după CUI pentru înregistrare client (proxy ANAF, public)',
    description:
      'Reutilizează același lookup ANAF ca la înregistrarea furnizorului',
  })
  @ApiBody({ type: RegisterClientCompanyLookupDto })
  @HttpCode(HttpStatus.OK)
  @Post('register/client/company-lookup')
  lookupRegisterClientCompany(@Body() dto: RegisterClientCompanyLookupDto) {
    return this.authService.lookupRegisterClientCompany(dto.cui);
  }

  @ApiOperation({
    summary: 'Înregistrare cont client (public)',
    description:
      'Creează compania (company_type=client), locația principală, angajatul reprezentant, contul utilizator și rolul client-admin, cu rollback compensatoriu la eșec. Nu creează supplier.',
  })
  @ApiBody({ type: RegisterClientDto })
  @HttpCode(HttpStatus.CREATED)
  @Post('register/client')
  registerClient(@Body() dto: RegisterClientDto) {
    return this.authService.registerClient(dto);
  }
}