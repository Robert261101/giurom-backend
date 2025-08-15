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
  Res,
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
import { EmployeeFilesService } from './employee-files.service';
import { CreateEmployeeFileDto } from './dto/create-employee-file.dto';
import { UpdateEmployeeFileDto } from './dto/update-employee-file.dto';
import { EmployeeFiles } from '../entity/employee-files.entity';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';

@ApiTags('employee-files')
@Controller('employee-files')
@UseGuards(ThrottlerGuard)
@ApiBearerAuth()
export class EmployeeFilesController {
  constructor(@Inject('EMPLOYEES_SERVICE') private readonly employeesClient: ClientProxy) {}

  @Post()
  @ApiOperation({
    summary: 'Încarcă un nou fișier pentru angajat',
    description: 'Adaugă un nou fișier în dosarul unui angajat (CV, contract, diplome, etc.).',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Fișierul a fost încărcat cu succes',
    type: EmployeeFiles,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Angajatul nu a fost găsit',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Nu se pot adăuga fișiere pentru un angajat inactiv',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Există deja un fișier cu același nume sau tip pentru acest angajat',
  })
  async create(@Body() createFileDto: CreateEmployeeFileDto): Promise<EmployeeFiles> {
    return await lastValueFrom(
      this.employeesClient.send<EmployeeFiles>('employees.files.create', createFileDto),
    );
  }

  @Get()
  @ApiOperation({
    summary: 'Listează toate fișierele angajaților',
    description: 'Returnează o listă paginată cu toate fișierele din sistem cu opțiuni de filtrare.',
  })
  @ApiQuery({ name: 'page', required: false, description: 'Numărul paginii (implicit: 1)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Numărul de fișiere per pagină (implicit: 10)' })
  @ApiQuery({ name: 'employee_id', required: false, description: 'Filtrează după ID-ul angajatului' })
  @ApiQuery({ name: 'file_type', required: false, description: 'Filtrează după tipul fișierului' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lista fișierelor a fost returnată cu succes',
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: { $ref: '#/components/schemas/EmployeeFiles' },
        },
        total: { type: 'number', description: 'Numărul total de fișiere' },
        totalPages: { type: 'number', description: 'Numărul total de pagini' },
      },
    },
  })
  async findAll(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Query('employee_id') employee_id?: string,
    @Query('file_type') file_type?: string,
  ): Promise<{ files: EmployeeFiles[]; total: number; totalPages: number }> {
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    const employeeIdFilter = employee_id ? parseInt(employee_id, 10) : undefined;

    return await lastValueFrom(
      this.employeesClient.send('employees.files.findAll', {
        page: pageNum,
        limit: limitNum,
        employee_id: employeeIdFilter,
        file_type,
      }),
    );
  }

  @Get('statistics')
  @ApiOperation({
    summary: 'Statistici pentru fișierele angajaților',
    description: 'Returnează statistici detaliate despre fișierele încărcate.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Statisticile au fost returnate cu succes',
    schema: {
      type: 'object',
      properties: {
        total: { type: 'number', description: 'Numărul total de fișiere' },
        byFileType: { type: 'object', description: 'Numărul de fișiere per tip' },
        byEmployee: { type: 'object', description: 'Numărul de fișiere per angajat' },
        recentUploads: { type: 'number', description: 'Fișiere încărcate în ultima lună' },
        averageFilesPerEmployee: { type: 'number', description: 'Media fișierelor per angajat' },
      },
    },
  })
  async getStatistics(): Promise<{
    total: number;
    byFileType: { [key: string]: number };
    byEmployee: { [key: string]: number };
    recentUploads: number;
    averageFilesPerEmployee: number;
  }> {
    return await lastValueFrom(
      this.employeesClient.send('employees.files.statistics', {}),
    );
  }

  @Get('employee/:employee_id')
  @ApiOperation({
    summary: 'Găsește toate fișierele unui angajat',
    description: 'Returnează toate fișierele din dosarul unui angajat specific.',
  })
  @ApiParam({ name: 'employee_id', description: 'ID-ul angajatului' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Fișierele angajatului au fost găsite',
    type: [EmployeeFiles],
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Angajatul nu a fost găsit',
  })
  async findByEmployee(@Param('employee_id') employee_id: string): Promise<EmployeeFiles[]> {
    return await lastValueFrom(
      this.employeesClient.send<EmployeeFiles[]>('employees.files.findByEmployee', +employee_id),
    );
  }

  @Get('type/:file_type')
  @ApiOperation({
    summary: 'Găsește fișiere după tip',
    description: 'Returnează toate fișierele de un anumit tip (CV, Contract, etc.).',
  })
  @ApiParam({ 
    name: 'file_type', 
    description: 'Tipul fișierului',
    enum: ['CV', 'Contract', 'Act_Identitate', 'Diploma', 'Certificat', 'Poza', 'Document_Medical', 'Altele']
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Fișierele au fost găsite',
    type: [EmployeeFiles],
  })
  async findByType(@Param('file_type') file_type: string): Promise<EmployeeFiles[]> {
    return await lastValueFrom(
      this.employeesClient.send<EmployeeFiles[]>('employees.files.findByType', file_type),
    );
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Servește conținutul unui fișier sau returnează metadatele',
    description: 'Servește conținutul fișierului pentru vizualizare/descărcare sau returnează metadatele.',
  })
  @ApiParam({ name: 'id', description: 'ID-ul fișierului' })
  @ApiQuery({ name: 'download', required: false, description: 'Forțează descărcarea (true/false)' })
  @ApiQuery({ name: 'metadata', required: false, description: 'Returnează doar metadatele (true/false)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Fișierul sau metadatele au fost returnate cu succes',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Fișierul nu a fost găsit',
  })
  async findOne(
    @Param('id') id: string,
    @Query('download') download?: string,
    @Query('metadata') metadata?: string,
    @Res() res?: any,
  ): Promise<any> {
    if (metadata === 'true') {
      return await lastValueFrom(
        this.employeesClient.send<EmployeeFiles>('employees.files.findOne', +id),
      );
    }

    const payload = await lastValueFrom(
      this.employeesClient.send<{ data: string; mimeType: string; fileName: string; disposition: 'inline' | 'attachment' }>(
        'employees.files.serveFile',
        { file_id: +id, forceDownload: download === 'true' },
      ),
    );

    res.setHeader('Content-Type', payload.mimeType);
    res.setHeader('Content-Disposition', `${payload.disposition}; filename="${payload.fileName}"`);

    const buffer = Buffer.from(payload.data, 'base64');
    return res.send(buffer);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizează un fișier',
    description: 'Modifică informațiile unui fișier existent.',
  })
  @ApiParam({ name: 'id', description: 'ID-ul fișierului de actualizat' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Fișierul a fost actualizat cu succes',
    type: EmployeeFiles,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Fișierul sau angajatul nu a fost găsit',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Există deja un fișier cu același nume pentru acest angajat',
  })
  async update(
    @Param('id') id: string,
    @Body() updateFileDto: UpdateEmployeeFileDto,
  ): Promise<EmployeeFiles> {
    return await lastValueFrom(
      this.employeesClient.send<EmployeeFiles>('employees.files.update', { id: +id, dto: updateFileDto }),
    );
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Șterge un fișier',
    description: 'Șterge definitiv un fișier din dosarul angajatului.',
  })
  @ApiParam({ name: 'id', description: 'ID-ul fișierului de șters' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Fișierul a fost șters cu succes',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'Mesajul de confirmare' },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Fișierul nu a fost găsit',
  })
  async remove(@Param('id') id: string): Promise<{ message: string }> {
    return await lastValueFrom(
      this.employeesClient.send<{ message: string }>('employees.files.remove', +id),
    );
  }

  @Delete('employee/:employee_id/all')
  @ApiOperation({
    summary: 'Șterge toate fișierele unui angajat',
    description: 'Șterge definitiv toate fișierele din dosarul unui angajat. Atenție: operație ireversibilă!',
  })
  @ApiParam({ name: 'employee_id', description: 'ID-ul angajatului' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Toate fișierele au fost șterse cu succes',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'Mesajul de confirmare' },
        deletedCount: { type: 'number', description: 'Numărul de fișiere șterse' },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Angajatul nu a fost găsit',
  })
  async removeAllByEmployee(@Param('employee_id') employee_id: string): Promise<{ message: string; deletedCount: number }> {
    return await lastValueFrom(
      this.employeesClient.send<{ message: string; deletedCount: number }>('employees.files.removeAllByEmployee', +employee_id),
    );
  }

  @Get('validate/:file_id/access')
  @ApiOperation({
    summary: 'Validează accesul la un fișier',
    description: 'Verifică dacă un utilizator are acces la un fișier specific.',
  })
  @ApiParam({ name: 'file_id', description: 'ID-ul fișierului' })
  @ApiQuery({ name: 'employee_id', required: false, description: 'ID-ul angajatului (pentru verificare)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Rezultatul validării accesului',
    schema: {
      type: 'object',
      properties: {
        hasAccess: { type: 'boolean', description: 'Dacă utilizatorul are acces la fișier' },
      },
    },
  })
  async validateFileAccess(
    @Param('file_id') file_id: string,
    @Query('employee_id') employee_id?: string,
  ): Promise<{ hasAccess: boolean }> {
    const employeeIdFilter = employee_id ? parseInt(employee_id, 10) : undefined;
    const hasAccess = await lastValueFrom(
      this.employeesClient.send<boolean>('employees.files.validateAccess', { file_id: +file_id, employee_id: employeeIdFilter }),
    );

    return { hasAccess };
  }
} 