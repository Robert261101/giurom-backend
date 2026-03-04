import { Controller, Post, Body, UseGuards, Logger } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CronService } from './cron.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { InternalServiceGuard } from '../guards/internal-service.guard';
import { PermissionsGuard } from '../guards/permissions.guard';
import { Permissions } from '../permissions/permissions.decorator';

@ApiTags('Cron Jobs')
@Controller('cron')
export class CronController {
  private readonly logger = new Logger(CronController.name);

  constructor(private readonly cronService: CronService) {}

  @Post('manager-daily-payout')
  @UseGuards(InternalServiceGuard)
  @ApiOperation({
    summary:
      'Procesează manager_daily_payout pentru o locație și dată (apelat la aprobarea încasării)',
    description:
      'Sumă punctele angajaților din ziua respectivă, găsește managerul pontat în departamentul Manager, aplică manager_percent din WorkLocation_ManagerConfig și înregistrează în manager_daily_payout.',
  })
  @ApiResponse({ status: 200, description: 'Rezultat procesare' })
  @ApiResponse({ status: 401, description: 'Lipsă x-service-secret' })
  async processManagerDailyPayout(
    @Body() body: { work_location_id: number; work_date: string },
  ) {
    const workLocationId = Number(body?.work_location_id);
    const workDate = body?.work_date;
    this.logger.log(
      `📥 [manager-daily-payout] Primit: work_location_id=${workLocationId}, work_date=${workDate}`,
    );
    if (!workLocationId || !workDate) {
      return {
        ok: false,
        message: 'work_location_id și work_date sunt obligatorii',
      };
    }
    const result =
      await this.cronService.processManagerDailyPayoutForLocationAndDate(
        workLocationId,
        workDate,
      );
    this.logger.log(
      `📤 [manager-daily-payout] Rezultat: ok=${result?.ok}, created=${result?.created}, message=${result?.message ?? '—'}`,
    );
    return result;
  }

  @Post('complete-day')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('execution.read_all', 'assignment.read_all')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Închide ziua pentru o dată (la introducerea încasării)',
    description:
      'Finalizează toate sarcinile active din ziua respectivă ca nefinalizate și scade punctele. Apelat când se introduce încasarea pentru acea zi.',
  })
  @ApiResponse({
    status: 200,
    description: 'Zi închisă',
    schema: {
      type: 'object',
      properties: {
        completedCount: { type: 'number' },
        totalPointsDeducted: { type: 'number' },
      },
    },
  })
  async completeDay(@Body() body: { date?: string; location_id?: number }) {
    const dateStr = body?.date;
    const locationId =
      body?.location_id != null ? Number(body.location_id) : undefined;
    const forDate = dateStr ? new Date(dateStr) : undefined;
    return this.cronService.processActiveTasksForDate(forDate, locationId);
  }

  @Post('run-daily-task-completion')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('execution.read_all', 'assignment.read_all')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Rulează manual cron job-ul pentru finalizarea task-urilor active',
    description:
      'Acest endpoint permite rularea manuală a cron job-ului care finalizează automat task-urile active nefinalizate și scade punctele angajaților responsabili.',
  })
  @ApiResponse({
    status: 200,
    description: 'Cron job executat cu succes',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        completedTasks: { type: 'number' },
        totalPointsDeducted: { type: 'number' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Neautorizat' })
  @ApiResponse({ status: 403, description: 'Fără permisiuni' })
  async runDailyTaskCompletion() {
    return await this.cronService.runManualTaskCompletion();
  }

  @Post('run-fcfs-auto-assignment')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('execution.read_all', 'assignment.read_all')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Rulează manual cron job-ul pentru atribuirea automată FCFS',
    description:
      'Acest endpoint permite rularea manuală a cron job-ului care gestionează task-urile cu "primul venit, primul servit" și le atribuie automat dacă nu sunt preluate în timp.',
  })
  @ApiResponse({
    status: 200,
    description: 'Cron job FCFS executat cu succes',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        processedTasks: { type: 'number' },
        autoAssignedTasks: { type: 'number' },
        deletedTasks: { type: 'number' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Neautorizat' })
  @ApiResponse({ status: 403, description: 'Fără permisiuni' })
  async runFCFSAutoAssignment() {
    return await this.cronService.runManualFCFSAutoAssignment();
  }
}
