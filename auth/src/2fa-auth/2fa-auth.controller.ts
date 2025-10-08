import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiBody 
} from '@nestjs/swagger';
import { TwoFactorAuthService } from './2fa-auth.service';
import { Step1LoginDto } from './dto/step1-login.dto';
import { Step2VerifyDto } from './dto/step2-verify.dto';
import { RefreshTokenDto } from '../auth/dto/refresh-token.dto';
import { TokenService } from '../common/token.service';

@ApiTags('Autentificare 2FA')
@Controller('2fa')
export class TwoFactorAuthController {
  constructor(
    private readonly twoFactorAuthService: TwoFactorAuthService,
    private readonly tokenService: TokenService
  ) {}

  @ApiOperation({ 
    summary: 'Pasul 1: Autentificare cu credențiale și trimitere OTP',
    description: 'Verifică email/telefon și parola, apoi trimite OTP pe telefon dacă credențialele sunt corecte'
  })
  @ApiBody({ type: Step1LoginDto })
  @ApiResponse({ 
    status: 200, 
    description: 'Credențiale valide, OTP trimis cu succes',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'OTP trimis cu succes pe numărul 0787448331. Introduceți codul pentru a finaliza autentificarea.'
        },
        userId: {
          type: 'number',
          example: 1,
          description: 'ID-ul utilizatorului pentru pasul 2'
        }
      }
    }
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Credențiale invalide'
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Utilizatorul nu are număr de telefon asociat'
  })
  @HttpCode(HttpStatus.OK)
  @Post('step1')
  step1Login(@Body() step1LoginDto: Step1LoginDto) {
    return this.twoFactorAuthService.step1Login(step1LoginDto.identifier, step1LoginDto.password);
  }

  @ApiOperation({ 
    summary: 'Pasul 2: Verificare OTP și obținere JWT token',
    description: 'Verifică codul OTP și returnează JWT token pentru autentificare completă'
  })
  @ApiBody({ type: Step2VerifyDto })
  @ApiResponse({ 
    status: 200, 
    description: 'Autentificare completă reușită',
    schema: {
      type: 'object',
      properties: {
        access_token: {
          type: 'string',
          example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
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
    description: 'OTP invalid, incorect sau expirat'
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Utilizatorul nu a fost găsit'
  })
  @HttpCode(HttpStatus.OK)
  @Post('step2')
  async step2Verify(@Body() step2VerifyDto: Step2VerifyDto) {
    try {
      console.log(`🔍 DEBUG Controller: Primit request pentru userId: ${step2VerifyDto.userId}, otp: ${step2VerifyDto.otp}`);
      const result = await this.twoFactorAuthService.step2Verify(step2VerifyDto.userId, step2VerifyDto.otp);
      console.log(`🔍 DEBUG Controller: Rezultat generat: ${JSON.stringify(result)}`);
      return result;
    } catch (error) {
      console.error(`🔍 DEBUG Controller: Eroare în step2Verify: ${error.message}`);
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
  refreshToken(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.tokenService.refreshAccessToken(refreshTokenDto.refresh_token);
  }
} 