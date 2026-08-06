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
}
