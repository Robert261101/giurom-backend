import { Controller, Post } from '@nestjs/common';
import { Permissions } from '../../permissions/permissions.decorator';
import { StockSyncCronService } from './stock-sync-cron.service';

@Controller('stock/sync')
export class StockSyncController {
  constructor(private readonly stockSyncCronService: StockSyncCronService) {}

  /** Rulează manual sincronizarea de stoc către giurom 2.0, pentru testare (nu trebuie să aștepți cron-ul de 15 min). */
  @Post('run-manual')
  @Permissions('stock.create')
  async runManual() {
    return this.stockSyncCronService.runManualStockSync();
  }
}
