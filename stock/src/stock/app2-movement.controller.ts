import {
  BadRequestException,
  Body,
  Controller,
  Logger,
  Post,
} from '@nestjs/common';
import { StockService } from './stock.service';
import { StockLotStatus } from './entities/stock.enums';

interface App2MovementDto {
  /** 'exit' = consum făcut în giurom 2.0; 'entry' = intrare înregistrată acolo. */
  operation: 'exit' | 'entry';
  product_id: number;
  location_id: number;
  quantity: number;
  /** Cheie de idempotență, mereu prefixată `app2:` — vezi StockService.consumeProduct. */
  target: string;
  /** Doar pentru intrări. */
  price?: number;
  entry_date?: string;
}

/**
 * Mișcările de stoc originate în giurom 2.0.
 *
 * giurom 2.0 nu ține propriul registru de stoc pentru locațiile legate: orice modificare
 * făcută acolo se execută **aici**, iar cantitatea se întoarce prin stock-sync. Așa există
 * un singur scriitor pe cantitate și nu pot apărea două valori care se contrazic.
 *
 * Endpoint-ul e apelat dintr-un outbox cu retry, deci aceeași operație poate sosi de mai
 * multe ori. `target` (prefixat `app2:`) e cheia de idempotență, tratată în
 * `consumeProduct` și `createStockItem`.
 */
@Controller('stock/integrations')
export class App2MovementController {
  private readonly logger = new Logger(App2MovementController.name);

  constructor(private readonly service: StockService) {}

  @Post('app2-movement')
  async applyMovement(@Body() dto: App2MovementDto) {
    const quantity = Number(dto.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new BadRequestException('quantity trebuie să fie un număr pozitiv');
    }
    const productId = Number(dto.product_id);
    const locationId = Number(dto.location_id);
    if (!Number.isFinite(productId) || !Number.isFinite(locationId)) {
      throw new BadRequestException('product_id și location_id sunt obligatorii');
    }
    const target = String(dto.target || '').trim();
    // Prefixul nu e cosmetic: pe el se bazează verificarea de idempotență din
    // consumeProduct. Fără el, un retry ar scădea stocul a doua oară.
    if (!target.startsWith('app2:')) {
      throw new BadRequestException('target trebuie să înceapă cu "app2:"');
    }

    if (dto.operation === 'exit') {
      await this.service.consumeProduct(
        productId,
        quantity,
        target,
        undefined,
        locationId,
      );
      this.logger.log(
        `⬇️ [App2Movement] EXIT product=${productId} qty=${quantity} location=${locationId} target=${target}`,
      );
      return { applied: true, operation: 'exit' as const };
    }

    if (dto.operation === 'entry') {
      const created = await this.service.createStock({
        product_id: productId,
        quantity,
        price: Number(dto.price) || 0,
        entry_date: dto.entry_date ? new Date(dto.entry_date) : new Date(),
        status: StockLotStatus.VALID,
        location_id: locationId,
        target,
        // Intrările din giurom 2.0 nu provin dintr-o linie de comandă furnizor,
        // deci rămân marcate ca intrări manuale în registrul de aici.
        source: 'manual',
      });
      this.logger.log(
        `⬆️ [App2Movement] ENTRY product=${productId} qty=${quantity} location=${locationId} target=${target}`,
      );
      return { applied: true, operation: 'entry' as const, stock_id: created?.id ?? null };
    }

    throw new BadRequestException('operation trebuie să fie "exit" sau "entry"');
  }
}
