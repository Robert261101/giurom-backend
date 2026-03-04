import * as pathModule from 'path';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PushSubscriptionEntity } from '../push-subscription.entity';

// Firebase Admin este importat dinamic; tipul e any ca să nu ceară @types/firebase-admin
export interface WebPushPayload {
  title: string;
  body?: string;
  data?: Record<string, string>;
}

@Injectable()
export class PushService implements OnModuleInit {
  private readonly logger = new Logger(PushService.name);
  private messaging: { sendEachForMulticast: (msg: any) => Promise<any> } | null = null;

  constructor(
    @InjectRepository(PushSubscriptionEntity)
    private readonly repo: Repository<PushSubscriptionEntity>,
  ) {}

  onModuleInit() {
    this.initFirebase();
  }

  private initFirebase() {
    const path = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

    if (!path && !json) {
      this.logger.warn(
        'FCM dezactivat: lipsește FIREBASE_SERVICE_ACCOUNT_PATH sau FIREBASE_SERVICE_ACCOUNT_JSON',
      );
      return;
    }

    try {
      let admin: any;
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        admin = require('firebase-admin');
      } catch {
        // Pe server Node poate căuta module doar din anumite căi; încercăm din cwd (root-ul proiectului)
        const cwdModule = pathModule.join(process.cwd(), 'node_modules', 'firebase-admin');
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        admin = require(cwdModule);
      }
      if (admin.apps?.length) {
        this.messaging = admin.messaging();
        this.logger.log('FCM folosește aplicația Firebase existentă');
        return;
      }
      let credentials: object;
      if (path) {
        const fs = require('fs');
        const resolvedPath = pathModule.isAbsolute(path) ? path : pathModule.join(process.cwd(), path);
        if (!fs.existsSync(resolvedPath)) {
          this.logger.error(
            `FCM: fișierul Service Account nu există la ${resolvedPath} (cwd=${process.cwd()}). Copiază fișierul JSON pe server în acest folder.`,
          );
          this.messaging = null;
          return;
        }
        const content = fs.readFileSync(resolvedPath, 'utf8');
        credentials = JSON.parse(content);
      } else {
        const raw =
          json!.startsWith('{') ? json! : Buffer.from(json!, 'base64').toString('utf8');
        credentials = JSON.parse(raw);
      }
      admin.initializeApp({ credential: admin.credential.cert(credentials) });
      this.messaging = admin.messaging();
      this.logger.log('FCM inițializat cu succes');
    } catch (err: any) {
      const msg = err?.message || String(err);
      this.logger.error(`Eroare inițializare FCM: ${msg}`);
      if (msg.includes("Cannot find module 'firebase-admin'")) {
        this.logger.error(
          'Rulează "npm install" în directorul proiectului (același folder unde e package.json și dist/), apoi repornește aplicația.',
        );
      }
      this.messaging = null;
    }
  }

  /** Înregistrează un token FCM pentru user. Dacă tokenul există deja, actualizează updated_at. */
  async subscribe(
    userId: number,
    fcmToken: string,
    deviceLabel?: string,
  ): Promise<PushSubscriptionEntity> {
    const existing = await this.repo.findOne({
      where: { user_id: userId, fcm_token: fcmToken } as any,
    });
    if (existing) {
      existing.device_label = deviceLabel ?? existing.device_label;
      await this.repo.save(existing);
      return existing;
    }
    const entity = this.repo.create({
      user_id: userId,
      fcm_token: fcmToken,
      device_label: deviceLabel ?? null,
    } as any);
    const saved = await this.repo.save(entity);
    return Array.isArray(saved) ? saved[0] : saved;
  }

  /** Elimină un token FCM pentru user. */
  async unsubscribe(userId: number, fcmToken: string): Promise<void> {
    await this.repo.delete({
      user_id: userId,
      fcm_token: fcmToken,
    } as any);
  }

  /**
   * Trimite notificare Web Push către toate dispozitivele utilizatorului.
   * Apelat din NotificationsService.create() după salvare și emit WebSocket.
   */
  async sendToUser(
    userId: number,
    payload: WebPushPayload,
  ): Promise<{ sent: number; failed: number }> {
    if (!this.messaging) {
      this.logger.warn(`FCM sendToUser(${userId}): FCM neinițializat (lipsește/eroare Service Account), push omis`);
      return { sent: 0, failed: 0 };
    }

    const subscriptions = await this.repo.find({
      where: { user_id: userId } as any,
    });
    if (subscriptions.length === 0) {
      this.logger.log(`FCM sendToUser(${userId}): niciun token înregistrat, push omis`);
      return { sent: 0, failed: 0 };
    }

    const tokens = subscriptions.map((s) => s.fcm_token);
    const data: Record<string, string> = {};
    if (payload.data) {
      for (const [k, v] of Object.entries(payload.data)) {
        data[k] = typeof v === 'string' ? v : String(v);
      }
    }
    const link = payload.data?.url ?? payload.data?.target_url;

    let sent = 0;
    let failed = 0;

    // Trimitem doar `data`, fără `notification`, ca doar service worker-ul să afișeze notificarea (o singură dată).
    // Dacă trimitem și notification, FCM afișează automat + SW afișează din onBackgroundMessage = dublu.
    if (!data.title) data.title = payload.title ?? 'Notificare';
    if (!data.body && payload.body) data.body = payload.body ?? '';

    try {
      const response = await this.messaging.sendEachForMulticast({
        tokens,
        data,
        webpush: link
          ? { fcmOptions: { link } }
          : undefined,
      });

      for (let i = 0; i < response.responses.length; i++) {
        const r = response.responses[i];
        if (r.success) {
          sent++;
        } else {
          failed++;
          const token = tokens[i];
          if (
            r.error?.code === 'messaging/invalid-registration-token' ||
            r.error?.code === 'messaging/registration-token-not-registered'
          ) {
            await this.repo.delete({ fcm_token: token } as any).catch(() => {});
          }
        }
      }
    } catch (err: any) {
      this.logger.warn(`FCM sendToUser(${userId}): ${err?.message || err}`);
      failed = tokens.length;
    }

    if (sent > 0 || failed > 0) {
      this.logger.log(`FCM sendToUser(${userId}): trimise=${sent}, eșecuri=${failed}`);
    }
    return { sent, failed };
  }
}
