import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseIntPipe,
  UseGuards,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';
import { CreateCompanyDto } from './dto/create-company.dto';
import { CreateCompanyWithDocumentsDto } from './dto/create-company-with-documents.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { CreateCompanyDocumentDto } from './dto/create-company-document.dto';
import { UpdateCompanyDocumentDto } from './dto/update-company-document.dto';
import { Company } from './entity/company.entity';
import { CompanyDocument } from './entity/company-document.entity';

@ApiTags('companies')
@Controller('companies')
@UseGuards(ThrottlerGuard)
@ApiBearerAuth()
export class CompanyController {
  constructor(@Inject('COMPANY_SERVICE') private readonly companyClient: ClientProxy) {}

  @Post()
  @ApiOperation({ summary: 'Creează o nouă companie', description: 'Adaugă o nouă companie' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Compania creată', type: Company })
  async createCompany(@Body() dto: CreateCompanyDto): Promise<Company> {
    return await lastValueFrom(this.companyClient.send<Company>('company.create', dto));
  }

  @Post('with-documents')
  @ApiOperation({ summary: 'Creează companie cu documente' })
  @ApiResponse({ status: HttpStatus.CREATED, type: Company })
  async createCompanyWithDocuments(@Body() dto: CreateCompanyWithDocumentsDto): Promise<Company> {
    return await lastValueFrom(this.companyClient.send<Company>('company.createWithDocuments', dto));
  }

  @Get()
  @ApiOperation({ summary: 'Lista companiilor' })
  @ApiResponse({ status: HttpStatus.OK })
  async findAllCompanies(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ): Promise<{ companies: Company[]; total: number; totalPages: number }> {
    return await lastValueFrom(
      this.companyClient.send('company.findAll', {
        page: page || 1,
        limit: limit || 10,
        search,
        status,
      }),
    );
  }

  @Get('statistics')
  @ApiOperation({ summary: 'Statistici companii' })
  @ApiResponse({ status: HttpStatus.OK })
  async getCompanyStatistics(): Promise<{ total: number; active: number; inactive: number; vat_payers: number }> {
    return await lastValueFrom(this.companyClient.send('company.statistics', {}));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Companie după ID' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: HttpStatus.OK, type: Company })
  async findCompanyById(@Param('id', ParseIntPipe) id: number): Promise<Company> {
    return await lastValueFrom(this.companyClient.send<Company>('company.findById', id));
  }

  @Get('cui/:cui')
  @ApiOperation({ summary: 'Companie după CUI' })
  @ApiParam({ name: 'cui', type: String })
  @ApiResponse({ status: HttpStatus.OK, type: Company })
  async findCompanyByCui(@Param('cui') cui: string): Promise<Company> {
    return await lastValueFrom(this.companyClient.send<Company>('company.findByCui', cui));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizează companie' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: HttpStatus.OK, type: Company })
  async updateCompany(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCompanyDto): Promise<Company> {
    return await lastValueFrom(this.companyClient.send<Company>('company.update', { id, dto }));
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Șterge companie' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: HttpStatus.OK })
  async removeCompany(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return await lastValueFrom(this.companyClient.send<void>('company.remove', id));
  }

  @Post(':companyId/documents')
  @ApiOperation({ summary: 'Adaugă document companie' })
  @ApiParam({ name: 'companyId', type: Number })
  @ApiResponse({ status: HttpStatus.CREATED, type: CompanyDocument })
  async createCompanyDocument(
    @Param('companyId', ParseIntPipe) companyId: number,
    @Body() dto: CreateCompanyDocumentDto,
  ): Promise<CompanyDocument> {
    dto.company_id = companyId;
    return await lastValueFrom(this.companyClient.send<CompanyDocument>('company.documents.create', dto));
  }

  @Get(':companyId/documents')
  @ApiOperation({ summary: 'Documente companie' })
  @ApiParam({ name: 'companyId', type: Number })
  async findCompanyDocuments(@Param('companyId', ParseIntPipe) companyId: number): Promise<CompanyDocument[]> {
    return await lastValueFrom(this.companyClient.send<CompanyDocument[]>('company.documents.findByCompany', companyId));
  }

  @Get('documents/:documentId')
  @ApiOperation({ summary: 'Document după ID' })
  @ApiParam({ name: 'documentId', type: Number })
  async findDocumentById(@Param('documentId', ParseIntPipe) documentId: number): Promise<CompanyDocument> {
    return await lastValueFrom(this.companyClient.send<CompanyDocument>('company.documents.findById', documentId));
  }

  @Patch('documents/:documentId')
  @ApiOperation({ summary: 'Actualizează document' })
  @ApiParam({ name: 'documentId', type: Number })
  async updateCompanyDocument(
    @Param('documentId', ParseIntPipe) documentId: number,
    @Body() dto: UpdateCompanyDocumentDto,
  ): Promise<CompanyDocument> {
    return await lastValueFrom(this.companyClient.send<CompanyDocument>('company.documents.update', { documentId, dto }));
  }

  @Delete('documents/:documentId')
  @ApiOperation({ summary: 'Șterge document' })
  @ApiParam({ name: 'documentId', type: Number })
  async removeCompanyDocument(@Param('documentId', ParseIntPipe) documentId: number): Promise<void> {
    return await lastValueFrom(this.companyClient.send<void>('company.documents.remove', documentId));
  }
} 