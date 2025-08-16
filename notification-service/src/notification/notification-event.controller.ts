import { Controller, Logger } from '@nestjs/common';
import { EventPattern } from '@nestjs/microservices';
import { NotificationService } from './notification.service';
import { NotificationType } from './entity/notification.entity';
import { HttpService } from '@nestjs/axios';
import { logAction } from '../common/logging.util';

@Controller()
export class NotificationEventController {
  private readonly logger = new Logger(NotificationEventController.name);
  constructor(
    private readonly notificationService: NotificationService,
    private readonly httpService: HttpService
  ) {}

  @EventPattern('contract.expiring')
  async handleContractExpiring(data: { contractId: number }) {
    const result = await this.notificationService.createNotification(data.contractId, NotificationType.CONTRACT_EXPIRING);
    await logAction(
      this.httpService,
      this.logger,
      'contract_expiring',
      'success',
      0,
      'notification',
      result.id,
      { contractId: data.contractId }
    );
    return result;
  }
} 