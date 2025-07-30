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
import { LeaveRequestsService } from './leave-requests.service';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { UpdateLeaveRequestStatusDto } from './dto/update-leave-request-status.dto';
import { FilterLeaveRequestsDto } from './dto/filter-leave-requests.dto';
import { LeaveRequest } from './entities/leave-request.entity';

@ApiTags('leave-requests')
@Controller('leave-requests')
@ApiBearerAuth()
export class LeaveRequestsController {
  constructor(private readonly leaveRequestsService: LeaveRequestsService) {}

  // POST /leave-request – creare cerere (status implicit pending)
  @Post()
  @ApiOperation({ summary: 'Creează o cerere de concediu cu status pending' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Cererea de concediu a fost creată cu succes',
    type: LeaveRequest,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Date invalide sau suprapunere cu alte cereri aprobate',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Angajatul nu a fost găsit',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Nu poți crea cereri pentru alți angajați',
  })
  create(
    @Body() createLeaveRequestDto: CreateLeaveRequestDto,
    @Headers('x-user-id') currentUserId?: string,
  ): Promise<LeaveRequest> {
    const userId = currentUserId ? parseInt(currentUserId) : undefined;
    return this.leaveRequestsService.create(createLeaveRequestDto, userId);
  }

  // GET /leave-request/pending – listare cereri în așteptare
  @Get('pending')
  @ApiOperation({ summary: 'Obține toate cererile de concediu în așteptare' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lista cererilor de concediu în așteptare',
    type: [LeaveRequest],
  })
  findPending(@Headers('x-user-id') currentUserId?: string): Promise<LeaveRequest[]> {
    const userId = currentUserId ? parseInt(currentUserId) : undefined;
    return this.leaveRequestsService.findPending(userId);
  }

  // GET /leave-requests – listare toate cererile cu filtrare opțională
  @Get()
  @ApiOperation({ summary: 'Obține cereri de concediu cu filtrare opțională' })
  @ApiQuery({ name: 'status', required: false, description: 'Statusul cererii (pending, approved, rejected)' })
  @ApiQuery({ name: 'employee_id', required: false, description: 'ID-ul angajatului' })
  @ApiQuery({ name: 'leave_type', required: false, description: 'Tipul concediului' })
  @ApiQuery({ name: 'start_date', required: false, description: 'Data de început pentru filtrare (ISO format)' })
  @ApiQuery({ name: 'end_date', required: false, description: 'Data de sfârșit pentru filtrare (ISO format)' })
  @ApiQuery({ name: 'reviewed_by_id', required: false, description: 'ID-ul managerului care a aprobat/respins' })
  @ApiQuery({ name: 'duration_unit', required: false, description: 'Unitatea de durată (days, hours)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lista cererilor de concediu filtrate',
    type: [LeaveRequest],
  })
  findAll(
    @Query() filters: FilterLeaveRequestsDto,
    @Headers('x-user-id') currentUserId?: string,
  ): Promise<LeaveRequest[]> {
    const userId = currentUserId ? parseInt(currentUserId) : undefined;
    return this.leaveRequestsService.findAll(filters, userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obține detaliile unei cereri de concediu specifice' })
  @ApiParam({ name: 'id', description: 'ID-ul cererii de concediu' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Detaliile cererii de concediu',
    type: LeaveRequest,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Cererea de concediu nu a fost găsită',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Nu ai permisiunea să vezi această cerere',
  })
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @Headers('x-user-id') currentUserId?: string,
  ): Promise<LeaveRequest> {
    const userId = currentUserId ? parseInt(currentUserId) : undefined;
    return this.leaveRequestsService.findOne(id, userId);
  }

  // PATCH /leave-request/:id – modificare status și aprobare
  @Patch(':id/status')
  @ApiOperation({ summary: 'Modifică statusul unei cereri de concediu (aprobare/respingere)' })
  @ApiParam({ name: 'id', description: 'ID-ul cererii de concediu' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Statusul cererii a fost actualizat cu succes',
    type: LeaveRequest,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Cererea de concediu sau managerul nu a fost găsit',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Nu ai permisiunea să aprobi/respingi cereri de concediu',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Doar cererile în așteptare pot fi modificate sau nu poți aproba propria cerere',
  })
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateStatusDto: UpdateLeaveRequestStatusDto,
    @Headers('x-user-id') currentUserId?: string,
  ): Promise<LeaveRequest> {
    const userId = currentUserId ? parseInt(currentUserId) : undefined;
    return this.leaveRequestsService.updateStatus(id, updateStatusDto, userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Șterge o cerere de concediu (doar dacă este pending)' })
  @ApiParam({ name: 'id', description: 'ID-ul cererii de concediu' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Cererea de concediu a fost ștearsă cu succes',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Cererea de concediu nu a fost găsită',
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
    return this.leaveRequestsService.remove(id, userId);
  }

  // Endpoint suplimentar pentru statistici
  @Get('employee/:employeeId/stats')
  @ApiOperation({ summary: 'Obține statisticile de concediu pentru un angajat' })
  @ApiParam({ name: 'employeeId', description: 'ID-ul angajatului' })
  @ApiQuery({ name: 'year', required: false, description: 'Anul pentru care se calculează statisticile' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Statisticile de concediu ale angajatului',
    schema: {
      type: 'object',
      properties: {
        year: { type: 'number', example: 2024 },
        total_requests: { type: 'number', example: 5 },
        approved_requests: { type: 'number', example: 3 },
        pending_requests: { type: 'number', example: 1 },
        rejected_requests: { type: 'number', example: 1 },
        total_days_approved: { type: 'number', example: 15.5 },
      },
    },
  })
  getEmployeeStats(
    @Param('employeeId', ParseIntPipe) employeeId: number,
    @Query('year') year?: number,
  ): Promise<any> {
    return this.leaveRequestsService.getEmployeeStats(employeeId, year);
  }

  // Endpoint pentru manageri să vadă cererile care necesită aprobare
  @Get('manager/:managerId/for-approval')
  @ApiOperation({ summary: 'Obține cererile care necesită aprobare de către un manager' })
  @ApiParam({ name: 'managerId', description: 'ID-ul managerului' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lista cererilor care necesită aprobare',
    type: [LeaveRequest],
  })
  findRequestsForApproval(
    @Param('managerId', ParseIntPipe) managerId: number,
  ): Promise<LeaveRequest[]> {
    return this.leaveRequestsService.findRequestsForApproval(managerId);
  }

  // Endpoint pentru obținerea cererilor aprobate într-o anumită perioadă
  @Get('approved/period')
  @ApiOperation({ summary: 'Obține cererile aprobate dintr-o anumită perioadă' })
  @ApiQuery({ name: 'start_date', required: true, description: 'Data de început (ISO format)' })
  @ApiQuery({ name: 'end_date', required: true, description: 'Data de sfârșit (ISO format)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lista cererilor aprobate din perioada specificată',
    type: [LeaveRequest],
  })
  findApprovedInPeriod(
    @Query('start_date') startDate: string,
    @Query('end_date') endDate: string,
    @Headers('x-user-id') currentUserId?: string,
  ): Promise<LeaveRequest[]> {
    const userId = currentUserId ? parseInt(currentUserId) : undefined;
    return this.leaveRequestsService.findAll({
      status: 'approved' as any,
      start_date: startDate,
      end_date: endDate,
    }, userId);
  }

  // Endpoint pentru obținerea cererilor pe tipul de concediu
  @Get('type/:leaveType')
  @ApiOperation({ summary: 'Obține cererile de un anumit tip de concediu' })
  @ApiParam({ name: 'leaveType', description: 'Tipul concediului' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lista cererilor de tipul specificat',
    type: [LeaveRequest],
  })
  findByLeaveType(
    @Param('leaveType') leaveType: string,
    @Headers('x-user-id') currentUserId?: string,
  ): Promise<LeaveRequest[]> {
    const userId = currentUserId ? parseInt(currentUserId) : undefined;
    return this.leaveRequestsService.findAll({ leave_type: leaveType }, userId);
  }
}
