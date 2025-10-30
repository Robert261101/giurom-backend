import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

import { BruteForceProtectionService } from './brute-force.service';
import { TokenRotationService } from './token-rotation.service';
import { SecurityAlertsService } from './security-alerts.service';
import { AnomalyDetectionService } from './anomaly-detection.service';
import { SecurityCleanupService } from './cleanup.service';

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        global: true,
        secret: configService.get<string>('JWT_SECRET') || 'your-secret-key',
        signOptions: { 
          expiresIn: configService.get<string>('JWT_ACCESS_EXPIRES_IN') || '24h' 
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [
    BruteForceProtectionService,
    TokenRotationService,
    SecurityAlertsService,
    AnomalyDetectionService,
    SecurityCleanupService,
  ],
  exports: [
    BruteForceProtectionService,
    TokenRotationService,
    SecurityAlertsService,
    AnomalyDetectionService,
    SecurityCleanupService,
  ],
})
export class SecurityModule {} 