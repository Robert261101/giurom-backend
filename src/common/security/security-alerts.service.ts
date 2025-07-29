import { Injectable, Logger } from '@nestjs/common';

export enum SecurityEventType {
  BRUTE_FORCE_ATTEMPT = 'BRUTE_FORCE_ATTEMPT',
  SUSPICIOUS_LOGIN = 'SUSPICIOUS_LOGIN',
  TOKEN_THEFT_SUSPECTED = 'TOKEN_THEFT_SUSPECTED',
  MULTIPLE_FAILED_ATTEMPTS = 'MULTIPLE_FAILED_ATTEMPTS',
  UNUSUAL_ACTIVITY = 'UNUSUAL_ACTIVITY',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED'
}

export interface SecurityEvent {
  type: SecurityEventType;
  userId?: string;
  email?: string;
  ipAddress: string;
  userAgent: string;
  details: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  timestamp: Date;
}

@Injectable()
export class SecurityAlertsService {
  private readonly logger = new Logger(SecurityAlertsService.name);
  private recentEvents = new Map<string, SecurityEvent[]>();

  /**
   * Înregistrează un eveniment de securitate
   */
  async logSecurityEvent(event: SecurityEvent): Promise<void> {
    // Log în consolă cu culoare în funcție de severitate
    const severityColor = this.getSeverityColor(event.severity);
    this.logger.warn(
      `🚨 SECURITY ALERT [${event.severity}]: ${event.type} - ${event.details}`,
      {
        userId: event.userId,
        email: event.email,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        timestamp: event.timestamp
      }
    );

    // Stochează evenimentul pentru analiză
    const key = event.userId || event.email || event.ipAddress;
    if (key) {
      const userEvents = this.recentEvents.get(key) || [];
      userEvents.push(event);
      
      // Păstrează doar ultimele 50 de evenimente per utilizator
      if (userEvents.length > 50) {
        userEvents.splice(0, userEvents.length - 50);
      }
      
      this.recentEvents.set(key, userEvents);
    }

    // Verifică dacă trebuie să trimită alertă
    await this.checkAndSendAlert(event);
  }

  /**
   * Verifică dacă trebuie să trimită alertă bazată pe eveniment
   */
  private async checkAndSendAlert(event: SecurityEvent): Promise<void> {
    const key = event.userId || event.email || event.ipAddress;
    if (!key) return;

    const userEvents = this.recentEvents.get(key) || [];
    const recentEvents = userEvents.filter(e => 
      Date.now() - e.timestamp.getTime() < 60 * 60 * 1000 // Ultima oră
    );

    // Alert pentru evenimente critice
    if (event.severity === 'CRITICAL') {
      await this.sendCriticalAlert(event);
      return;
    }

    // Alert pentru multiple evenimente suspecte
    if (recentEvents.length >= 3) {
      const highSeverityEvents = recentEvents.filter(e => 
        e.severity === 'HIGH' || e.severity === 'CRITICAL'
      );
      
      if (highSeverityEvents.length >= 2) {
        await this.sendSuspiciousActivityAlert(key, recentEvents);
      }
    }

    // Alert pentru brute force
    const bruteForceEvents = recentEvents.filter(e => 
      e.type === SecurityEventType.BRUTE_FORCE_ATTEMPT
    );
    
    if (bruteForceEvents.length >= 5) {
      await this.sendBruteForceAlert(key, bruteForceEvents);
    }
  }

  /**
   * Trimite alertă critică
   */
  private async sendCriticalAlert(event: SecurityEvent): Promise<void> {
    const alertMessage = `
🚨 ALERTĂ CRITICĂ DE SECURITATE 🚨
Tip: ${event.type}
Utilizator: ${event.email || event.userId || 'Necunoscut'}
IP: ${event.ipAddress}
Detalii: ${event.details}
Timp: ${event.timestamp.toISOString()}
    `;

    this.logger.error(alertMessage);
    
    // Aici poți adăuga integrare cu servicii externe:
    // - Email notification
    // - Slack/Discord webhook
    // - SMS notification
    // - Webhook către sistemul de monitoring
  }

  /**
   * Trimite alertă pentru activitate suspectă
   */
  private async sendSuspiciousActivityAlert(key: string, events: SecurityEvent[]): Promise<void> {
    const alertMessage = `
⚠️ ACTIVITATE SUSPECTĂ DETECTATĂ ⚠️
Identificator: ${key}
Număr evenimente: ${events.length}
Ultimele evenimente:
${events.slice(-3).map(e => `- ${e.type} (${e.severity}): ${e.details}`).join('\n')}
    `;

    this.logger.warn(alertMessage);
  }

  /**
   * Trimite alertă pentru brute force
   */
  private async sendBruteForceAlert(key: string, events: SecurityEvent[]): Promise<void> {
    const alertMessage = `
🔒 ATAC BRUTE FORCE DETECTAT 🔒
Identificator: ${key}
Număr încercări: ${events.length}
IP: ${events[0]?.ipAddress}
Prima încercare: ${events[0]?.timestamp.toISOString()}
Ultima încercare: ${events[events.length - 1]?.timestamp.toISOString()}
    `;

    this.logger.error(alertMessage);
  }

  /**
   * Returnează culoarea pentru severitate
   */
  private getSeverityColor(severity: string): string {
    switch (severity) {
      case 'CRITICAL': return '\x1b[31m'; // Roșu
      case 'HIGH': return '\x1b[33m';     // Galben
      case 'MEDIUM': return '\x1b[36m';   // Cyan
      case 'LOW': return '\x1b[32m';      // Verde
      default: return '\x1b[0m';          // Reset
    }
  }

  /**
   * Obține evenimentele recente pentru un utilizator
   */
  getRecentEvents(key: string): SecurityEvent[] {
    return this.recentEvents.get(key) || [];
  }

  /**
   * Curăță evenimentele vechi (poate fi apelat periodic)
   */
  cleanupOldEvents(): void {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    
    for (const [key, events] of this.recentEvents.entries()) {
      const recentEvents = events.filter(e => e.timestamp.getTime() > oneHourAgo);
      if (recentEvents.length === 0) {
        this.recentEvents.delete(key);
      } else {
        this.recentEvents.set(key, recentEvents);
      }
    }
  }
} 