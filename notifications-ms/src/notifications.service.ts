import { Injectable } from '@nestjs/common';

@Injectable()
export class NotificationsService {
  private unreadCount = 0;

  getUnreadCount() {
    return { unread: this.unreadCount };
  }

  async onExpiringLabel(event: { labelId: number; labelCode: string; preparationId: number; expiresAt: string }) {
    // Here you could persist a notification record; for now, increment unread
    this.unreadCount += 1;
  }
}


