import { Injectable, Logger } from '@nestjs/common';

export interface UserBehavior {
  userId: string;
  loginCount: number;
  failedAttempts: number;
  lastLoginTime: Date;
  lastLoginIp: string;
  commonIps: string[];
  commonUserAgents: string[];
  loginTimes: Date[];
}

interface AnomalyScore {
  score: number; // 0-100
  factors: string[];
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

@Injectable()
export class AnomalyDetectionService {
  private readonly logger = new Logger(AnomalyDetectionService.name);
  private userBehaviors = new Map<string, UserBehavior>();

  /**
   * Analizează comportamentul utilizatorului și detectează anomalii
   */
  async detectAnomalies(
    userId: string, 
    action: 'LOGIN' | 'LOGIN_FAILED' | 'PASSWORD_CHANGE' | 'PROFILE_UPDATE',
    context: {
      ipAddress: string;
      userAgent: string;
      timestamp: Date;
      success: boolean;
    }
  ): Promise<AnomalyScore> {
    const behavior = this.getOrCreateUserBehavior(userId);
    const score = await this.calculateAnomalyScore(behavior, action, context);
    
    // Actualizează comportamentul utilizatorului
    this.updateUserBehavior(behavior, action, context);
    
    // Log anomalie dacă scorul este ridicat
    if (score.score > 70) {
      this.logger.warn(
        `Anomalie detectată pentru utilizatorul ${userId}: ${score.score}/100`,
        { factors: score.factors, severity: score.severity }
      );
    }
    
    return score;
  }

  /**
   * Calculează scorul de anomalie
   */
  private async calculateAnomalyScore(
    behavior: UserBehavior,
    action: string,
    context: any
  ): Promise<AnomalyScore> {
    const factors: string[] = [];
    let score = 0;

    // 1. Verifică IP-ul (30 puncte)
    if (!behavior.commonIps.includes(context.ipAddress)) {
      score += 30;
      factors.push('IP neobișnuit');
    }

    // 2. Verifică User Agent (20 puncte)
    if (!behavior.commonUserAgents.includes(context.userAgent)) {
      score += 20;
      factors.push('User Agent neobișnuit');
    }

    // 3. Verifică timpul de login (25 puncte)
    const hour = context.timestamp.getHours();
    const isUnusualTime = hour < 6 || hour > 23; // În afara orelor normale
    if (isUnusualTime) {
      score += 25;
      factors.push('Login la oră neobișnuită');
    }

    // 4. Verifică frecvența login-urilor (15 puncte)
    const recentLogins = behavior.loginTimes.filter(
      time => Date.now() - time.getTime() < 24 * 60 * 60 * 1000 // Ultima zi
    );
    
    if (recentLogins.length > 10) {
      score += 15;
      factors.push('Prea multe login-uri în ultima zi');
    }

    // 5. Verifică încercările eșuate (10 puncte)
    if (behavior.failedAttempts > 3) {
      score += 10;
      factors.push('Multiple încercări eșuate');
    }

    // Determină severitatea
    let severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
    if (score >= 80) severity = 'CRITICAL';
    else if (score >= 60) severity = 'HIGH';
    else if (score >= 40) severity = 'MEDIUM';

    return { score, factors, severity };
  }

  /**
   * Obține sau creează comportamentul utilizatorului
   */
  private getOrCreateUserBehavior(userId: string): UserBehavior {
    if (!this.userBehaviors.has(userId)) {
      this.userBehaviors.set(userId, {
        userId,
        loginCount: 0,
        failedAttempts: 0,
        lastLoginTime: new Date(),
        lastLoginIp: '',
        commonIps: [],
        commonUserAgents: [],
        loginTimes: []
      });
    }
    
    return this.userBehaviors.get(userId)!;
  }

  /**
   * Actualizează comportamentul utilizatorului
   */
  private updateUserBehavior(
    behavior: UserBehavior,
    action: string,
    context: any
  ): void {
    switch (action) {
      case 'LOGIN':
        behavior.loginCount++;
        behavior.lastLoginTime = context.timestamp;
        behavior.lastLoginIp = context.ipAddress;
        behavior.loginTimes.push(context.timestamp);
        
        // Adaugă IP-ul la lista comună dacă nu există
        if (!behavior.commonIps.includes(context.ipAddress)) {
          behavior.commonIps.push(context.ipAddress);
        }
        
        // Adaugă User Agent la lista comună dacă nu există
        if (!behavior.commonUserAgents.includes(context.userAgent)) {
          behavior.commonUserAgents.push(context.userAgent);
        }
        
        // Resetează încercările eșuate la login reușit
        behavior.failedAttempts = 0;
        break;
        
      case 'LOGIN_FAILED':
        behavior.failedAttempts++;
        break;
    }

    // Păstrează doar ultimele 100 de login-uri
    if (behavior.loginTimes.length > 100) {
      behavior.loginTimes = behavior.loginTimes.slice(-100);
    }

    // Păstrează doar ultimele 10 IP-uri și User Agents
    if (behavior.commonIps.length > 10) {
      behavior.commonIps = behavior.commonIps.slice(-10);
    }
    
    if (behavior.commonUserAgents.length > 10) {
      behavior.commonUserAgents = behavior.commonUserAgents.slice(-10);
    }
  }

  /**
   * Verifică dacă o acțiune este suspectă
   */
  async isSuspiciousAction(
    userId: string,
    action: string,
    context: any
  ): Promise<boolean> {
    const anomalyScore = await this.detectAnomalies(userId, action as any, context);
    return anomalyScore.score > 70; // Consideră suspect dacă scorul > 70
  }

  /**
   * Obține comportamentul unui utilizator
   */
  getUserBehavior(userId: string): UserBehavior | undefined {
    return this.userBehaviors.get(userId);
  }

  /**
   * Curăță comportamentele vechi (poate fi apelat periodic)
   */
  cleanupOldBehaviors(): void {
    const oneMonthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    
    for (const [userId, behavior] of this.userBehaviors.entries()) {
      const lastActivity = behavior.lastLoginTime.getTime();
      if (lastActivity < oneMonthAgo) {
        this.userBehaviors.delete(userId);
      }
    }
  }

  /**
   * Resetează comportamentul unui utilizator (la reset password, etc.)
   */
  resetUserBehavior(userId: string): void {
    this.userBehaviors.delete(userId);
    this.logger.log(`Comportament resetat pentru utilizatorul ${userId}`);
  }
} 