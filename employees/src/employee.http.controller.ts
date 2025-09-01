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
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { EmployeeService } from './employee.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { Employee } from './entities/employee.entity';
import { Response } from 'express';
import { CreateEmployeeFileDto } from './dto/create-employee-file.dto';

@ApiTags('employees')
@Controller('employees')
@ApiBearerAuth()
export class EmployeeHttpController {
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
  async create(@Body() createEmployeeDto: CreateEmployeeDto): Promise<Employee> {
    return this.employeeService.create(createEmployeeDto);
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
  @ApiQuery({ name: 'work_location_id', required: false, description: 'Filtrează după locația implicită a angajatului' })
  @ApiQuery({ name: 'contract_type', required: false, description: 'Filtrează după tipul contractului' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lista angajaților a fost returnată cu succes',
  })
  async findAll(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Query('is_active') is_active?: string,
    @Query('department') department?: string,
    @Query('contract_type') contract_type?: string,
    @Query('work_location_id') work_location_id?: string,
  ): Promise<{ employees: Employee[]; total: number; totalPages: number }> {
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    const isActiveFilter = is_active !== undefined ? is_active === 'true' : undefined;
    const departmentFilter = department ? parseInt(department, 10) : undefined;

    return this.employeeService.findAll(
      pageNum,
      limitNum,
      isActiveFilter,
      departmentFilter,
      contract_type,
      work_location_id ? parseInt(work_location_id, 10) : undefined,
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
  })
  async getStatistics(): Promise<{
    total: number;
    active: number;
    inactive: number;
    byContractType: { [key: string]: number };
    byGender: { [key: string]: number };
    hiredThisMonth: number;
  }> {
    return this.employeeService.getStatistics();
  }

  // List employee files by employee ID
  @Get(':employeeId/files')
  async getEmployeeFiles(
    @Param('employeeId', ParseIntPipe) employeeId: number,
  ) {
    return this.employeeService.findFilesByEmployee(employeeId);
  }

  // Optional: list via query (used by some legacy callers)
  @Get('files')
  async getFilesByQuery(@Query('employee_id') employee_id?: string) {
    if (!employee_id) {
      return [];
    }
    const idNum = parseInt(employee_id as any, 10);
    if (!Number.isFinite(idNum)) {
      return [];
    }
    return this.employeeService.findFilesByEmployee(idNum);
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
  async findByEmail(@Param('email') email: string): Promise<Employee> {
    return this.employeeService.findByEmail(email);
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
  async findByCNP(@Param('cnp') cnp: string): Promise<Employee> {
    return this.employeeService.findByCNP(cnp);
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
  async findOne(@Param('id') id: string): Promise<Employee> {
    return this.employeeService.findOne(+id);
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
  async update(
    @Param('id') id: string,
    @Body() updateEmployeeDto: UpdateEmployeeDto,
  ): Promise<Employee> {
    return this.employeeService.update(+id, updateEmployeeDto);
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
  async toggleActive(@Param('id') id: string): Promise<Employee> {
    return this.employeeService.toggleActive(+id);
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
  })
  async remove(@Param('id') id: string): Promise<{ message: string }> {
    return this.employeeService.remove(+id);
  }

  // Serve employee file (download or inline based on query)
  @Get('file/:fileId')
  async getEmployeeFile(
    @Param('fileId', ParseIntPipe) fileId: number,
    @Query('download') download: string,
    @Res() res: Response,
  ) {
    const forceDownload = download === 'true';
    const served = await this.employeeService.serveFile(fileId, forceDownload);
    const buffer = Buffer.from(served.data, 'base64');
    res.setHeader('Content-Type', served.mimeType || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `${forceDownload || served.disposition === 'attachment' ? 'attachment' : 'inline'}; filename="${served.fileName}"`
    );
    res.setHeader('Content-Length', buffer.length.toString());
    return res.send(buffer);
  }

  // Force inline view
  @Get('file/:fileId/view')
  async viewEmployeeFile(
    @Param('fileId', ParseIntPipe) fileId: number,
    @Res() res: Response,
  ) {
    const served = await this.employeeService.serveFile(fileId, false);
    const buffer = Buffer.from(served.data, 'base64');
    res.setHeader('Content-Type', served.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${served.fileName}"`);
    res.setHeader('Content-Length', buffer.length.toString());
    return res.send(buffer);
  }

  // Create employee file (metadata or with base64 content)
  @Post(':employeeId/files')
  async addEmployeeFile(
    @Param('employeeId', ParseIntPipe) employeeId: number,
    @Body() body: Omit<CreateEmployeeFileDto, 'employee_id'> & { employee_id?: number },
  ) {
    const dto: CreateEmployeeFileDto = {
      employee_id: employeeId,
      file_name: body.file_name,
      file_type: body.file_type,
      file_link: body.file_link,
      file_content: body.file_content,
    } as CreateEmployeeFileDto;
    return this.employeeService.createFile(dto);
  }

  // Backwards-compatible route used by frontend add form
  @Post(':employeeId/documents-with-content')
  async addEmployeeDocumentWithContent(
    @Param('employeeId', ParseIntPipe) employeeId: number,
    @Body() body: { documents: Array<{ fileName: string; name?: string; size?: number; content: string; type?: string; document_type?: string; note?: string }> },
  ) {
    if (!body?.documents || body.documents.length === 0) {
      return { message: 'No documents provided' };
    }
    const first = body.documents[0];
    const fileName = first.fileName || first.name || 'document.bin';
    // Build default link into repo files folder
    const file_link = `/files/employees/${employeeId}/${fileName}`;
    return this.employeeService.createFile({
      employee_id: employeeId,
      file_name: fileName,
      file_type: first.document_type || first.type || 'Altele',
      file_link,
      file_content: first.content,
    } as CreateEmployeeFileDto);
  }
}