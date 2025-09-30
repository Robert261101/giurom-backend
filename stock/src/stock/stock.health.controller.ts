import { Controller, Get } from '@nestjs/common';
import { Permissions } from '../permissions/permissions.decorator';

@Controller('stock')
export class StockHealthController {
  @Get('health')
  @Permissions('stock.read')
  health() {
    return { ok: true };
  }
}


