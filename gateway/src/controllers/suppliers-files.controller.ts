import { Controller, Get, Param, Query, Res, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';

@Controller('suppliers')
export class SuppliersFilesController {
  constructor(@Inject('SUPPLIERS_SERVICE') private readonly client: ClientProxy) {}

  @Get('file/:id')
  async getFile(
    @Param('id') id: string,
    @Query('download') download?: string,
    @Res() res?: any,
  ) {
    const payload = await lastValueFrom(
      this.client.send('suppliers.files.serveDocument', { file_id: +id, forceDownload: download === 'true' }),
    );
    res.setHeader('Content-Type', payload.mimeType);
    res.setHeader('Content-Disposition', `${payload.disposition}; filename="${payload.fileName}"`);
    const buffer = Buffer.from(payload.data, 'base64');
    return res.send(buffer);
  }
}


