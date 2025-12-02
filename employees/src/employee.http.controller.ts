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
import { EmployeeLocation } from './entities/employee-location.entity';
import { CreateEmployeeLocationDto } from './dto/create-employee-location.dto';
import { Response } from 'express';
import { CreateEmployeeFileDto } from './dto/create-employee-file.dto';
import { Buffer } from 'buffer';
import { Permissions } from './permissions/permissions.decorator';
import { InternalServiceGuard } from './auth/internal-service.guard';

@ApiTags('employees')
@Controller('employees')
@ApiBearerAuth()
export class EmployeeHttpController {
  constructor(private readonly employeeService: EmployeeService) {}

  @Post()
  @Permissions('employees.create')
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
  @UseGuards(InternalServiceGuard) // Allow internal service calls
  @Permissions('employees.read')
  @ApiOperation({
    summary: 'Listează toți angajații',
    description: 'Returnează o listă paginată cu toți angajații din sistem cu opțiuni de filtrare.',
  })
  @ApiQuery({ name: 'page', required: false, description: 'Numărul paginii (implicit: 1)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Numărul de angajați per pagină (implicit: 10)' })
  @ApiQuery({ name: 'is_active', required: false, description: 'Filtrează după status activ' })
  @ApiQuery({ name: 'department', required: false, description: 'Filtrează după departament' })
  @ApiQuery({ name: 'work_location_id', required: false, description: 'Filtrează după locația implicită a angajatului' })
  @ApiQuery({ name: 'location_id', required: false, description: 'Filtrează după locația din employees_locations' })
  @ApiQuery({ name: 'contract_type', required: false, description: 'Filtrează după tipul contractului' })
  @ApiQuery({ name: 'department_name', required: false, description: 'Filtrează după numele departamentului' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lista angajații a fost returnată cu succes',
  })
  async findAll(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Query('is_active') is_active?: string,
    @Query('department') department?: string,
    @Query('contract_type') contract_type?: string,
    @Query('work_location_id') work_location_id?: string,
    @Query('location_id') location_id?: string,
    @Query('department_name') department_name?: string,
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
      location_id ? parseInt(location_id, 10) : undefined,
      department_name,
    );
  }

  @Get('statistics')
  @Permissions('employees.read')
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
  @Permissions('employees.read')
  async getEmployeeFiles(
    @Param('employeeId', ParseIntPipe) employeeId: number,
  ) {
    return this.employeeService.findFilesByEmployee(employeeId);
  }

  // Optional: list via query (used by some legacy callers)
  @Get('files')
  @Permissions('employees.read')
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
  @UseGuards(InternalServiceGuard) // Allow internal service calls
  @Permissions('employees.read')
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
  async findByEmail(
    @Param('email') email: string,
  ): Promise<Employee> {
    return this.employeeService.findByEmail(email);
  }

  @Get('phone/:phone')
  @ApiOperation({
    summary: 'Găsește angajat după telefon',
    description: 'Returnează detaliile angajatului cu numărul de telefon specificat.',
  })
  @ApiParam({ name: 'phone', description: 'Numărul de telefon al angajatului' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Angajatul a fost găsit',
    type: Employee,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Angajatul nu a fost găsit',
  })
  async findByPhone(
    @Param('phone') phone: string,
  ): Promise<Employee> {
    return this.employeeService.findByPhone(phone);
  }

  @Get('cnp/:cnp')
  @Permissions('employees.read')
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

  @Get('by-user/:userId')
  @UseGuards(InternalServiceGuard) // Allow internal service calls
  @Permissions('employees.read')
  @ApiOperation({
    summary: 'Găsește angajat după user ID',
    description: 'Returnează detaliile angajatului asociat cu user_id-ul specificat.',
  })
  @ApiParam({ name: 'userId', description: 'ID-ul utilizatorului (din auth service)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Angajatul a fost găsit',
    type: Employee,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Angajatul nu a fost găsit pentru acest user_id',
  })
  async findByUserId(
    @Param('userId', ParseIntPipe) userId: number,
  ): Promise<Employee> {
    return this.employeeService.findByUserId(userId);
  }

  @Get(':id')
  @UseGuards(InternalServiceGuard) // Allow internal service calls
  @Permissions('employees.read')
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
  async findOne(
    @Param('id') id: string,
  ): Promise<Employee> {
    return this.employeeService.findOne(+id);
  }

  @Patch(':id')
  @Permissions('employees.update')
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
  @Permissions('employees.update')
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
  @Permissions('employees.delete')
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
  @Permissions('employees.read')
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
  @Permissions('employees.read')
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
  @Permissions('employees.create')
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
  @Permissions('employees.create')
  async addEmployeeDocumentWithContent(
    @Param('employeeId', ParseIntPipe) employeeId: number,
    @Body() body: { documents: Array<{ fileName: string; name?: string; size?: number; content: string; type?: string; document_type?: string; note?: string; expire_date?: string }> },
  ) {
    if (!body?.documents || body.documents.length === 0) {
      return { message: 'No documents provided' };
    }
    const first = body.documents[0];
    const fileName = first.fileName || first.name || 'document.bin';
    
    // Get employee to construct proper file link
    const employee = await this.employeeService.findOne(employeeId);
    const employeeName = this.employeeService['simplifyEmployeeName'](employee.first_name, employee.last_name);
    
    // Check if this is a profile picture
    const isProfilePicture = (first.document_type || first.type) === 'profile_picture';
    
    // Build correct file link path
    const fileLinkPath = isProfilePicture
      ? `/files/employees/${employeeName}/profile_picture/${fileName}`
      : `/files/employees/${employeeName}/${fileName}`;
      
    return this.employeeService.createFile({
      employee_id: employeeId,
      file_name: fileName,
      file_type: first.document_type || first.type || 'Altele',
      file_link: fileLinkPath,
      file_content: first.content,
      expire_date: first.expire_date,
    } as CreateEmployeeFileDto);
  }

  // ==================== EMPLOYEES LOCATIONS ENDPOINTS ====================

  @Post('locations/assign')
  @Permissions('employees.update')
  @ApiOperation({
    summary: 'Asignă un angajat la o locație',
    description: 'Creează o asociere între un angajat și o locație de lucru.',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Angajatul a fost asignat cu succes la locație',
    type: EmployeeLocation,
  })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: 'Angajatul este deja asignat la această locație' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Angajatul nu a fost găsit' })
  async assignEmployeeToLocation(
    @Body() assignDto: CreateEmployeeLocationDto,
  ): Promise<EmployeeLocation> {
    return this.employeeService.assignEmployeeToLocation(assignDto);
  }

  @Get(':employeeId/locations')
  @Permissions('employees.read')
  @ApiOperation({
    summary: 'Obține locațiile unui angajat',
    description: 'Returnează toate locațiile la care este asignat un angajat.',
  })
  @ApiParam({ name: 'employeeId', description: 'ID-ul angajatului' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lista locațiilor angajatului',
    type: [EmployeeLocation],
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Angajatul nu a fost găsit' })
  async getEmployeeLocations(
    @Param('employeeId', ParseIntPipe) employeeId: number,
  ): Promise<EmployeeLocation[]> {
    return this.employeeService.findEmployeeLocations(employeeId);
  }

  @Get('locations/:locationId/employees')
  @Permissions('employees.read')
  @ApiOperation({
    summary: 'Obține angajații unei locații',
    description: 'Returnează toți angajații asignați la o locație de lucru.',
  })
  @ApiParam({ name: 'locationId', description: 'ID-ul locației' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lista angajaților de la locație',
    type: [EmployeeLocation],
  })
  async getLocationEmployees(
    @Param('locationId', ParseIntPipe) locationId: number,
  ): Promise<EmployeeLocation[]> {
    console.log('🔍 [EMPLOYEES CONTROLLER] Cerere pentru angajații din locația:', locationId);
    const result = await this.employeeService.findLocationEmployees(locationId);
    console.log('🔍 [EMPLOYEES CONTROLLER] Angajați returnați:', result.length);
    return result;
  }

  @Get('location/:locationId')
  @Permissions('employees.read')
  @ApiOperation({ summary: 'Obține toți angajații din locația specificată' })
  @ApiParam({ name: 'locationId', description: 'ID-ul locației' })
  @ApiResponse({ status: 200, description: 'Lista angajaților din locație' })
  async getEmployeesByLocation(@Param('locationId', ParseIntPipe) locationId: number) {
    console.log('🔍 [EMPLOYEES CONTROLLER] Cerere pentru angajații din locația:', locationId);
    const employees = await this.employeeService.findAll(1, 1000, undefined, undefined, undefined, undefined, locationId);
    console.log('🔍 [EMPLOYEES CONTROLLER] Angajați returnați:', employees.employees.length);
    return { employees: employees.employees };
  }

  @Delete(':employeeId/locations/:locationId')
  @Permissions('employees.update')
  @ApiOperation({
    summary: 'Elimină angajatul de la locație',
    description: 'Șterge asocierea dintre un angajat și o locație de lucru.',
  })
  @ApiParam({ name: 'employeeId', description: 'ID-ul angajatului' })
  @ApiParam({ name: 'locationId', description: 'ID-ul locației' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Angajatul a fost eliminat cu succes de la locație',
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Asocierea nu a fost găsită' })
  async removeEmployeeFromLocation(
    @Param('employeeId', ParseIntPipe) employeeId: number,
    @Param('locationId', ParseIntPipe) locationId: number,
  ): Promise<{ message: string }> {
    return this.employeeService.removeEmployeeFromLocation(employeeId, locationId);
  }

  @Get('company/:companyId')
  @Permissions('employees.read')
  @ApiOperation({ summary: 'Obține toți angajații companiei' })
  @ApiParam({ name: 'companyId', description: 'ID-ul companiei' })
  @ApiResponse({ status: 200, description: 'Lista angajaților companiei' })
  async getEmployeesByCompany(@Param('companyId', ParseIntPipe) companyId: number) {
    return this.employeeService.findAllByCompany(companyId);
  }

  // Get files expiring on a specific date
  @Get('files/expiring/:targetDate')
  @Permissions('employees.read')
  @ApiOperation({ summary: 'Obține fișierele angajaților care expiră la o anumită dată' })
  @ApiParam({ name: 'targetDate', description: 'Data la care expiră fișierele (format: YYYY-MM-DD)' })
  @ApiResponse({ status: 200, description: 'Lista fișierelor care expiră la data specificată' })
  async getExpiringFiles(@Param('targetDate') targetDate: string) {
    console.log(`[EMPLOYEES CONTROLLER] Getting files expiring on ${targetDate}`);
    return this.employeeService.findExpiringFiles(targetDate);
  }

  // Get files that have already expired
  @Get('files/expired')
  @Permissions('employees.read')
  @ApiOperation({ summary: 'Obține fișierele angajaților care au expirat deja' })
  @ApiResponse({ status: 200, description: 'Lista fișierelor care au expirat deja' })
  async getExpiredFiles() {
    console.log(`[EMPLOYEES CONTROLLER] Getting expired files`);
    return this.employeeService.findExpiredFiles();
  }
}