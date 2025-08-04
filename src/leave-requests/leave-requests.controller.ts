import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
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
} from '@nestjs/swagger';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { LeaveRequestsService } from './leave-requests.service';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { UpdateLeaveRequestStatusDto } from './dto/update-leave-request-status.dto';
import { LeaveRequest } from './entities/leave-request.entity';

@ApiTags('leave-requests')
@Controller('leave-request')
@ApiBearerAuth()
export class LeaveRequestsController {
  constructor(private readonly leaveRequestsService: LeaveRequestsService) {}

  // POST /leave-request – creare cerere (status implicit pending)
  @Post()
  @Permissions('leave-requests:create')
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
  @Permissions('leave-requests:read')
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

  // PATCH /leave-request/:id – modificare status și aprobare
  @Patch(':id')
  @Permissions('leave-requests:approve')
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

  // ===== ENDPOINT-URI SUPLIMENTARE COMENTATE =====
  // Acestea pot fi decomentate dacă sunt necesare în viitor

  /*
  @Get()
  @ApiOperation({ summary: 'Obține cereri de concediu cu filtrare opțională' })
  findAll(
    @Query() filters: FilterLeaveRequestsDto,
    @Headers('x-user-id') currentUserId?: string,
  ): Promise<LeaveRequest[]> {
    const userId = currentUserId ? parseInt(currentUserId) : undefined;
    return this.leaveRequestsService.findAll(filters, userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obține detaliile unei cereri de concediu specifice' })
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @Headers('x-user-id') currentUserId?: string,
  ): Promise<LeaveRequest> {
    const userId = currentUserId ? parseInt(currentUserId) : undefined;
    return this.leaveRequestsService.findOne(id, userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Șterge o cerere de concediu (doar dacă este pending)' })
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Headers('x-user-id') currentUserId?: string,
  ): Promise<void> {
    const userId = currentUserId ? parseInt(currentUserId) : undefined;
    return this.leaveRequestsService.remove(id, userId);
  }

  @Get('employee/:employeeId/stats')
  @ApiOperation({ summary: 'Obține statisticile de concediu pentru un angajat' })
  getEmployeeStats(
    @Param('employeeId', ParseIntPipe) employeeId: number,
    @Query('year') year?: number,
  ): Promise<any> {
    return this.leaveRequestsService.getEmployeeStats(employeeId, year);
  }
  */
}
