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
import { TwoFactorAuthService } from './otp-auth.service';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { RefreshTokenDto } from '../auth/dto/refresh-token.dto';
import { TokenService } from '../common/token.service';

@ApiTags('Autentificare OTP')
@Controller('otp')
export class TwoFactorAuthController {
  constructor(
    private readonly twoFactorAuthService: TwoFactorAuthService,
    private readonly tokenService: TokenService
  ) {}

  @ApiOperation({ 
    summary: 'Trimite OTP pe telefon',
    description: 'Trimite un cod OTP de 6 cifre pe numărul de telefon asociat email-ului sau telefonului'
  })
  @ApiBody({ type: SendOtpDto })
  @ApiResponse({ 
    status: 200, 
    description: 'OTP trimis cu succes',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'OTP trimis cu succes pe numărul 0787448331'
        }
      }
    }
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Utilizatorul nu a fost găsit sau nu are număr de telefon'
  })
  @HttpCode(HttpStatus.OK)
  @Post('send-otp')
  sendOtp(@Body() sendOtpDto: SendOtpDto) {
    return this.twoFactorAuthService.sendOtp(sendOtpDto.identifier);
  }

  @ApiOperation({ 
    summary: 'Autentificare cu OTP',
    description: 'Autentifică utilizatorul cu email/telefon și codul OTP primit pe telefon'
  })
  @ApiBody({ type: VerifyOtpDto })
  @ApiResponse({ 
    status: 200, 
    description: 'Autentificare reușită',
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
  @Post('login')
  verifyOtp(@Body() verifyOtpDto: VerifyOtpDto) {
    return this.twoFactorAuthService.verifyOtp(verifyOtpDto.identifier, verifyOtpDto.otp);
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