import { Body, Controller, Get, Logger, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { App2OrdersService } from './app2-orders.service';
import { App2CreateOrderDto } from './dto/app2-create-order.dto';

/**
 * Ce poate face giurom 2.0 aici, cu `X-Stock-Sync-Key`.
 *
 * Controller separat, nu inca doua rute in `SuppliersHttpController`: caile astea sunt
 * singurele din microserviciu care accepta cheia de sync in loc de JWT (vezi lista explicita
 * din `JwtAuthGuard`), iar tinerea lor la un loc face limita usor de vazut la review.
 */
@ApiTags('suppliers')
@Controller('suppliers/app2')
export class App2OrdersController {
  private readonly logger = new Logger(App2OrdersController.name);

  constructor(private readonly service: App2OrdersService) {}

  @Get('catalog')
  @ApiOperation({
    summary:
      'Catalogul de furnizori si produse pentru compunerea unei comenzi in giurom 2.0',
  })
  getCatalog(
    @Query('company_id') companyId: string,
    @Query('location_id') locationId: string,
  ) {
    return this.service
      .getCatalog(Number.parseInt(companyId, 10), Number.parseInt(locationId, 10))
      .then((suppliers) => ({ suppliers }));
  }

  @Post('orders')
  @ApiOperation({
    summary: 'Plaseaza o comanda pregatita in giurom 2.0 (intra ca draft)',
  })
  createOrder(@Body() dto: App2CreateOrderDto) {
    this.logger.log(`[App2Orders] Cerere de comanda ${dto.target} (${dto.items.length} linii)`);
    return this.service.createOrder(dto);
  }
}
