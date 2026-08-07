import { Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permissions } from './permissions/permissions.decorator';
import { EmployeesExportService } from './employees-export.service';

@ApiTags('employees')
@ApiBearerAuth()
@Controller('employees/sync')
export class EmployeesExportController {
  constructor(private readonly exportService: EmployeesExportService) {}

  /** Rulare manuală a sincronizării de angajați către giurom 2.0, fără să aștepți snapshot-ul. */
  @Post('run-manual')
  @Permissions('employees.read')
  @ApiOperation({
    summary: 'Trimite angajații către giurom 2.0',
    description:
      'Snapshot complet, grupat pe locație. Nu trimite CNP, adresă sau parole. ' +
      'Limitat la o rulare pe minut.',
  })
  async runManual() {
    return this.exportService.runManualExport();
  }

  /**
   * Declanșat din giurom 2.0 (buton „Sincronizează acum”).
   * Autentificare: header `X-Stock-Sync-Key` = GIUROM2_STOCK_SYNC_API_KEY
   * (JwtAuthGuard setează bypassAuth când cheia e validă pe această rută).
   */
  @Post('trigger-remote')
  @ApiOperation({
    summary: 'Trigger sync din App2',
    description: 'Aceeași logică ca run-manual, autentificat cu cheia de sync.',
  })
  async triggerRemote() {
    return this.exportService.runManualExport();
  }
}
