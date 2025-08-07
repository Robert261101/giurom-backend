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
  Options,
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
import { EmployeeService } from './employee.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { Employee } from './entity/employee.entity';

@ApiTags('employees')
@Controller('employees')
@UseGuards(ThrottlerGuard)
@ApiBearerAuth()
export class EmployeeController {
  constructor(private readonly employeeService: EmployeeService) {}

  @Post()
  @ApiOperation({
    summary: 'Creează un angajat nou',
    description: 'Adaugă un nou angajat în sistem cu toate informațiile necesare.',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Angajatul a fost creat cu succes',
    type: Employee,
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Un angajat cu acest email sau CNP există deja',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Date invalide (ex: data angajării în viitor, vârsta sub 16 ani)',
  })
  async create(@Body() createEmployeeDto: CreateEmployeeDto): Promise<Employee> {
    return await this.employeeService.create(createEmployeeDto);
  }

  @Post('with-documents')
  @ApiOperation({
    summary: 'Creează un angajat nou cu documente',
    description: 'Adaugă un nou angajat în sistem cu toate informațiile necesare și documentele asociate.',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Angajatul a fost creat cu succes',
    type: Employee,
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Un angajat cu acest email sau CNP există deja',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Date invalide (ex: data angajării în viitor, vârsta sub 16 ani)',
  })
  async createWithDocuments(@Body() createEmployeeWithDocumentsDto: any): Promise<Employee> {
    return await this.employeeService.createWithDocuments(createEmployeeWithDocumentsDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listează toți angajații',
    description: 'Returnează o listă paginată cu toți angajații din sistem cu opțiuni de filtrare.',
  })
  @ApiQuery({ name: 'page', required: false, description: 'Numărul paginii (implicit: 1)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Numărul de angajați per pagină (implicit: 10)' })
  @ApiQuery({ name: 'is_active', required: false, description: 'Filtrează după status activ' })
  @ApiQuery({ name: 'department', required: false, description: 'Filtrează după departament' })
  @ApiQuery({ name: 'contract_type', required: false, description: 'Filtrează după tipul contractului' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lista angajaților a fost returnată cu succes',
    schema: {
      type: 'object',
      properties: {
        employees: {
          type: 'array',
          items: { $ref: '#/components/schemas/Employee' },
        },
        total: { type: 'number', description: 'Numărul total de angajați' },
        totalPages: { type: 'number', description: 'Numărul total de pagini' },
      },
    },
  })
  async findAll(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Query('is_active') is_active?: string,
    @Query('department') department?: string,
    @Query('contract_type') contract_type?: string,
  ): Promise<{ employees: Employee[]; total: number; totalPages: number }> {
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    const isActiveFilter = is_active !== undefined ? is_active === 'true' : undefined;
    const departmentFilter = department ? parseInt(department, 10) : undefined;

    return await this.employeeService.findAll(
      pageNum,
      limitNum,
      isActiveFilter,
      departmentFilter,
      contract_type,
    );
  }

  @Get('statistics')
  @ApiOperation({
    summary: 'Statistici angajați',
    description: 'Returnează statistici detaliate despre angajați.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Statisticile au fost returnate cu succes',
    schema: {
      type: 'object',
      properties: {
        total: { type: 'number', description: 'Numărul total de angajați' },
        active: { type: 'number', description: 'Numărul de angajați activi' },
        inactive: { type: 'number', description: 'Numărul de angajați inactivi' },
        byContractType: { type: 'object', description: 'Numărul de angajați per tip de contract' },
        byGender: { type: 'object', description: 'Numărul de angajați per gen' },
        hiredThisMonth: { type: 'number', description: 'Numărul de angajați din această lună' },
      },
    },
  })
  async getStatistics(): Promise<{
    total: number;
    active: number;
    inactive: number;
    byContractType: { [key: string]: number };
    byGender: { [key: string]: number };
    hiredThisMonth: number;
  }> {
    return await this.employeeService.getStatistics();
  }

  @Get('email/:email')
  @ApiOperation({
    summary: 'Găsește angajat după email',
    description: 'Returnează detaliile angajatului cu email-ul specificat.',
  })
  @ApiParam({ name: 'email', description: 'Email-ul angajatului' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Angajatul a fost găsit',
    type: Employee,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Angajatul cu acest email nu a fost găsit',
  })
  async findByEmail(@Param('email') email: string): Promise<Employee> {
    return await this.employeeService.findByEmail(email);
  }

  @Get('cnp/:cnp')
  @ApiOperation({
    summary: 'Găsește angajat după CNP',
    description: 'Returnează detaliile angajatului cu CNP-ul specificat.',
  })
  @ApiParam({ name: 'cnp', description: 'CNP-ul angajatului' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Angajatul a fost găsit',
    type: Employee,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Angajatul cu acest CNP nu a fost găsit',
  })
  async findByCNP(@Param('cnp') cnp: string): Promise<Employee> {
    return await this.employeeService.findByCNP(cnp);
  }

  @Options('file/:fileId')
  async handleFileOptions(@Res() res: any) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.setHeader('Access-Control-Max-Age', '86400');
    res.status(200).end();
  }

  @Get('file/:fileId/info')
  @ApiOperation({
    summary: 'Obține informații despre un fișier',
    description: 'Returnează informații despre fișier pentru debugging.',
  })
  @ApiParam({ name: 'fileId', description: 'ID-ul fișierului' })
  async getFileInfo(@Param('fileId') fileId: string) {
    console.log(`🔍 Controller: Getting file info for ID: ${fileId}`);
    return this.employeeService.getFileInfo(+fileId);
  }

  @Get('file/:fileId')
  @ApiOperation({
    summary: 'Servește un fișier al angajatului pentru vizualizare',
    description: 'Returnează conținutul unui fișier pentru vizualizare în browser sau download.',
  })
  @ApiParam({ name: 'fileId', description: 'ID-ul fișierului' })
  @ApiQuery({ name: 'download', required: false, description: 'Dacă este true, forțează download-ul' })
  @ApiResponse({ status: 200, description: 'Fișierul a fost returnat cu succes' })
  @ApiResponse({ status: 404, description: 'Fișierul nu a fost găsit' })
  async serveEmployeeFile(
    @Param('fileId') fileId: string,
    @Res() res: any,
    @Query('download') download?: string,
  ) {
    console.log(`🔍 Controller: Serving file with ID: ${fileId}, download: ${download}`);
    
    // Setează header-ele CORS manual în controller
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Type, Content-Disposition');
    
    return this.employeeService.serveEmployeeFile(+fileId, download === 'true', res);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Găsește angajat după ID',
    description: 'Returnează detaliile angajatului cu ID-ul specificat, incluzând toate relațiile.',
  })
  @ApiParam({ name: 'id', description: 'ID-ul angajatului' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Angajatul a fost găsit',
    type: Employee,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Angajatul cu acest ID nu a fost găsit',
  })
  async findOne(@Param('id') id: string): Promise<Employee> {
    return await this.employeeService.findOne(+id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizează un angajat',
    description: 'Actualizează informațiile unui angajat existent.',
  })
  @ApiParam({ name: 'id', description: 'ID-ul angajatului de actualizat' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Angajatul a fost actualizat cu succes',
    type: Employee,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Angajatul cu acest ID nu a fost găsit',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Un angajat cu acest email sau CNP există deja',
  })
  async update(
    @Param('id') id: string,
    @Body() updateEmployeeDto: UpdateEmployeeDto,
  ): Promise<Employee> {
    return await this.employeeService.update(+id, updateEmployeeDto);
  }

  @Patch(':id/toggle-active')
  @ApiOperation({
    summary: 'Activează/dezactivează un angajat',
    description: 'Schimbă statusul activ al unui angajat (activ ↔ inactiv).',
  })
  @ApiParam({ name: 'id', description: 'ID-ul angajatului' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Statusul angajatului a fost schimbat cu succes',
    type: Employee,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Angajatul cu acest ID nu a fost găsit',
  })
  async toggleActive(@Param('id') id: string): Promise<Employee> {
    return await this.employeeService.toggleActive(+id);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Șterge un angajat',
    description: 'Șterge definitiv un angajat din sistem. Atenție: această operație este ireversibilă!',
  })
  @ApiParam({ name: 'id', description: 'ID-ul angajatului de șters' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Angajatul a fost șters cu succes',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'Mesajul de confirmare' },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Angajatul cu acest ID nu a fost găsit',
  })
  async remove(@Param('id') id: string): Promise<{ message: string }> {
    return await this.employeeService.remove(+id);
  }

  // Files endpoints for compatibility with frontend
  @Get(':id/files')
  @ApiOperation({
    summary: 'Găsește toate fișierele unui angajat',
    description: 'Returnează toate fișierele din dosarul unui angajat specific.',
  })
  @ApiParam({ name: 'id', description: 'ID-ul angajatului' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Fișierele angajatului au fost găsite',
  })
  async getEmployeeFiles(@Param('id') id: string) {
    return await this.employeeService.getEmployeeFiles(+id);
  }

  @Post(':id/files')
  @ApiOperation({
    summary: 'Adaugă un fișier pentru angajat',
    description: 'Adaugă un nou fișier în dosarul unui angajat.',
  })
  @ApiParam({ name: 'id', description: 'ID-ul angajatului' })
  async addEmployeeFile(@Param('id') id: string, @Body() fileData: any) {
    return await this.employeeService.addEmployeeFile(+id, fileData);
  }

  @Delete('files/:fileId')
  @ApiOperation({
    summary: 'Șterge un fișier al angajatului',
    description: 'Șterge un fișier din dosarul angajatului.',
  })
  @ApiParam({ name: 'fileId', description: 'ID-ul fișierului' })
  async deleteEmployeeFile(@Param('fileId') fileId: string) {
    return await this.employeeService.deleteEmployeeFile(+fileId);
  }

  @Post(':id/documents-with-content')
  @ApiOperation({
    summary: 'Adaugă documente cu conținut base64 pentru angajat',
    description: 'Adaugă documente cu conținut base64 în dosarul unui angajat existent.',
  })
  @ApiParam({ name: 'id', description: 'ID-ul angajatului' })
  async addEmployeeDocumentsWithContent(@Param('id') id: string, @Body() documentsData: any) {
    return await this.employeeService.addEmployeeDocumentsWithContent(+id, documentsData.documents);
  }

} 