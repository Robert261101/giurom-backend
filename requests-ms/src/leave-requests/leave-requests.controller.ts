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
  UseGuards,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { Permissions } from '../permissions/permissions.decorator';
import { PermissionsGuard } from '../permissions/permissions.guard';
import { LeaveRequestsService } from './leave-requests.service';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { UpdateLeaveRequestStatusDto } from './dto/update-leave-request-status.dto';
import { FilterLeaveRequestsDto } from './dto/filter-leave-requests.dto';
import { LeaveRequest } from './entities/leave-request.entity';

@ApiTags('leave-requests')
@Controller('leave-requests')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
export class LeaveRequestsController {
  private readonly logger = new Logger(LeaveRequestsController.name);

  constructor(private readonly leaveRequestsService: LeaveRequestsService) {}

  // POST /leave-requests – creare cerere (status implicit pending)
  @Post()
  @Permissions('leave-requests.create')
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
    this.logger.log(`Create leave request called by user: ${userId}`);
    return this.leaveRequestsService.create(createLeaveRequestDto, userId);
  }

  // GET /leave-requests – listare cereri cu filtrare opțională
  @Get()
  @Permissions('leave-requests.read')
  @ApiOperation({ summary: 'Obține cereri de concediu cu filtrare opțională' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lista cererilor de concediu',
    type: [LeaveRequest],
  })
  findAll(
    @Query() filters: FilterLeaveRequestsDto,
    @Headers('x-user-id') currentUserId?: string,
  ): Promise<LeaveRequest[]> {
    const userId = currentUserId ? parseInt(currentUserId) : undefined;
    this.logger.log(`Find all leave requests called by user: ${userId} with filters: ${JSON.stringify(filters)}`);
    return this.leaveRequestsService.findAll(filters, userId);
  }

  // GET /leave-requests/pending – listare cereri în așteptare
  @Get('pending')
  @Permissions('leave-requests.read')
  @ApiOperation({ summary: 'Obține toate cererile de concediu în așteptare' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lista cererilor de concediu în așteptare',
    type: [LeaveRequest],
  })
  findPending(@Headers('x-user-id') currentUserId?: string): Promise<LeaveRequest[]> {
    const userId = currentUserId ? parseInt(currentUserId) : undefined;
    this.logger.log(`Find pending leave requests called by user: ${userId}`);
    return this.leaveRequestsService.findPending(userId);
  }

  // GET /leave-requests/:id – obținere cerere specifică
  @Get(':id')
  @Permissions('leave-requests.read')
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
    description: 'Nu ai permisiunea să vezi această cerere de concediu',
  })
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @Headers('x-user-id') currentUserId?: string,
  ): Promise<LeaveRequest> {
    const userId = currentUserId ? parseInt(currentUserId) : undefined;
    this.logger.log(`Find one leave request ${id} called by user: ${userId}`);
    return this.leaveRequestsService.findOne(id, userId);
  }

  // PATCH /leave-requests/:id – modificare status și aprobare
  @Patch(':id')
  @Permissions('leave-requests.update')
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
    this.logger.log(`Update status for leave request ${id} called by user: ${userId}`);
    return this.leaveRequestsService.updateStatus(id, updateStatusDto, userId);
  }

  // DELETE /leave-requests/:id – ștergere cerere
  @Delete(':id')
  @Permissions('leave-requests.delete')
  @ApiOperation({ summary: 'Șterge o cerere de concediu (doar dacă este pending)' })
  @ApiParam({ name: 'id', description: 'ID-ul cererii de concediu' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Cererea de concediu a fost ștearsă cu succes',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Cererea de concediu nu a fost găsită',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Nu poți șterge cereri de concediu ale altor angajați',
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
    this.logger.log(`Delete leave request ${id} called by user: ${userId}`);
    return this.leaveRequestsService.remove(id, userId);
  }

  // GET /leave-requests/employee/:employeeId/stats – statistici angajat
  @Get('employee/:employeeId/stats')
  @Permissions('leave-requests.read')
  @ApiOperation({ summary: 'Obține statisticile de concediu pentru un angajat' })
  @ApiParam({ name: 'employeeId', description: 'ID-ul angajatului' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Statisticile de concediu ale angajatului',
  })
  getEmployeeStats(
    @Param('employeeId', ParseIntPipe) employeeId: number,
    @Query('year') year?: number,
  ): Promise<any> {
    this.logger.log(`Get employee stats for employee ${employeeId} called`);
    return this.leaveRequestsService.getEmployeeStats(employeeId, year);
  }
}