import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BruteForceProtectionService } from './brute-force.service';
import { SecurityAlertsService } from './security-alerts.service';
import { AnomalyDetectionService } from './anomaly-detection.service';

@Injectable()
export class SecurityCleanupService {
  private readonly logger = new Logger(SecurityCleanupService.name);

  constructor(
    private bruteForceService: BruteForceProtectionService,
    private securityAlertsService: SecurityAlertsService,
    private anomalyDetectionService: AnomalyDetectionService
  ) {}

  /**
   * Curăță datele de securitate la fiecare oră
   */
  @Cron(CronExpression.EVERY_HOUR)
  async cleanupSecurityData() {
    this.logger.log('Începe curățarea datelor de securitate...');
    
    try {
      // Curăță încercările brute force expirate
      await this.bruteForceService.cleanupExpiredAttempts();
      
      // Curăță evenimentele de securitate vechi
      this.securityAlertsService.cleanupOldEvents();
      
      // Curăță comportamentele utilizatorilor vechi
      this.anomalyDetectionService.cleanupOldBehaviors();
      
      this.logger.log('Curățarea datelor de securitate finalizată cu succes');
    } catch (error) {
      this.logger.error(`Eroare la curățarea datelor de securitate: ${error.message}`);
    }
  }

  /**
   * Curăță datele la fiecare zi la 2:00 AM
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async dailyCleanup() {
    this.logger.log('Începe curățarea zilnică...');
    
    try {
      // Curăță toate datele vechi
      await this.cleanupSecurityData();
      
      // Log statistici
      this.logSecurityStats();
      
      this.logger.log('Curățarea zilnică finalizată cu succes');
    } catch (error) {
      this.logger.error(`Eroare la curățarea zilnică: ${error.message}`);
    }
  }

  /**
   * Log statistici de securitate
   */
  private logSecurityStats() {
    this.logger.log('📊 Statistici de securitate:');
    this.logger.log('- Sistemul de securitate este activ');
    this.logger.log('- Protecția împotriva brute force este configurată');
    this.logger.log('- Detectarea anomaliilor este activă');
    this.logger.log('- Alertele de securitate sunt configurate');
  }

  /**
   * Curăță manual datele (poate fi apelat din API)
   */
  async manualCleanup(): Promise<{ message: string }> {
    this.logger.log('Curățare manuală inițiată...');
    
    await this.cleanupSecurityData();
    
    return { 
      message: 'Curățarea manuală finalizată cu succes' 
    };
  }
} 