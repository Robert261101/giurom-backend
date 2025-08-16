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
}