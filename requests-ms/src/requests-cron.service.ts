import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LeaveRequestsService } from './leave-requests/leave-requests.service';
import { ShiftChangeRequestsService } from './shift-change-requests/shift-change-requests.service';

@Injectable()
export class RequestsCronService implements OnModuleInit {
  private readonly logger = new Logger(RequestsCronService.name);

  constructor(
    private readonly leaveRequestsService: LeaveRequestsService,
    private readonly shiftChangeRequestsService: ShiftChangeRequestsService,
  ) {}

  /**
   * Rulează la startup pentru a marca imediat cererile expirate
   */
  async onModuleInit() {
    await this.handleExpiredRequests();
  }

  /**
   * Rulează la fiecare oră pentru a marca cererile expirate ca rejected
   * Cron expression: '0 * * * *' = la fiecare oră, la minutul 0
   */
  @Cron(CronExpression.EVERY_HOUR)
  async handleExpiredRequests() {
    try {
      // Marchează cererile de concediu expirate
      await this.leaveRequestsService.rejectExpiredLeaveRequests();

      // Marchează cererile de schimb de tură expirate
      await this.shiftChangeRequestsService.rejectExpiredShiftChangeRequests();
    } catch (error) {
      this.logger.error(`Error while rejecting expired requests: ${error.message}`, error.stack);
    }
  }
}
