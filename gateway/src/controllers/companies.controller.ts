import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Inject, ParseIntPipe } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';

@Controller('companies')
export class CompaniesController {
  constructor(@Inject('COMPANY_SERVICE') private readonly client: ClientProxy) {}

  @Post()
  async create(@Body() dto: any) {
    return await lastValueFrom(this.client.send('company.create', dto));
  }

  @Post('with-documents')
  async createWithDocuments(@Body() dto: any) {
    return await lastValueFrom(this.client.send('company.createWithDocuments', dto));
  }

  @Get()
  async findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    return await lastValueFrom(this.client.send('company.findAll', {
      page: page || 1,
      limit: limit || 10,
      search,
      status,
    }));
  }

  @Get('statistics')
  async statistics() {
    return await lastValueFrom(this.client.send('company.statistics', {}));
  }

  @Get(':id')
  async findById(@Param('id', ParseIntPipe) id: number) {
    return await lastValueFrom(this.client.send('company.findById', id));
  }

  @Get('cui/:cui')
  async findByCui(@Param('cui') cui: string) {
    return await lastValueFrom(this.client.send('company.findByCui', cui));
  }

  @Patch(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() dto: any) {
    return await lastValueFrom(this.client.send('company.update', { id, dto }));
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    return await lastValueFrom(this.client.send('company.remove', id));
  }

  @Post(':companyId/documents')
  async createDocument(@Param('companyId', ParseIntPipe) companyId: number, @Body() dto: any) {
    dto.company_id = companyId;
    return await lastValueFrom(this.client.send('company.documents.create', dto));
  }

  @Get(':companyId/documents')
  async findCompanyDocuments(@Param('companyId', ParseIntPipe) companyId: number) {
    return await lastValueFrom(this.client.send('company.documents.findByCompany', companyId));
  }

  @Get('documents/:documentId')
  async findDocumentById(@Param('documentId', ParseIntPipe) documentId: number) {
    return await lastValueFrom(this.client.send('company.documents.findById', documentId));
  }

  @Patch('documents/:documentId')
  async updateDocument(@Param('documentId', ParseIntPipe) documentId: number, @Body() dto: any) {
    return await lastValueFrom(this.client.send('company.documents.update', { documentId, dto }));
    
  }

  @Delete('documents/:documentId')
  async removeDocument(@Param('documentId', ParseIntPipe) documentId: number) {
    return await lastValueFrom(this.client.send('company.documents.remove', documentId));
  }
} 