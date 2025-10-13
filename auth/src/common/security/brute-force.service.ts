import { Injectable, Logger } from '@nestjs/common';

interface FailedAttempt {
  count: number;
  blockedUntil: number;
  lastAttempt: number;
}

@Injectable()
export class BruteForceProtectionService {
  private readonly logger = new Logger(BruteForceProtectionService.name);
  private failedAttempts = new Map<string, FailedAttempt>();
  
  // Configurare
  private readonly MAX_ATTEMPTS = 5; // Maxim 5 încercări
  private readonly BLOCK_DURATION = 15 * 60 * 1000; // 15 minute
  private readonly RESET_TIME = 60 * 60 * 1000; // 1 oră pentru reset

  /**
   * Verifică dacă identifier-ul este blocat
   */
  async checkBruteForce(identifier: string): Promise<boolean> {
    const attempts = this.failedAttempts.get(identifier);
    
    if (!attempts) {
      return true; // Prima încercare
    }

    // Verifică dacă este blocat
    if (attempts.blockedUntil > Date.now()) {
      const remainingTime = Math.ceil((attempts.blockedUntil - Date.now()) / 1000 / 60);
      this.logger.warn(`Cont blocat pentru ${identifier} - mai sunt ${remainingTime} minute`);
      throw new Error(`Cont blocat temporar. Încearcă din nou în ${remainingTime} minute.`);
    }

    // Reset dacă a trecut suficient timp
    if (Date.now() - attempts.lastAttempt > this.RESET_TIME) {
      this.failedAttempts.delete(identifier);
      return true;
    }

    return true;
  }

  /**
   * Înregistrează o încercare eșuată
   */
  async recordFailedAttempt(identifier: string): Promise<void> {
    const attempts = this.failedAttempts.get(identifier) || {
      count: 0,
      blockedUntil: 0,
      lastAttempt: 0
    };

    attempts.count++;
    attempts.lastAttempt = Date.now();

    // Blochează după MAX_ATTEMPTS încercări
    if (attempts.count >= this.MAX_ATTEMPTS) {
      attempts.blockedUntil = Date.now() + this.BLOCK_DURATION;
      this.logger.warn(`Cont blocat pentru ${identifier} după ${attempts.count} încercări eșuate`);
    }

    this.failedAttempts.set(identifier, attempts);
  }

  /**
   * Resetează încercările pentru un identifier (la login reușit)
   */
  async resetAttempts(identifier: string): Promise<void> {
    this.failedAttempts.delete(identifier);
    this.logger.log(`Reset încercări pentru ${identifier}`);
  }

  /**
   * Curăță încercările expirate (poate fi apelat periodic)
   */
  async cleanupExpiredAttempts(): Promise<void> {
    const now = Date.now();
    for (const [identifier, attempts] of this.failedAttempts.entries()) {
      if (now - attempts.lastAttempt > this.RESET_TIME) {
        this.failedAttempts.delete(identifier);
      }
    }
  }
} 