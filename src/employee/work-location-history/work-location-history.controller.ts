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
import { ThrottlerGuard } from '@nestjs/throttler';
import { WorkLocationHistoryService } from './work-location-history.service';
import { CreateWorkLocationHistoryDto } from './dto/create-work-location-history.dto';
import { UpdateWorkLocationHistoryDto } from './dto/update-work-location-history.dto';
import { EmployeeWorkLocationHistory } from '../entity/employee-work-location-history.entity';

@ApiTags('employee-work-location-history')
@Controller('employee-work-location-history')
@UseGuards(ThrottlerGuard)
@ApiBearerAuth()
export class WorkLocationHistoryController {
  constructor(private readonly historyService: WorkLocationHistoryService) {}

  @Post()
  @ApiOperation({
    summary: 'Creează o nouă înregistrare în istoricul locațiilor de lucru',
    description: 'Adaugă o nouă înregistrare când un angajat este mutat la o altă locație.',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Înregistrarea a fost creată cu succes',
    type: EmployeeWorkLocationHistory,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Angajatul nu a fost găsit',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Nu se poate adăuga istoric pentru un angajat inactiv',
  })
  async create(@Body() createHistoryDto: CreateWorkLocationHistoryDto): Promise<EmployeeWorkLocationHistory> {
    return await this.historyService.create(createHistoryDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listează toate înregistrările din istoricul locațiilor',
    description: 'Returnează o listă paginată cu toate mutările angajaților între locații.',
  })
  @ApiQuery({ name: 'page', required: false, description: 'Numărul paginii (implicit: 1)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Numărul de înregistrări per pagină (implicit: 10)' })
  @ApiQuery({ name: 'employee_id', required: false, description: 'Filtrează după ID-ul angajatului' })
  @ApiQuery({ name: 'work_location_id', required: false, description: 'Filtrează după ID-ul locației' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lista a fost returnată cu succes',
    schema: {
      type: 'object',
      properties: {
        history: {
          type: 'array',
          items: { $ref: '#/components/schemas/EmployeeWorkLocationHistory' },
        },
        total: { type: 'number', description: 'Numărul total de înregistrări' },
        totalPages: { type: 'number', description: 'Numărul total de pagini' },
      },
    },
  })
  async findAll(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Query('employee_id') employee_id?: string,
    @Query('work_location_id') work_location_id?: string,
  ): Promise<{ history: EmployeeWorkLocationHistory[]; total: number; totalPages: number }> {
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    const employeeIdFilter = employee_id ? parseInt(employee_id, 10) : undefined;
    const locationIdFilter = work_location_id ? parseInt(work_location_id, 10) : undefined;

    return await this.historyService.findAll(pageNum, limitNum, employeeIdFilter, locationIdFilter);
  }

  @Get('statistics')
  @ApiOperation({
    summary: 'Statistici pentru istoricul locațiilor',
    description: 'Returnează statistici detaliate despre mutările angajaților.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Statisticile au fost returnate cu succes',
    schema: {
      type: 'object',
      properties: {
        total: { type: 'number', description: 'Numărul total de mutări' },
        byEmployee: { type: 'object', description: 'Numărul de mutări per angajat' },
        byWorkLocation: { type: 'object', description: 'Numărul de mutări per locație' },
        recentChanges: { type: 'number', description: 'Mutări din ultima lună' },
      },
    },
  })
  async getStatistics(): Promise<{
    total: number;
    byEmployee: { [key: string]: number };
    byWorkLocation: { [key: string]: number };
    recentChanges: number;
  }> {
    return await this.historyService.getStatistics();
  }

  @Get('employee/:employee_id')
  @ApiOperation({
    summary: 'Găsește istoricul unui angajat',
    description: 'Returnează toate mutările unui angajat specific.',
  })
  @ApiParam({ name: 'employee_id', description: 'ID-ul angajatului' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Istoricul a fost găsit',
    type: [EmployeeWorkLocationHistory],
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Angajatul nu a fost găsit',
  })
  async findByEmployee(@Param('employee_id') employee_id: string): Promise<EmployeeWorkLocationHistory[]> {
    return await this.historyService.findByEmployee(+employee_id);
  }

  @Get('work-location/:work_location_id')
  @ApiOperation({
    summary: 'Găsește toate mutările pentru o locație',
    description: 'Returnează toate mutările angajaților către/de la o locație specifică.',
  })
  @ApiParam({ name: 'work_location_id', description: 'ID-ul locației de lucru' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Istoricul pentru locație a fost găsit',
    type: [EmployeeWorkLocationHistory],
  })
  async findByWorkLocation(@Param('work_location_id') work_location_id: string): Promise<EmployeeWorkLocationHistory[]> {
    return await this.historyService.findByWorkLocation(+work_location_id);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Găsește o înregistrare din istoric după ID',
    description: 'Returnează detaliile unei mutări specifice.',
  })
  @ApiParam({ name: 'id', description: 'ID-ul înregistrării din istoric' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Înregistrarea a fost găsită',
    type: EmployeeWorkLocationHistory,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Înregistrarea nu a fost găsită',
  })
  async findOne(@Param('id') id: string): Promise<EmployeeWorkLocationHistory> {
    return await this.historyService.findOne(+id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizează o înregistrare din istoric',
    description: 'Modifică informațiile unei mutări existente.',
  })
  @ApiParam({ name: 'id', description: 'ID-ul înregistrării de actualizat' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Înregistrarea a fost actualizată cu succes',
    type: EmployeeWorkLocationHistory,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Înregistrarea sau angajatul nu a fost găsit',
  })
  async update(
    @Param('id') id: string,
    @Body() updateHistoryDto: UpdateWorkLocationHistoryDto,
  ): Promise<EmployeeWorkLocationHistory> {
    return await this.historyService.update(+id, updateHistoryDto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Șterge o înregistrare din istoric',
    description: 'Șterge definitiv o înregistrare de mutare din sistem.',
  })
  @ApiParam({ name: 'id', description: 'ID-ul înregistrării de șters' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Înregistrarea a fost ștearsă cu succes',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'Mesajul de confirmare' },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Înregistrarea nu a fost găsită',
  })
  async remove(@Param('id') id: string): Promise<{ message: string }> {
    return await this.historyService.remove(+id);
  }
} 