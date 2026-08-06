import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Logger,
  NotFoundException,
  Param,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Response } from 'express';
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

  /** Butonul „Reîmprospătează" din giurom 2.0 — retrimite cererile pending acum. */
  @Post('app2-waste-refresh')
  async refresh(@Req() req: { headers?: Record<string, unknown>; ip?: string }) {
    const hasKey = Boolean(
      typeof req.headers?.['x-stock-sync-key'] === 'string' &&
        String(req.headers['x-stock-sync-key']).trim(),
    );
    this.logger.log(
      `🔔 [App2Waste] HIT app2-waste-refresh ip=${req.ip ?? '?'} syncKey=${hasKey ? 'da' : 'NU'}`,
    );
    try {
      const result = await this.wasteExportService.runManualExport();
      this.logger.log(
        `🔔 [App2Waste] refresh DONE sent=${result.sent} ` +
          `diag=${JSON.stringify(result.diagnostics ?? {})}`,
      );
      return result;
    } catch (e) {
      this.logger.error(
        `❌ [App2Waste] refresh FAILED: ${(e as Error).message}`,
        (e as Error).stack,
      );
      throw e;
    }
  }

  /**
   * Poză dovadă — giurom 2.0 o cere cu X-Stock-Sync-Key.
   * Pe restosoft.eu/api/images/... e 401 fără cookie, deci App2 nu poate afișa direct.
   */
  @Get('app2-waste-image/:fileName')
  async serveImage(@Param('fileName') fileName: string, @Res() res: Response) {
    const safe = String(fileName || '')
      .replace(/\\/g, '/')
      .split('/')
      .pop()
      ?.trim();
    if (!safe || !/^[\w.\-]+$/i.test(safe) || safe.includes('..')) {
      throw new BadRequestException('Nume fișier invalid');
    }
    try {
      const { buffer, mimeType } = await this.service.serveWasteImage(safe);
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Cache-Control', 'private, max-age=3600');
      res.send(buffer);
    } catch (e) {
      if (e instanceof NotFoundException) throw e;
      this.logger.warn(`[App2Waste] Image ${safe} missing: ${(e as Error).message}`);
      throw new NotFoundException(`Imaginea ${safe} nu a fost găsită`);
    }
  }
}
