import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpStatus,
  UseGuards,
  Put,
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
import { GeneratedDocumentsService } from './generated-documents.service';
import { CreateGeneratedDocumentDto } from './dto/create-generated-document.dto';
import { UpdateGeneratedDocumentDto } from './dto/update-generated-document.dto';
import { GeneratedDocuments } from '../entity/generated-documents.entity';

@ApiTags('generated-documents')
@Controller('generated-documents')
@UseGuards(ThrottlerGuard)
@ApiBearerAuth()
export class GeneratedDocumentsController {
  constructor(private readonly documentsService: GeneratedDocumentsService) {}

  @Post()
  @ApiOperation({
    summary: 'Generează un nou document',
    description: 'Creează un document nou pentru un angajat (contracte, acte, certificări, etc.).',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Documentul a fost generat cu succes',
    type: GeneratedDocuments,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Angajatul nu a fost găsit',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Date invalide sau angajat inactiv',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Există deja un document activ de acest tip pentru angajat',
  })
  async create(@Body() createDocumentDto: CreateGeneratedDocumentDto): Promise<GeneratedDocuments> {
    return await this.documentsService.create(createDocumentDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listează toate documentele generate',
    description: 'Returnează o listă paginată cu toate documentele generate cu opțiuni de filtrare.',
  })
  @ApiQuery({ name: 'page', required: false, description: 'Numărul paginii (implicit: 1)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Numărul de documente per pagină (implicit: 10)' })
  @ApiQuery({ name: 'employee_id', required: false, description: 'Filtrează după ID-ul angajatului' })
  @ApiQuery({ name: 'status', required: false, description: 'Filtrează după status', enum: ['Generated', 'Signed', 'Expired', 'Cancelled', 'Draft'] })
  @ApiQuery({ name: 'doc_id', required: false, description: 'Filtrează după ID-ul tipului de document' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lista documentelor a fost returnată cu succes',
    schema: {
      type: 'object',
      properties: {
        documents: {
          type: 'array',
          items: { $ref: '#/components/schemas/GeneratedDocuments' },
        },
        total: { type: 'number', description: 'Numărul total de documente' },
        totalPages: { type: 'number', description: 'Numărul total de pagini' },
      },
    },
  })
  async findAll(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Query('employee_id') employee_id?: string,
    @Query('status') status?: string,
    @Query('doc_id') doc_id?: string,
  ): Promise<{ documents: GeneratedDocuments[]; total: number; totalPages: number }> {
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    const employeeIdFilter = employee_id ? parseInt(employee_id, 10) : undefined;
    const docIdFilter = doc_id ? parseInt(doc_id, 10) : undefined;

    return await this.documentsService.findAll(pageNum, limitNum, employeeIdFilter, status, docIdFilter);
  }

  @Get('statistics')
  @ApiOperation({
    summary: 'Statistici pentru documentele generate',
    description: 'Returnează statistici detaliate despre documentele generate și statusurile lor.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Statisticile au fost returnate cu succes',
    schema: {
      type: 'object',
      properties: {
        total: { type: 'number', description: 'Numărul total de documente' },
        byStatus: { type: 'object', description: 'Numărul de documente per status' },
        byEmployee: { type: 'object', description: 'Numărul de documente per angajat' },
        expiringSoon: { type: 'number', description: 'Documente care expiră în 30 de zile' },
        recentlySigned: { type: 'number', description: 'Documente semnate în ultimele 7 zile' },
        byDocType: { type: 'object', description: 'Numărul de documente per tip' },
      },
    },
  })
  async getStatistics(): Promise<{
    total: number;
    byStatus: { [key: string]: number };
    byEmployee: { [key: string]: number };
    expiringSoon: number;
    recentlySigned: number;
    byDocType: { [key: string]: number };
  }> {
    return await this.documentsService.getStatistics();
  }

  @Get('expired')
  @ApiOperation({
    summary: 'Găsește documentele expirate',
    description: 'Returnează toate documentele care au expirat.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Documentele expirate au fost găsite',
    type: [GeneratedDocuments],
  })
  async findExpiredDocuments(): Promise<GeneratedDocuments[]> {
    return await this.documentsService.findExpiredDocuments();
  }

  @Post('mark-expired')
  @ApiOperation({
    summary: 'Marchează documentele expirate',
    description: 'Job programat pentru a marca automat documentele expirate ca fiind cu status "Expired".',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Documentele expirate au fost marcate',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'Mesajul de confirmare' },
        markedCount: { type: 'number', description: 'Numărul de documente marcate ca expirate' },
      },
    },
  })
  async markExpiredDocuments(): Promise<{ message: string; markedCount: number }> {
    return await this.documentsService.markExpiredDocuments();
  }

  @Get('employee/:employee_id')
  @ApiOperation({
    summary: 'Găsește toate documentele unui angajat',
    description: 'Returnează toate documentele generate pentru un angajat specific.',
  })
  @ApiParam({ name: 'employee_id', description: 'ID-ul angajatului' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Documentele angajatului au fost găsite',
    type: [GeneratedDocuments],
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Angajatul nu a fost găsit',
  })
  async findByEmployee(@Param('employee_id') employee_id: string): Promise<GeneratedDocuments[]> {
    return await this.documentsService.findByEmployee(+employee_id);
  }

  @Get('status/:status')
  @ApiOperation({
    summary: 'Găsește documente după status',
    description: 'Returnează toate documentele cu un status specific.',
  })
  @ApiParam({ 
    name: 'status', 
    description: 'Statusul documentului',
    enum: ['Generated', 'Signed', 'Expired', 'Cancelled', 'Draft']
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Documentele au fost găsite',
    type: [GeneratedDocuments],
  })
  async findByStatus(@Param('status') status: string): Promise<GeneratedDocuments[]> {
    return await this.documentsService.findByStatus(status);
  }

  @Get('document-type/:doc_id')
  @ApiOperation({
    summary: 'Găsește documente după tipul de document',
    description: 'Returnează toate documentele de un anumit tip.',
  })
  @ApiParam({ name: 'doc_id', description: 'ID-ul tipului de document' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Documentele au fost găsite',
    type: [GeneratedDocuments],
  })
  async findByDocId(@Param('doc_id') doc_id: string): Promise<GeneratedDocuments[]> {
    return await this.documentsService.findByDocId(+doc_id);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Găsește un document după ID',
    description: 'Returnează detaliile unui document specific.',
  })
  @ApiParam({ name: 'id', description: 'ID-ul documentului' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Documentul a fost găsit',
    type: GeneratedDocuments,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Documentul nu a fost găsit',
  })
  async findOne(@Param('id') id: string): Promise<GeneratedDocuments> {
    return await this.documentsService.findOne(+id);
  }

  @Get(':id/is-valid')
  @ApiOperation({
    summary: 'Verifică dacă un document este valid',
    description: 'Verifică dacă documentul este semnat și neexpirat.',
  })
  @ApiParam({ name: 'id', description: 'ID-ul documentului' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Rezultatul validării documentului',
    schema: {
      type: 'object',
      properties: {
        isValid: { type: 'boolean', description: 'Dacă documentul este valid' },
      },
    },
  })
  async isDocumentValid(@Param('id') id: string): Promise<{ isValid: boolean }> {
    const isValid = await this.documentsService.isDocumentValid(+id);
    return { isValid };
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizează un document',
    description: 'Modifică informațiile unui document existent.',
  })
  @ApiParam({ name: 'id', description: 'ID-ul documentului de actualizat' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Documentul a fost actualizat cu succes',
    type: GeneratedDocuments,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Documentul sau angajatul nu a fost găsit',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Date invalide pentru actualizare',
  })
  async update(
    @Param('id') id: string,
    @Body() updateDocumentDto: UpdateGeneratedDocumentDto,
  ): Promise<GeneratedDocuments> {
    return await this.documentsService.update(+id, updateDocumentDto);
  }

  @Put(':id/sign')
  @ApiOperation({
    summary: 'Semnează un document',
    description: 'Marchează documentul ca fiind semnat și setează data semnării.',
  })
  @ApiParam({ name: 'id', description: 'ID-ul documentului de semnat' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Documentul a fost semnat cu succes',
    type: GeneratedDocuments,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Documentul nu a fost găsit',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Documentul este deja semnat sau nu poate fi semnat',
  })
  async signDocument(@Param('id') id: string): Promise<GeneratedDocuments> {
    return await this.documentsService.signDocument(+id);
  }

  @Put(':id/cancel')
  @ApiOperation({
    summary: 'Anulează un document',
    description: 'Marchează documentul ca fiind anulat.',
  })
  @ApiParam({ name: 'id', description: 'ID-ul documentului de anulat' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Documentul a fost anulat cu succes',
    type: GeneratedDocuments,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Documentul nu a fost găsit',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Documentul este deja anulat sau nu poate fi anulat',
  })
  async cancelDocument(@Param('id') id: string): Promise<GeneratedDocuments> {
    return await this.documentsService.cancelDocument(+id);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Șterge un document',
    description: 'Șterge definitiv un document din sistem. Documentele semnate nu pot fi șterse.',
  })
  @ApiParam({ name: 'id', description: 'ID-ul documentului de șters' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Documentul a fost șters cu succes',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'Mesajul de confirmare' },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Documentul nu a fost găsit',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Nu se pot șterge documentele semnate',
  })
  async remove(@Param('id') id: string): Promise<{ message: string }> {
    return await this.documentsService.remove(+id);
  }
} 