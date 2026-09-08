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
  ParseIntPipe,
  Request,
  UseGuards,
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
import { AttendanceService } from './attendance.service';
import { Permissions, PermissionsAny, AuthOnly } from './permissions/permissions.decorator';
import { CreateShiftDto } from './dto/create-shift.dto';
import { UpdateShiftDto } from './dto/update-shift.dto';
import { CreatePresenceDto } from './dto/create-presence.dto';
import { UpdatePresenceDto } from './dto/update-presence.dto';
import { CreatePresenceInflexionDto } from './dto/create-presence-inflexion.dto';
import { UpdatePresenceInflexionDto } from './dto/update-presence-inflexion.dto';
import { CorrectPresenceDto } from './dto/correct-presence.dto';
import {
  buildAttendanceUserContext,
  hasAttendanceManagePermission,
  isOperationalEmployee,
  isOperationalStaffUser,
  resolveShiftsEmployeeFilter,
} from './attendance-access';
import { Shift } from './entities/shift.entity';
import { Presence, PresenceStatus } from './entities/presence.entity';
import { PresenceInflexion, InflexionType } from './entities/presence-inflexion.entity';
import { PlanFeatureGuard, RequiresPlanFeature } from './plan-access/plan-access.nest';

@ApiTags('attendance')
@Controller('attendance')
// Subscription gate (after RBAC): whole HTTP surface requires the "pontaj" feature.
// Internal service calls (x-internal-service) are exempt.
@RequiresPlanFeature('pontaj')
@UseGuards(PlanFeatureGuard)
@ApiBearerAuth()
@ApiExtraModels(Shift, Presence, PresenceInflexion)
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  // SHIFT ENDPOINTS
  @Post('shifts')
  @Permissions('attendance.create')
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
  @AuthOnly()
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
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('employee_id') employee_id?: string,
    @Query('work_location_id') work_location_id?: string,
    @Query('department_id') department_id?: string,
    @Request() req?: any,
  ) {
    const requested =
      employee_id !== undefined && employee_id !== ''
        ? Number(employee_id)
        : undefined;
    const p = Number(page || 1);
    const l = Number(limit || 10);
    const loc = work_location_id !== undefined ? Number(work_location_id) : undefined;
    const dep = department_id !== undefined ? Number(department_id) : undefined;

    // Operațional (magazioner/șofer): scope = self + colegi din aceeași locație (read-only)
    if (isOperationalStaffUser(req?.user)) {
      const colleagueIds = await this.attendanceService.fetchOperationalColleagueIds(req?.user);
      return await this.attendanceService.findAllShifts(p, l, requested, loc, dep, colleagueIds);
    }

    const emp = resolveShiftsEmployeeFilter(req?.user, requested);
    return await this.attendanceService.findAllShifts(p, l, emp, loc, dep);
  }

  @Get('shifts/:id')
  @Permissions('attendance.read')
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
  async findShiftById(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: any,
  ): Promise<Shift> {
    return await this.attendanceService.findShiftById(
      id,
      req.user,
      req.headers?.authorization,
    );
  }

  @Patch('shifts/:id')
  @Permissions('attendance.update')
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
    @Request() req: any,
  ): Promise<Shift> {
    return await this.attendanceService.updateShift(
      id,
      updateShiftDto,
      req.user,
      req.headers?.authorization,
    );
  }

  @Delete('shifts/:id')
  @Permissions('attendance.delete')
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
  async deleteShift(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: any,
  ): Promise<void> {
    return await this.attendanceService.deleteShift(
      id,
      req.user,
      req.headers?.authorization,
    );
  }

  // PRESENCE ENDPOINTS
  @Post('presences')
  @Permissions('attendance.create')
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
  @Permissions('attendance.read')
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
  @ApiQuery({ name: 'work_location_id', required: false, description: 'Filtrare după ID-ul locației de lucru', example: 1 })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lista prezențelor a fost returnată cu succes',
  })
  async findAllPresences(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('shift_id') shift_id?: string,
    @Query('status') status?: PresenceStatus,
    @Query('start_date') start_date?: string,
    @Query('end_date') end_date?: string,
    @Query('work_location_id') work_location_id?: string,
  ) {
    return await this.attendanceService.findAllPresences(page, limit, shift_id, status, start_date, end_date, work_location_id);
  }

  @Get('presences/:id')
  @Permissions('attendance.read')
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
  async findPresenceById(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: any,
  ): Promise<Presence> {
    return await this.attendanceService.findPresenceById(
      id,
      req.user,
      req.headers?.authorization,
    );
  }

  @Patch('presences/:id')
  @Permissions('attendance.update')
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
    @Request() req: any,
  ): Promise<Presence> {
    return await this.attendanceService.updatePresence(
      id,
      updatePresenceDto,
      req.user,
      req.headers?.authorization,
    );
  }

  @Delete('presences/:id')
  @Permissions('attendance.delete')
  @ApiOperation({
    summary: 'Șterge o prezență',
    description: 'Șterge definitiv o prezență și toate punctele de inflexiune asociate.',
  })
  @ApiParam({ name: 'id', description: 'ID-ul prezenței', example: 1 })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Prezența a fost ștearsă cu succes',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Prezența nu a fost găsită',
  })
  async deletePresence(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: any,
  ): Promise<void> {
    return await this.attendanceService.deletePresence(
      id,
      req.user,
      req.headers?.authorization,
    );
  }

  // PRESENCE INFLEXION ENDPOINTS
  @Post('presence-inflexions')
  @Permissions('attendance.create')
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
  @Permissions('attendance.read')
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
  @Permissions('attendance.read')
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
  async findPresenceInflexionById(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: any,
  ): Promise<PresenceInflexion> {
    return await this.attendanceService.findPresenceInflexionById(
      id,
      req?.user,
      req.headers?.authorization,
    );
  }

  @Patch('presence-inflexions/:id')
  @Permissions('attendance.update')
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
    @Request() req: any,
  ): Promise<PresenceInflexion> {
    return await this.attendanceService.updatePresenceInflexion(
      id,
      updateInflexionDto,
      req?.user,
      req.headers?.authorization,
    );
  }

  @Delete('presence-inflexions/:id')
  @Permissions('attendance.delete')
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
  async deletePresenceInflexion(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: any,
  ): Promise<void> {
    return await this.attendanceService.deletePresenceInflexion(
      id,
      req?.user,
      req.headers?.authorization,
    );
  }

  // MY ACTIVE SHIFT - verifică dacă angajatul curent are tură activă
  @Get('my-active-shift')
  @AuthOnly()
  @ApiOperation({
    summary: 'Verifică dacă angajatul curent are tură activă',
    description: 'Returnează informații despre tura activă (check_in setat, check_out nesetat) pentru angajatul autentificat.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Status tură activă',
  })
  async getMyActiveShift(@Request() req: any) {
    const employeeId = req.user?.sub;
    if (!employeeId) {
      return { hasActiveShift: false, shift: null, presence: null };
    }
    return await this.attendanceService.getActiveShiftForEmployee(Number(employeeId));
  }

  @Post('my-punch')
  @AuthOnly()
  @ApiOperation({
    summary: 'Intrare/Ieșire pontaj pentru angajatul autentificat',
    description:
      'Ora este stabilită de server. Nu acceptă employee_id din body.',
  })
  async myPunch(@Request() req: any) {
    return this.attendanceService.myPunch(req.user);
  }

  @Get('my-timesheet')
  @AuthOnly()
  @ApiOperation({ summary: 'Pontaj propriu — intervale și totaluri' })
  @ApiQuery({ name: 'start_date', required: false })
  @ApiQuery({ name: 'end_date', required: false })
  async getMyTimesheet(
    @Request() req: any,
    @Query('start_date') start_date?: string,
    @Query('end_date') end_date?: string,
  ) {
    return this.attendanceService.getMyTimesheet(req.user, start_date, end_date);
  }

  @Get('team-timesheet')
  @AuthOnly()
  @ApiOperation({
    summary: 'Pontaj echipă furnizor / manager',
    description:
      'Furnizor: JWT company_type=furnizor + angajat în employees_suppliers. Admin: attendance.update.',
  })
  @ApiQuery({ name: 'employee_id', required: false })
  @ApiQuery({ name: 'work_location_id', required: false })
  @ApiQuery({ name: 'start_date', required: false })
  @ApiQuery({ name: 'end_date', required: false })
  async getTeamTimesheet(
    @Request() req: any,
    @Query('employee_id') employee_id?: string,
    @Query('work_location_id') work_location_id?: string,
    @Query('start_date') start_date?: string,
    @Query('end_date') end_date?: string,
  ) {
    const auth = req.headers?.authorization as string | undefined;
    return this.attendanceService.getTeamTimesheet(req.user, auth, {
      employee_id:
        employee_id != null && employee_id !== ''
          ? Number(employee_id)
          : undefined,
      work_location_id:
        work_location_id != null && work_location_id !== ''
          ? Number(work_location_id)
          : undefined,
      start_date,
      end_date,
    });
  }

  @Patch('presences/:id/correct')
  @PermissionsAny(
    'attendance.update',
    'assignment.read_all',
    'assignment.read_company',
    'order.read',
  )
  @ApiOperation({
    summary: 'Corectare pontaj de către furnizor/manager',
    description:
      'Furnizor: tenant furnizor + angajat în employees_suppliers. Admin: attendance.update + assignment.read_*.',
  })
  async correctPresence(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CorrectPresenceDto,
    @Request() req: any,
  ) {
    const auth = req.headers?.authorization as string | undefined;
    return this.attendanceService.correctPresence(id, dto, req.user, auth);
  }

  // STATISTICS ENDPOINT
  @Get('statistics')
  @Permissions('attendance.read')
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
    @Request() req?: any,
  ) {
    const ctx = buildAttendanceUserContext(req?.user);
    let scopedEmployeeId = employee_id;
    if (
      isOperationalEmployee(ctx) &&
      !hasAttendanceManagePermission(ctx.permissions)
    ) {
      scopedEmployeeId = ctx.employeeId ?? undefined;
    }
    return await this.attendanceService.getAttendanceStatistics(
      scopedEmployeeId,
      start_date,
      end_date,
    );
  }

  /**
   * Zile lucrate (prezență full/partial) pe interval — pentru sync App2 / apeluri interne.
   * Auth: JWT cu attendance.read SAU x-internal-service + x-service-secret.
   */
  @Get('worked-days')
  @Permissions('attendance.read')
  @ApiOperation({
    summary: 'Număr zile lucrate pe angajat',
    description:
      'Numără zilele distincte cu prezență (present_full / present_partial) în interval.',
  })
  @ApiQuery({ name: 'employee_id', required: true, example: 1 })
  @ApiQuery({ name: 'start_date', required: true, example: '2024-01-01' })
  @ApiQuery({ name: 'end_date', required: true, example: '2024-01-31' })
  async getWorkedDays(
    @Query('employee_id', ParseIntPipe) employee_id: number,
    @Query('start_date') start_date: string,
    @Query('end_date') end_date: string,
  ) {
    const worked_days = await this.attendanceService.countWorkedDays(
      employee_id,
      start_date,
      end_date,
    );
    return { employee_id, start_date, end_date, worked_days };
  }
}