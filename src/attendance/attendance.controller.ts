import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  HttpStatus,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
  ApiExtraModels,
} from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AttendanceService } from './attendance.service';
import { CreateShiftDto } from './dto/create-shift.dto';
import { UpdateShiftDto } from './dto/update-shift.dto';
import { CreatePresenceDto } from './dto/create-presence.dto';
import { UpdatePresenceDto } from './dto/update-presence.dto';
import { CreatePresenceInflexionDto } from './dto/create-presence-inflexion.dto';
import { UpdatePresenceInflexionDto } from './dto/update-presence-inflexion.dto';
import { Shift } from './entities/shift.entity';
import { Presence, PresenceStatus } from './entities/presence.entity';
import { PresenceInflexion, InflexionType } from './entities/presence-inflexion.entity';

@ApiTags('attendance')
@Controller('attendance')
@UseGuards(ThrottlerGuard)
@ApiBearerAuth()
@ApiExtraModels(Shift, Presence, PresenceInflexion)
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  // SHIFT ENDPOINTS
  @Post('shifts')
  @ApiOperation({
    summary: 'Creează un nou schimb de lucru',
    description: 'Creează un schimb de lucru pentru un angajat cu validare de overlap și conflicte.',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Schimbul a fost creat cu succes',
    type: Shift,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Date invalide sau conflict de programare',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Există deja un schimb programat în intervalul specificat',
  })
  async createShift(@Body() createShiftDto: CreateShiftDto): Promise<Shift> {
    return await this.attendanceService.createShift(createShiftDto);
  }

  @Get('shifts')
  @ApiOperation({
    summary: 'Listează toate schimburile de lucru',
    description: 'Returnează o listă paginată cu toate schimburile de lucru cu opțiuni de filtrare.',
  })
  @ApiQuery({ name: 'page', required: false, description: 'Numărul paginii', example: 1 })
  @ApiQuery({ name: 'limit', required: false, description: 'Numărul de rezultate pe pagină', example: 10 })
  @ApiQuery({ name: 'employee_id', required: false, description: 'Filtrare după ID-ul angajatului', example: 1 })
  @ApiQuery({ name: 'work_location_id', required: false, description: 'Filtrare după ID-ul locației', example: 1 })
  @ApiQuery({ name: 'department_id', required: false, description: 'Filtrare după ID-ul departamentului', example: 1 })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lista schimburilor a fost returnată cu succes',
  })
  async findAllShifts(
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 10,
    @Query('employee_id', new ParseIntPipe({ optional: true })) employee_id?: number,
    @Query('work_location_id', new ParseIntPipe({ optional: true })) work_location_id?: number,
    @Query('department_id', new ParseIntPipe({ optional: true })) department_id?: number,
  ) {
    return await this.attendanceService.findAllShifts(page, limit, employee_id, work_location_id, department_id);
  }

  @Get('shifts/:id')
  @ApiOperation({
    summary: 'Obține un schimb de lucru după ID',
    description: 'Returnează detaliile complete ale unui schimb de lucru inclusiv relațiile.',
  })
  @ApiParam({ name: 'id', description: 'ID-ul schimbului de lucru', example: 1 })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Schimbul a fost găsit cu succes',
    type: Shift,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Schimbul nu a fost găsit',
  })
  async findShiftById(@Param('id', ParseIntPipe) id: number): Promise<Shift> {
    return await this.attendanceService.findShiftById(id);
  }

  @Patch('shifts/:id')
  @ApiOperation({
    summary: 'Actualizează un schimb de lucru',
    description: 'Actualizează datele unui schimb de lucru existent cu validare de conflicte.',
  })
  @ApiParam({ name: 'id', description: 'ID-ul schimbului de lucru', example: 1 })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Schimbul a fost actualizat cu succes',
    type: Shift,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Schimbul nu a fost găsit',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Există conflict cu alt schimb programat',
  })
  async updateShift(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateShiftDto: UpdateShiftDto,
  ): Promise<Shift> {
    return await this.attendanceService.updateShift(id, updateShiftDto);
  }

  @Delete('shifts/:id')
  @ApiOperation({
    summary: 'Șterge un schimb de lucru',
    description: 'Șterge definitiv un schimb de lucru și toate prezențele asociate.',
  })
  @ApiParam({ name: 'id', description: 'ID-ul schimbului de lucru', example: 1 })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Schimbul a fost șters cu succes',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Schimbul nu a fost găsit',
  })
  async deleteShift(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return await this.attendanceService.deleteShift(id);
  }

  // PRESENCE ENDPOINTS
  @Post('presences')
  @ApiOperation({
    summary: 'Înregistrează o nouă prezență',
    description: 'Creează o înregistrare de prezență pentru un schimb cu calculare automată a orelor lucrate.',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Prezența a fost înregistrată cu succes',
    type: Presence,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Date invalide pentru prezență',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Există deja o prezență pentru această dată și schimb',
  })
  async createPresence(@Body() createPresenceDto: CreatePresenceDto): Promise<Presence> {
    return await this.attendanceService.createPresence(createPresenceDto);
  }

  @Get('presences')
  @ApiOperation({
    summary: 'Listează toate prezențele',
    description: 'Returnează o listă paginată cu toate prezențele cu opțiuni avansate de filtrare.',
  })
  @ApiQuery({ name: 'page', required: false, description: 'Numărul paginii', example: 1 })
  @ApiQuery({ name: 'limit', required: false, description: 'Numărul de rezultate pe pagină', example: 10 })
  @ApiQuery({ name: 'shift_id', required: false, description: 'Filtrare după ID-ul schimbului', example: 1 })
  @ApiQuery({ name: 'status', required: false, enum: PresenceStatus, description: 'Filtrare după status' })
  @ApiQuery({ name: 'start_date', required: false, description: 'Data de început (YYYY-MM-DD)', example: '2024-01-01' })
  @ApiQuery({ name: 'end_date', required: false, description: 'Data de sfârșit (YYYY-MM-DD)', example: '2024-01-31' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lista prezențelor a fost returnată cu succes',
  })
  async findAllPresences(
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 10,
    @Query('shift_id', new ParseIntPipe({ optional: true })) shift_id?: number,
    @Query('status') status?: PresenceStatus,
    @Query('start_date') start_date?: string,
    @Query('end_date') end_date?: string,
  ) {
    return await this.attendanceService.findAllPresences(page, limit, shift_id, status, start_date, end_date);
  }

  @Get('presences/:id')
  @ApiOperation({
    summary: 'Obține o prezență după ID',
    description: 'Returnează detaliile complete ale unei prezențe inclusiv punctele de inflexiune.',
  })
  @ApiParam({ name: 'id', description: 'ID-ul prezenței', example: 1 })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Prezența a fost găsită cu succes',
    type: Presence,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Prezența nu a fost găsită',
  })
  async findPresenceById(@Param('id', ParseIntPipe) id: number): Promise<Presence> {
    return await this.attendanceService.findPresenceById(id);
  }

  @Patch('presences/:id')
  @ApiOperation({
    summary: 'Actualizează o prezență',
    description: 'Actualizează datele unei prezențe existente cu recalculare automată a orelor.',
  })
  @ApiParam({ name: 'id', description: 'ID-ul prezenței', example: 1 })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Prezența a fost actualizată cu succes',
    type: Presence,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Prezența nu a fost găsită',
  })
  async updatePresence(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePresenceDto: UpdatePresenceDto,
  ): Promise<Presence> {
    return await this.attendanceService.updatePresence(id, updatePresenceDto);
  }

  @Delete('presences/:id')
  @ApiOperation({
    summary: 'Șterge o prezență',
    description: 'Șterge definitiv o prezență și toate punctele de inflexiune asociate.',
  })
  @ApiParam({ name: 'id', description: 'ID-ul prezenței', example: 1 })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Prezența a fost ștersă cu succes',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Prezența nu a fost găsită',
  })
  async deletePresence(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return await this.attendanceService.deletePresence(id);
  }

  // PRESENCE INFLEXION ENDPOINTS
  @Post('presence-inflexions')
  @ApiOperation({
    summary: 'Înregistrează un punct de inflexiune',
    description: 'Creează un punct de inflexiune (ieșire/intrare) pentru o prezență cu coordonate GPS.',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Punctul de inflexiune a fost înregistrat cu succes',
    type: PresenceInflexion,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Date invalide pentru punctul de inflexiune',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Prezența asociată nu a fost găsită',
  })
  async createPresenceInflexion(@Body() createInflexionDto: CreatePresenceInflexionDto): Promise<PresenceInflexion> {
    return await this.attendanceService.createPresenceInflexion(createInflexionDto);
  }

  @Get('presence-inflexions')
  @ApiOperation({
    summary: 'Listează toate punctele de inflexiune',
    description: 'Returnează o listă paginată cu toate punctele de inflexiune cu opțiuni de filtrare.',
  })
  @ApiQuery({ name: 'page', required: false, description: 'Numărul paginii', example: 1 })
  @ApiQuery({ name: 'limit', required: false, description: 'Numărul de rezultate pe pagină', example: 10 })
  @ApiQuery({ name: 'presence_id', required: false, description: 'Filtrare după ID-ul prezenței', example: 1 })
  @ApiQuery({ name: 'type', required: false, enum: InflexionType, description: 'Filtrare după tip (exit/entry)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lista punctelor de inflexiune a fost returnată cu succes',
  })
  async findAllPresenceInflexions(
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 10,
    @Query('presence_id', new ParseIntPipe({ optional: true })) presence_id?: number,
    @Query('type') type?: InflexionType,
  ) {
    return await this.attendanceService.findAllPresenceInflexions(page, limit, presence_id, type);
  }

  @Get('presence-inflexions/:id')
  @ApiOperation({
    summary: 'Obține un punct de inflexiune după ID',
    description: 'Returnează detaliile complete ale unui punct de inflexiune inclusiv datele GPS.',
  })
  @ApiParam({ name: 'id', description: 'ID-ul punctului de inflexiune', example: 1 })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Punctul de inflexiune a fost găsit cu succes',
    type: PresenceInflexion,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Punctul de inflexiune nu a fost găsit',
  })
  async findPresenceInflexionById(@Param('id', ParseIntPipe) id: number): Promise<PresenceInflexion> {
    return await this.attendanceService.findPresenceInflexionById(id);
  }

  @Patch('presence-inflexions/:id')
  @ApiOperation({
    summary: 'Actualizează un punct de inflexiune',
    description: 'Actualizează datele unui punct de inflexiune existent.',
  })
  @ApiParam({ name: 'id', description: 'ID-ul punctului de inflexiune', example: 1 })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Punctul de inflexiune a fost actualizat cu succes',
    type: PresenceInflexion,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Punctul de inflexiune nu a fost găsit',
  })
  async updatePresenceInflexion(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateInflexionDto: UpdatePresenceInflexionDto,
  ): Promise<PresenceInflexion> {
    return await this.attendanceService.updatePresenceInflexion(id, updateInflexionDto);
  }

  @Delete('presence-inflexions/:id')
  @ApiOperation({
    summary: 'Șterge un punct de inflexiune',
    description: 'Șterge definitiv un punct de inflexiune.',
  })
  @ApiParam({ name: 'id', description: 'ID-ul punctului de inflexiune', example: 1 })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Punctul de inflexiune a fost șters cu succes',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Punctul de inflexiune nu a fost găsit',
  })
  async deletePresenceInflexion(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return await this.attendanceService.deletePresenceInflexion(id);
  }

  // STATISTICS ENDPOINT
  @Get('statistics')
  @ApiOperation({
    summary: 'Obține statistici de prezență',
    description: 'Generează rapoarte și statistici detaliate despre prezența angajaților.',
  })
  @ApiQuery({ name: 'employee_id', required: false, description: 'Filtrare după ID-ul angajatului', example: 1 })
  @ApiQuery({ name: 'start_date', required: false, description: 'Data de început (YYYY-MM-DD)', example: '2024-01-01' })
  @ApiQuery({ name: 'end_date', required: false, description: 'Data de sfârșit (YYYY-MM-DD)', example: '2024-01-31' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Statisticile au fost generate cu succes',
  })
  async getAttendanceStatistics(
    @Query('employee_id', new ParseIntPipe({ optional: true })) employee_id?: number,
    @Query('start_date') start_date?: string,
    @Query('end_date') end_date?: string,
  ) {
    return await this.attendanceService.getAttendanceStatistics(employee_id, start_date, end_date);
  }
}
