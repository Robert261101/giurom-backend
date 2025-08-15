import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Inject, Res } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';

@Controller('employee-files')
export class EmployeeFilesController {
  constructor(@Inject('EMPLOYEES_SERVICE') private readonly client: ClientProxy) {}

  @Post()
  async create(@Body() dto: any) {
    return await lastValueFrom(this.client.send('employees.files.create', dto));
  }

  @Get()
  async findAll(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Query('employee_id') employee_id?: string,
    @Query('file_type') file_type?: string,
  ) {
    return await lastValueFrom(
      this.client.send('employees.files.findAll', {
        page: parseInt(page, 10) || 1,
        limit: parseInt(limit, 10) || 10,
        employee_id: employee_id ? parseInt(employee_id, 10) : undefined,
        file_type,
      }),
    );
  }

  @Get('statistics')
  async statistics() {
    return await lastValueFrom(this.client.send('employees.files.statistics', {}));
  }

  @Get('employee/:employee_id')
  async findByEmployee(@Param('employee_id') employee_id: string) {
    return await lastValueFrom(this.client.send('employees.files.findByEmployee', +employee_id));
  }

  @Get('type/:file_type')
  async findByType(@Param('file_type') file_type: string) {
    return await lastValueFrom(this.client.send('employees.files.findByType', file_type));
  }

  @Get(':id')
  async getFile(
    @Param('id') id: string,
    @Query('download') download?: string,
    @Query('metadata') metadata?: string,
    @Res() res?: any,
  ) {
    if (metadata === 'true') {
      return await lastValueFrom(this.client.send('employees.files.findOne', +id));
    }
    const payload = await lastValueFrom(
      this.client.send('employees.files.serveFile', { file_id: +id, forceDownload: download === 'true' }),
    );
    res.setHeader('Content-Type', payload.mimeType);
    res.setHeader('Content-Disposition', `${payload.disposition}; filename="${payload.fileName}"`);
    const buffer = Buffer.from(payload.data, 'base64');
    return res.send(buffer);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: any) {
    return await lastValueFrom(this.client.send('employees.files.update', { id: +id, dto }));
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return await lastValueFrom(this.client.send('employees.files.remove', +id));
  }

  @Delete('employee/:employee_id/all')
  async removeAllByEmployee(@Param('employee_id') employee_id: string) {
    return await lastValueFrom(this.client.send('employees.files.removeAllByEmployee', +employee_id));
  }

  @Get('validate/:file_id/access')
  async validateAccess(@Param('file_id') file_id: string, @Query('employee_id') employee_id?: string) {
    const hasAccess = await lastValueFrom(
      this.client.send('employees.files.validateAccess', { file_id: +file_id, employee_id: employee_id ? parseInt(employee_id, 10) : undefined }),
    );
    return { hasAccess };
  }
} 