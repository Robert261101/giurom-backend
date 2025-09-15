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

  // POST /shift-change-requests – creare cerere (implicit status pending)
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

  // GET /shift-change-requests – listare cereri cu filtrare opțională
  @Get()
  @ApiOperation({ summary: 'Obține cereri de schimb de tură cu filtrare opțională' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lista cererilor de schimb de tură',
    type: [ShiftChangeRequest],
  })
  findAll(
    @Query() filters: FilterShiftChangeRequestsDto,
    @Headers('x-user-id') currentUserId?: string,
  ): Promise<ShiftChangeRequest[]> {
    const userId = currentUserId ? parseInt(currentUserId) : undefined;
    return this.shiftChangeRequestsService.findAll(filters, userId);
  }

  // GET /shift-change-requests/pending – listare cereri în așteptare
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

  // GET /shift-change-requests/:id – obținere cerere specifică
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
    description: 'Nu ai permisiunea să vezi această cerere de schimb de tură',
  })
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @Headers('x-user-id') currentUserId?: string,
  ): Promise<ShiftChangeRequest> {
    const userId = currentUserId ? parseInt(currentUserId) : undefined;
    return this.shiftChangeRequestsService.findOne(id, userId);
  }

  // PATCH /shift-change-requests/:id – modificare status, aprobare/respingere
  @Patch(':id')
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

  // DELETE /shift-change-requests/:id – ștergere cerere
  @Delete(':id')
  @ApiOperation({ summary: 'Șterge o cerere de schimb de tură (doar dacă este pending)' })
  @ApiParam({ name: 'id', description: 'ID-ul cererii de schimb de tură' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Cererea de schimb de tură a fost ștearsă cu succes',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Cererea de schimb de tură nu a fost găsită',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Nu poți șterge cereri de schimb de tură ale altor angajați',
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

  // GET /shift-change-requests/employee/:employeeId/stats – statistici angajat
  @Get('employee/:employeeId/stats')
  @ApiOperation({ summary: 'Obține statisticile de schimb de tură pentru un angajat' })
  @ApiParam({ name: 'employeeId', description: 'ID-ul angajatului' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Statisticile de schimb de tură ale angajatului',
  })
  getEmployeeStats(
    @Param('employeeId', ParseIntPipe) employeeId: number,
    @Query('year') year?: number,
  ): Promise<any> {
    return this.shiftChangeRequestsService.getEmployeeStats(employeeId, year);
  }

  // GET /shift-change-requests/employee/:employeeId – cereri pentru un angajat
  @Get('employee/:employeeId')
  @ApiOperation({ summary: 'Obține cererile de schimb de tură pentru un angajat (ca requester sau replacement)' })
  @ApiParam({ name: 'employeeId', description: 'ID-ul angajatului' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lista cererilor de schimb de tură ale angajatului',
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
}