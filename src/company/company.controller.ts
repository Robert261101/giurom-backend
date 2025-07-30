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
import { CompanyService } from './company.service';
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
  constructor(private readonly companyService: CompanyService) {}

  // ===================== COMPANY CRUD OPERATIONS =====================

  @Post()
  @ApiOperation({
    summary: 'Creează o nouă companie',
    description: 'Adaugă o nouă companie în sistem cu toate detaliile necesare',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Compania a fost creată cu succes',
    type: Company,
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'O companie cu acest CUI există deja',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Date de intrare invalide',
  })
  async createCompany(@Body() createCompanyDto: CreateCompanyDto): Promise<Company> {
    return await this.companyService.createCompany(createCompanyDto);
  }

  @Post('with-documents')
  @ApiOperation({
    summary: 'Creează o nouă companie cu documente',
    description: 'Adaugă o nouă companie în sistem cu documente încărcate din formular',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Compania a fost creată cu succes cu documente',
    type: Company,
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'O companie cu acest CUI există deja',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Date de intrare invalide',
  })
  async createCompanyWithDocuments(@Body() createCompanyDto: CreateCompanyWithDocumentsDto): Promise<Company> {
    return await this.companyService.createCompanyWithDocuments(createCompanyDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Returnează lista companiilor',
    description: 'Returnează o listă paginată de companii cu opțiuni de filtrare și căutare',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Numărul paginii (implicit: 1)',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Numărul de elemente per pagină (implicit: 10)',
    example: 10,
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Căutare după numele companiei sau CUI',
    example: 'Giurom',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    type: String,
    description: 'Filtrează după status',
    example: 'activ',
    enum: ['activ', 'inactiv', 'suspendat'],
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lista companiilor a fost returnată cu succes',
  })
  async findAllCompanies(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ): Promise<{ companies: Company[]; total: number; totalPages: number }> {
    return await this.companyService.findAllCompanies(
      page || 1,
      limit || 10,
      search,
      status,
    );
  }

  @Get('statistics')
  @ApiOperation({
    summary: 'Returnează statistici despre companii',
    description: 'Returnează numărul total de companii, active, inactive și plătitoare de TVA',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Statisticile au fost returnate cu succes',
  })
  async getCompanyStatistics(): Promise<{
    total: number;
    active: number;
    inactive: number;
    vat_payers: number;
  }> {
    return await this.companyService.getCompanyStatistics();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Returnează o companie după ID',
    description: 'Returnează detaliile complete ale unei companii incluzând documentele și locațiile',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'ID-ul companiei',
    example: 1,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Compania a fost găsită',
    type: Company,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Compania nu a fost găsită',
  })
  async findCompanyById(@Param('id', ParseIntPipe) id: number): Promise<Company> {
    return await this.companyService.findCompanyById(id);
  }

  @Get('cui/:cui')
  @ApiOperation({
    summary: 'Returnează o companie după CUI',
    description: 'Caută și returnează o companie după Codul Unic de Înregistrare',
  })
  @ApiParam({
    name: 'cui',
    type: String,
    description: 'CUI-ul companiei',
    example: 'RO12345678',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Compania a fost găsită',
    type: Company,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Compania cu acest CUI nu a fost găsită',
  })
  async findCompanyByCui(@Param('cui') cui: string): Promise<Company> {
    return await this.companyService.findCompanyByCui(cui);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizează o companie',
    description: 'Actualizează datele unei companii existente',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'ID-ul companiei de actualizat',
    example: 1,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Compania a fost actualizată cu succes',
    type: Company,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Compania nu a fost găsită',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'CUI-ul este deja folosit de altă companie',
  })
  async updateCompany(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateCompanyDto: UpdateCompanyDto,
  ): Promise<Company> {
    return await this.companyService.updateCompany(id, updateCompanyDto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Șterge o companie',
    description: 'Șterge definitiv o companie din sistem (incluzând documentele și locațiile)',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'ID-ul companiei de șters',
    example: 1,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Compania a fost ștearsă cu succes',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Compania nu a fost găsită',
  })
  async removeCompany(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return await this.companyService.removeCompany(id);
  }

  // ===================== COMPANY DOCUMENT OPERATIONS =====================

  @Post(':companyId/documents')
  @ApiOperation({
    summary: 'Adaugă un document la o companie',
    description: 'Încarcă și asociază un document cu o companie existentă',
  })
  @ApiParam({
    name: 'companyId',
    type: Number,
    description: 'ID-ul companiei',
    example: 1,
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Documentul a fost adăugat cu succes',
    type: CompanyDocument,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Compania nu a fost găsită',
  })
  async createCompanyDocument(
    @Param('companyId', ParseIntPipe) companyId: number,
    @Body() createDocumentDto: CreateCompanyDocumentDto,
  ): Promise<CompanyDocument> {
    createDocumentDto.company_id = companyId;
    return await this.companyService.createCompanyDocument(createDocumentDto);
  }

  @Get(':companyId/documents')
  @ApiOperation({
    summary: 'Returnează documentele unei companii',
    description: 'Returnează lista tuturor documentelor asociate cu o companie',
  })
  @ApiParam({
    name: 'companyId',
    type: Number,
    description: 'ID-ul companiei',
    example: 1,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lista documentelor a fost returnată cu succes',
    type: [CompanyDocument],
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Compania nu a fost găsită',
  })
  async findCompanyDocuments(
    @Param('companyId', ParseIntPipe) companyId: number,
  ): Promise<CompanyDocument[]> {
    return await this.companyService.findCompanyDocuments(companyId);
  }

  @Get('documents/:documentId')
  @ApiOperation({
    summary: 'Returnează un document după ID',
    description: 'Returnează detaliile unui document specific',
  })
  @ApiParam({
    name: 'documentId',
    type: Number,
    description: 'ID-ul documentului',
    example: 1,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Documentul a fost găsit',
    type: CompanyDocument,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Documentul nu a fost găsit',
  })
  async findDocumentById(
    @Param('documentId', ParseIntPipe) documentId: number,
  ): Promise<CompanyDocument> {
    return await this.companyService.findDocumentById(documentId);
  }

  @Patch('documents/:documentId')
  @ApiOperation({
    summary: 'Actualizează un document',
    description: 'Actualizează informațiile unui document existent',
  })
  @ApiParam({
    name: 'documentId',
    type: Number,
    description: 'ID-ul documentului de actualizat',
    example: 1,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Documentul a fost actualizat cu succes',
    type: CompanyDocument,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Documentul nu a fost găsit',
  })
  async updateCompanyDocument(
    @Param('documentId', ParseIntPipe) documentId: number,
    @Body() updateDocumentDto: UpdateCompanyDocumentDto,
  ): Promise<CompanyDocument> {
    return await this.companyService.updateCompanyDocument(
      documentId,
      updateDocumentDto,
    );
  }

  @Delete('documents/:documentId')
  @ApiOperation({
    summary: 'Șterge un document',
    description: 'Șterge definitiv un document din sistem',
  })
  @ApiParam({
    name: 'documentId',
    type: Number,
    description: 'ID-ul documentului de șters',
    example: 1,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Documentul a fost șters cu succes',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Documentul nu a fost găsit',
  })
  async removeCompanyDocument(
    @Param('documentId', ParseIntPipe) documentId: number,
  ): Promise<void> {
    return await this.companyService.removeCompanyDocument(documentId);
  }
} 