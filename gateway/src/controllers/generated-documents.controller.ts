import { Controller, Get, Post, Patch, Put, Delete, Body, Param, Query, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';

@Controller('generated-documents')
export class GeneratedDocumentsController {
  constructor(@Inject('EMPLOYEES_SERVICE') private readonly client: ClientProxy) {}

  @Post()
  async create(@Body() dto: any) {
    return await lastValueFrom(this.client.send('employees.documents.create', dto));
  }

  @Get()
  async findAll(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Query('employee_id') employee_id?: string,
    @Query('status') status?: string,
    @Query('doc_id') doc_id?: string,
  ) {
    return await lastValueFrom(
      this.client.send('employees.documents.findAll', {
        page: parseInt(page, 10) || 1,
        limit: parseInt(limit, 10) || 10,
        employee_id: employee_id ? parseInt(employee_id, 10) : undefined,
        status,
        doc_id: doc_id ? parseInt(doc_id, 10) : undefined,
      }),
    );
  }

  @Get('statistics')
  async statistics() {
    return await lastValueFrom(this.client.send('employees.documents.statistics', {}));
  }

  @Get('expired')
  async findExpired() {
    return await lastValueFrom(this.client.send('employees.documents.findExpired', {}));
  }

  @Get('employee/:employee_id')
  async findByEmployee(@Param('employee_id') employee_id: string) {
    return await lastValueFrom(this.client.send('employees.documents.findByEmployee', +employee_id));
  }

  @Get('status/:status')
  async findByStatus(@Param('status') status: string) {
    return await lastValueFrom(this.client.send('employees.documents.findByStatus', status));
  }

  @Get('document-type/:doc_id')
  async findByDocId(@Param('doc_id') doc_id: string) {
    return await lastValueFrom(this.client.send('employees.documents.findByDocId', +doc_id));
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return await lastValueFrom(this.client.send('employees.documents.findOne', +id));
  }

  @Get(':id/is-valid')
  async isValid(@Param('id') id: string) {
    const doc = await lastValueFrom(this.client.send('employees.documents.findOne', +id));
    const isValid = doc.status === 'Signed' && (!doc.expired_date || new Date(doc.expired_date) > new Date());
    return { isValid };
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: any) {
    return await lastValueFrom(this.client.send('employees.documents.update', { id: +id, dto }));
  }

  @Put(':id/sign')
  async sign(@Param('id') id: string) {
    return await lastValueFrom(this.client.send('employees.documents.sign', +id));
  }

  @Put(':id/cancel')
  async cancel(@Param('id') id: string) {
    return await lastValueFrom(this.client.send('employees.documents.cancel', +id));
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return await lastValueFrom(this.client.send('employees.documents.remove', +id));
  }
} 