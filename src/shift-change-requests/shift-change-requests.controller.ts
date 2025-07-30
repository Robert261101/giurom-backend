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
  HttpStatus,
  Headers,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { ShiftChangeRequestsService } from './shift-change-requests.service';
import { CreateShiftChangeRequestDto } from './dto/create-shift-change-request.dto';
import { UpdateShiftChangeStatusDto } from './dto/update-shift-change-status.dto';
import { FilterShiftChangeRequestsDto } from './dto/filter-shift-change-requests.dto';
import { ShiftChangeRequest } from './entities/shift-change-request.entity';

@ApiTags('shift-change-requests')
@Controller('shift-change-requests')
@ApiBearerAuth()
export class ShiftChangeRequestsController {
  constructor(private readonly shiftChangeRequestsService: ShiftChangeRequestsService) {}

  // POST /shift-change-request – creare cerere (implicit status pending)
  @Post()
  @ApiOperation({ summary: 'Creează o cerere de schimb de tură cu status pending' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Cererea de schimb de tură a fost creată cu succes',
    type: ShiftChangeRequest,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Date invalide sau suprapunere cu alte cereri aprobate',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Angajatul sau înlocuitorul nu a fost găsit',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Nu poți crea cereri pentru alți angajați',
  })
  create(
    @Body() createShiftChangeRequestDto: CreateShiftChangeRequestDto,
    @Headers('x-user-id') currentUserId?: string,
  ): Promise<ShiftChangeRequest> {
    const userId = currentUserId ? parseInt(currentUserId) : undefined;
    return this.shiftChangeRequestsService.create(createShiftChangeRequestDto, userId);
  }

  // GET /shift-change-request/pending – listare cereri în așteptare
  @Get('pending')
  @ApiOperation({ summary: 'Obține toate cererile de schimb de tură în așteptare' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lista cererilor de schimb de tură în așteptare',
    type: [ShiftChangeRequest],
  })
  findPending(@Headers('x-user-id') currentUserId?: string): Promise<ShiftChangeRequest[]> {
    const userId = currentUserId ? parseInt(currentUserId) : undefined;
    return this.shiftChangeRequestsService.findPending(userId);
  }

  // GET /shift-change-requests – listare toate cererile cu filtrare opțională
  @Get()
  @ApiOperation({ summary: 'Obține cereri de schimb de tură cu filtrare opțională' })
  @ApiQuery({ name: 'status', required: false, description: 'Statusul cererii (pending, approved, rejected)' })
  @ApiQuery({ name: 'employee_id', required: false, description: 'ID-ul angajatului care cere schimbul' })
  @ApiQuery({ name: 'replacement_id', required: false, description: 'ID-ul angajatului înlocuitor' })
  @ApiQuery({ name: 'start_date', required: false, description: 'Data de început pentru filtrare (ISO format)' })
  @ApiQuery({ name: 'end_date', required: false, description: 'Data de sfârșit pentru filtrare (ISO format)' })
  @ApiQuery({ name: 'reviewed_by_id', required: false, description: 'ID-ul managerului care a aprobat/respins' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lista cererilor de schimb de tură filtrate',
    type: [ShiftChangeRequest],
  })
  findAll(
    @Query() filters: FilterShiftChangeRequestsDto,
    @Headers('x-user-id') currentUserId?: string,
  ): Promise<ShiftChangeRequest[]> {
    const userId = currentUserId ? parseInt(currentUserId) : undefined;
    return this.shiftChangeRequestsService.findAll(filters, userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obține detaliile unei cereri de schimb de tură specifice' })
  @ApiParam({ name: 'id', description: 'ID-ul cererii de schimb de tură' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Detaliile cererii de schimb de tură',
    type: ShiftChangeRequest,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Cererea de schimb de tură nu a fost găsită',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Nu ai permisiunea să vezi această cerere',
  })
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @Headers('x-user-id') currentUserId?: string,
  ): Promise<ShiftChangeRequest> {
    const userId = currentUserId ? parseInt(currentUserId) : undefined;
    return this.shiftChangeRequestsService.findOne(id, userId);
  }

  // PATCH /shift-change-request/:id – modificare status, aprobare/respingere
  @Patch(':id/status')
  @ApiOperation({ summary: 'Modifică statusul unei cereri de schimb de tură (aprobare/respingere)' })
  @ApiParam({ name: 'id', description: 'ID-ul cererii de schimb de tură' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Statusul cererii a fost actualizat cu succes',
    type: ShiftChangeRequest,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Cererea de schimb de tură sau managerul nu a fost găsit',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Nu ai permisiunea să aprobi/respingi cereri de schimb de tură',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Doar cererile în așteptare pot fi modificate sau nu poți aproba cereri în care ești implicat',
  })
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateStatusDto: UpdateShiftChangeStatusDto,
    @Headers('x-user-id') currentUserId?: string,
  ): Promise<ShiftChangeRequest> {
    const userId = currentUserId ? parseInt(currentUserId) : undefined;
    return this.shiftChangeRequestsService.updateStatus(id, updateStatusDto, userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Șterge o cerere de schimb de tură (doar dacă este pending)' })
  @ApiParam({ name: 'id', description: 'ID-ul cererii de schimb de tură' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Cererea de schimb de tură a fost ștearsă cu succes',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Cererea de schimb de tură nu a fost găsită',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Nu poți șterge cereri ale altor angajați',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Doar cererile în așteptare pot fi șterse',
  })
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Headers('x-user-id') currentUserId?: string,
  ): Promise<void> {
    const userId = currentUserId ? parseInt(currentUserId) : undefined;
    return this.shiftChangeRequestsService.remove(id, userId);
  }

  // Endpoint suplimentar pentru statistici
  @Get('employee/:employeeId/stats')
  @ApiOperation({ summary: 'Obține statisticile de schimb de tură pentru un angajat' })
  @ApiParam({ name: 'employeeId', description: 'ID-ul angajatului' })
  @ApiQuery({ name: 'year', required: false, description: 'Anul pentru care se calculează statisticile' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Statisticile de schimb de tură ale angajatului',
    schema: {
      type: 'object',
      properties: {
        year: { type: 'number', example: 2024 },
        total_requests: { type: 'number', example: 8 },
        as_requester: { type: 'number', example: 5 },
        as_replacement: { type: 'number', example: 3 },
        approved_requests: { type: 'number', example: 6 },
        pending_requests: { type: 'number', example: 1 },
        rejected_requests: { type: 'number', example: 1 },
      },
    },
  })
  getEmployeeStats(
    @Param('employeeId', ParseIntPipe) employeeId: number,
    @Query('year') year?: number,
  ): Promise<any> {
    return this.shiftChangeRequestsService.getEmployeeStats(employeeId, year);
  }

  // Endpoint pentru manageri să vadă cererile care necesită aprobare
  @Get('manager/:managerId/for-approval')
  @ApiOperation({ summary: 'Obține cererile care necesită aprobare de către un manager' })
  @ApiParam({ name: 'managerId', description: 'ID-ul managerului' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lista cererilor care necesită aprobare',
    type: [ShiftChangeRequest],
  })
  findRequestsForApproval(
    @Param('managerId', ParseIntPipe) managerId: number,
  ): Promise<ShiftChangeRequest[]> {
    return this.shiftChangeRequestsService.findRequestsForApproval(managerId);
  }

  // Endpoint pentru obținerea cererilor unui anumit angajat
  @Get('employee/:employeeId')
  @ApiOperation({ summary: 'Obține cererile de schimb de tură ale unui angajat (ca requester sau replacement)' })
  @ApiParam({ name: 'employeeId', description: 'ID-ul angajatului' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lista cererilor angajatului',
    type: [ShiftChangeRequest],
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Nu poți vedea cererile altor angajați',
  })
  findByEmployee(
    @Param('employeeId', ParseIntPipe) employeeId: number,
    @Headers('x-user-id') currentUserId?: string,
  ): Promise<ShiftChangeRequest[]> {
    const userId = currentUserId ? parseInt(currentUserId) : undefined;
    return this.shiftChangeRequestsService.findByEmployee(employeeId, userId);
  }

  // Endpoint pentru obținerea cererilor aprobate într-o anumită perioadă
  @Get('approved/period')
  @ApiOperation({ summary: 'Obține cererile aprobate dintr-o anumită perioadă' })
  @ApiQuery({ name: 'start_date', required: true, description: 'Data de început (ISO format)' })
  @ApiQuery({ name: 'end_date', required: true, description: 'Data de sfârșit (ISO format)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lista cererilor aprobate din perioada specificată',
    type: [ShiftChangeRequest],
  })
  findApprovedInPeriod(
    @Query('start_date') startDate: string,
    @Query('end_date') endDate: string,
    @Headers('x-user-id') currentUserId?: string,
  ): Promise<ShiftChangeRequest[]> {
    const userId = currentUserId ? parseInt(currentUserId) : undefined;
    return this.shiftChangeRequestsService.findAll({
      status: 'approved' as any,
      start_date: startDate,
      end_date: endDate,
    }, userId);
  }

  // Endpoint pentru obținerea cererilor care implică un anumit înlocuitor
  @Get('replacement/:replacementId')
  @ApiOperation({ summary: 'Obține cererile în care un angajat este propus ca înlocuitor' })
  @ApiParam({ name: 'replacementId', description: 'ID-ul angajatului înlocuitor' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lista cererilor în care angajatul este înlocuitor',
    type: [ShiftChangeRequest],
  })
  findByReplacement(
    @Param('replacementId', ParseIntPipe) replacementId: number,
    @Headers('x-user-id') currentUserId?: string,
  ): Promise<ShiftChangeRequest[]> {
    const userId = currentUserId ? parseInt(currentUserId) : undefined;
    return this.shiftChangeRequestsService.findAll({ replacement_id: replacementId }, userId);
  }
}
