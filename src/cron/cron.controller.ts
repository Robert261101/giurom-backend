import { Controller, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CronService } from './cron.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PermissionsGuard } from '../guards/permissions.guard';
import { Permissions } from '../permissions/permissions.decorator';

@ApiTags('Cron Jobs')
@Controller('cron')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class CronController {
  constructor(private readonly cronService: CronService) {}

  @Post('run-daily-task-completion')
  @Permissions('execution.read_all', 'assignment.read_all')
  @ApiOperation({ 
    summary: 'Rulează manual cron job-ul pentru finalizarea task-urilor active',
    description: 'Acest endpoint permite rularea manuală a cron job-ului care finalizează automat task-urile active nefinalizate și scade punctele angajaților responsabili.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Cron job executat cu succes',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        completedTasks: { type: 'number' },
        totalPointsDeducted: { type: 'number' }
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Neautorizat' })
  @ApiResponse({ status: 403, description: 'Fără permisiuni' })
  async runDailyTaskCompletion() {
    return await this.cronService.runManualTaskCompletion();
  }
}



