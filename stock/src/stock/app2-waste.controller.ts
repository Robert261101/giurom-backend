import {
  BadRequestException,
  Body,
  Controller,
  Logger,
  Post,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StockService } from './stock.service';
import { WasteRequest } from './entities/waste-request.entity';
import { WasteExportService } from './waste-export.service';

interface App2WasteDecisionDto {
  /** `waste_requests.id` de aici — giurom 2.0 îl păstrează ca `sourceRequestId`. */
  source_request_id: number;
  decision: 'approve' | 'reject';
}

/**
 * Deciziile pe cererile de aruncare, luate în giurom 2.0.
 *
 * Aprobarea nu doar marchează cererea: `approveWasteRequest` creează înregistrarea de deșeu
 * ȘI consumă stocul (pentru preparate, explodează rețeta pe ingrediente). Execuția rămâne
 * aici, fiindcă aici e singurul scriitor pe cantitate — giurom 2.0 vede scăderea la
 * următorul snapshot de stoc, ca orice altă mișcare.
 *
 * Endpoint-ul e apelat de un manager care apasă un buton, nu dintr-un outbox: eroarea
 * trebuie să ajungă înapoi în UI (ex. stoc insuficient), nu să fie reîncercată în tăcere.
 */
@Controller('stock/integrations')
export class App2WasteController {
  private readonly logger = new Logger(App2WasteController.name);

  constructor(
    private readonly service: StockService,
    @InjectRepository(WasteRequest)
    private readonly wasteRequestRepo: Repository<WasteRequest>,
    private readonly wasteExportService: WasteExportService,
  ) {}

  @Post('app2-waste-decision')
  async applyDecision(@Body() dto: App2WasteDecisionDto) {
    const requestId = Number(dto.source_request_id);
    if (!Number.isFinite(requestId) || requestId <= 0) {
      throw new BadRequestException('source_request_id trebuie să fie un id valid');
    }
    if (dto.decision !== 'approve' && dto.decision !== 'reject') {
      throw new BadRequestException('decision trebuie să fie "approve" sau "reject"');
    }

    const existing = await this.wasteRequestRepo.findOne({ where: { id: requestId } });
    if (!existing) {
      throw new BadRequestException(`Cererea de aruncare ${requestId} nu există`);
    }

    // Cererea a fost deja decisă — tipic aici: dublu-click în UI, sau cineva a apăsat între
    // timp în RestoSoft.eu. Nu e o eroare: răspundem cu starea reală, ca giurom 2.0 să se
    // alinieze, în loc să arate un eșec pentru o operație care s-a întâmplat deja.
    if (existing.status !== 'pending') {
      this.logger.log(
        `[App2Waste] Cererea ${requestId} era deja ${existing.status} — răspund cu starea curentă.`,
      );
      return { applied: false, status: existing.status, already_decided: true };
    }

    if (dto.decision === 'approve') {
      await this.service.approveWasteRequest(requestId);
      this.logger.log(`✅ [App2Waste] Cerere ${requestId} aprobată din giurom 2.0`);
      return { applied: true, status: 'approved' as const, already_decided: false };
    }

    await this.service.rejectWasteRequest(requestId);
    this.logger.log(`🚫 [App2Waste] Cerere ${requestId} respinsă din giurom 2.0`);
    return { applied: true, status: 'rejected' as const, already_decided: false };
  }

  /** Butonul „Reîmprospătează" din giurom 2.0 — retrimite cererile recente acum. */
  @Post('app2-waste-refresh')
  async refresh() {
    return this.wasteExportService.runManualExport();
  }
}
