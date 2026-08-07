import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe, Request, UseGuards, Query, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { AssignmentService } from './assignment.service';
import { ScheduledTasksService } from './scheduled-tasks.service';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { UpdateAssignmentDto } from './dto/update-assignment.dto';
import { TaskAssignment } from './entity/task-assignment.entity';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PermissionsGuard } from '../guards/permissions.guard';
import { Permissions } from '../permissions/permissions.decorator';

@ApiTags('Assignments')
@Controller('assignments')
export class AssignmentController {
  constructor(
    private readonly assignmentService: AssignmentService,
    private readonly scheduledTasksService: ScheduledTasksService
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('assignment.create', 'suppliers.create')
  @ApiOperation({ summary: 'Creează un assignment nou cu toate elementele sale' })
  @ApiResponse({ 
    status: 201, 
    description: 'Assignment creat cu succes',
    type: TaskAssignment 
  })
  @ApiResponse({ status: 400, description: 'Date invalide' })
  @ApiResponse({ status: 401, description: 'Neautorizat' })
  @ApiResponse({ status: 403, description: 'Fără permisiuni' })
  create(@Request() req, @Body() createAssignmentDto: CreateAssignmentDto): Promise<TaskAssignment> {
    return this.assignmentService.create(
      createAssignmentDto,
      req.user,
      req.headers?.authorization as string | undefined,
    );
  }

  @Post('batch')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('assignment.create', 'suppliers.create')
  @ApiOperation({ summary: 'Creează mai multe assignments într-o singură tranzacție (batch)' })
  @ApiResponse({ 
    status: 201, 
    description: 'Assignments create cu succes',
    type: [TaskAssignment] 
  })
  @ApiResponse({ status: 400, description: 'Date invalide' })
  @ApiResponse({ status: 401, description: 'Neautorizat' })
  @ApiResponse({ status: 403, description: 'Fără permisiuni' })
  createBatch(@Request() req, @Body() createAssignmentDtos: CreateAssignmentDto[]): Promise<TaskAssignment[]> {
    return this.assignmentService.createBatch(
      createAssignmentDtos,
      req.user,
      req.headers?.authorization as string | undefined,
    );
  }

  @Get()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(
    'assignment.read_own',
    'assignment.read_location',
    'assignment.read_company',
    'assignment.read_all',
    'order.read',
    'suppliers.create',
  )
  @ApiOperation({ summary: 'Obține assignment-urile în funcție de permisiuni' })
  @ApiResponse({ 
    status: 200, 
    description: 'Lista de assignment-uri filtrată după permisiuni',
    type: [TaskAssignment] 
  })
  @ApiQuery({ name: 'location_id', required: false, description: 'Filtrează task-urile după locație' })
  @ApiQuery({ name: 'startDate', required: false, description: 'YYYY-MM-DD (inclusiv)' })
  @ApiQuery({ name: 'endDate', required: false, description: 'YYYY-MM-DD (inclusiv)' })
  findAll(
    @Request() req,
    @Query('location_id') location_id?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<TaskAssignment[]> {
    const locationId = location_id ? parseInt(location_id, 10) : undefined;
    console.log('🔍 [assignments.controller] findAll -> user perms:', req.user?.permissions, 'query.location_id:', location_id, 'parsed:', locationId);
    const sd = startDate ? new Date(startDate) : undefined;
    const ed = endDate ? new Date(endDate) : undefined;
    return this.assignmentService.findAllWithPermissions(
      req.user,
      locationId,
      sd,
      ed,
      req.headers?.authorization as string | undefined,
    );
  }

  @Get('stats/efficiency')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(
    'assignment.read_own',
    'assignment.read_location',
    'assignment.read_company',
    'assignment.read_all',
    'suppliers.create',
    'execution.read_own',
    'order.read',
  )
  @ApiOperation({ summary: 'Eficiență angajat: câte task-uri finalizate din total (doar count-uri)' })
  @ApiQuery({ name: 'employee_id', required: true, description: 'ID angajat' })
  @ApiQuery({ name: 'startDate', required: false, description: 'YYYY-MM-DD (opțional, filtru de la data)' })
  @ApiQuery({ name: 'endDate', required: false, description: 'YYYY-MM-DD (opțional, filtru până la data)' })
  @ApiResponse({ status: 200, description: 'total_count, completed_count, percentage' })
  @ApiResponse({ status: 401, description: 'Neautorizat' })
  @ApiResponse({ status: 403, description: 'Fără acces la datele angajatului' })
  getEfficiency(
    @Request() req,
    @Query('employee_id', ParseIntPipe) employeeId: number,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const auth = req.headers?.authorization as string | undefined;
    return this.assignmentService.getEfficiencyForEmployee(
      employeeId,
      startDate,
      endDate,
      req.user,
      auth,
    );
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(
    'assignment.read_own',
    'assignment.read_location',
    'assignment.read_company',
    'assignment.read_all',
    'order.read',
    'suppliers.create',
  )
  @ApiOperation({ summary: 'Obține un assignment specific (doar dacă utilizatorul are dreptul să-l vadă)' })
  @ApiParam({ name: 'id', description: 'ID-ul assignment-ului' })
  @ApiResponse({ 
    status: 200, 
    description: 'Assignment găsit',
    type: TaskAssignment 
  })
  @ApiResponse({ status: 403, description: 'Nu ai dreptul să accesezi această sarcină' })
  @ApiResponse({ status: 404, description: 'Assignment nu a fost găsit' })
  findOne(@Request() req, @Param('id', ParseIntPipe) id: number): Promise<TaskAssignment> {
    return this.assignmentService.findOne(
      id,
      req.user,
      req.headers?.authorization as string | undefined,
    );
  }
  
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('assignment.update', 'suppliers.create')
  @Patch(':id')
  @ApiOperation({ summary: 'Actualizează un assignment și elementele sale' })
  @ApiParam({ name: 'id', description: 'ID-ul assignment-ului' })
  @ApiResponse({ 
    status: 200, 
    description: 'Assignment actualizat cu succes',
    type: TaskAssignment 
  })
  @ApiResponse({ status: 404, description: 'Assignment nu a fost găsit' })
  update(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
    @Body() updateAssignmentDto: UpdateAssignmentDto,
  ): Promise<TaskAssignment> {
    return this.assignmentService.update(
      id,
      updateAssignmentDto,
      req.user,
      req.headers?.authorization as string | undefined,
    );
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('assignment.update')
  @Post(':id/reallocate')
  @ApiOperation({ summary: 'Realochează sarcina: scade puncte la assignee curent, creează copie pentru alt angajat (sau alege automat unul pontat)' })
  @ApiParam({ name: 'id', description: 'ID-ul assignment-ului' })
  @ApiResponse({ status: 200, description: 'Realocare reușită' })
  @ApiResponse({ status: 400, description: 'Sarcina nu poate fi realocată' })
  reallocate(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { new_assignee_id?: number; deduct_points?: boolean },
  ) {
    return this.assignmentService.reallocateAssignment(
      id,
      body?.new_assignee_id,
      body?.deduct_points !== false,
      false,
      'admin',
    );
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('assignment.read_own')
  @Post(':id/trigger-reallocate')
  @ApiOperation({ summary: 'Declanșează reatribuirea unei sarcini amânate (doar pentru asignatul curent)' })
  @ApiParam({ name: 'id', description: 'ID-ul assignment-ului' })
  @ApiResponse({ status: 200, description: 'Reatribuire declanșată' })
  @ApiResponse({ status: 400, description: 'Doar sarcinile amânate pot fi reatribuite de angajat' })
  triggerReallocate(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: any,
  ) {
    const employeeId = Number(req.user?.sub ?? req.user?.userId ?? 0);
    if (!employeeId) {
      throw new BadRequestException('Utilizatorul curent nu este identificat ca angajat.');
    }
    return this.assignmentService.triggerReallocateByEmployee(id, employeeId);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('assignment.delete')
  @Delete(':id')
  @ApiOperation({ summary: 'Șterge un assignment și toate elementele sale' })
  @ApiParam({ name: 'id', description: 'ID-ul assignment-ului' })
  @ApiResponse({ status: 200, description: 'Assignment șters cu succes' })
  @ApiResponse({ status: 404, description: 'Assignment nu a fost găsit' })
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: any,
  ): Promise<void> {
    return this.assignmentService.remove(
      id,
      req.user,
      req.headers?.authorization,
    );
  }

  // Endpoint-uri pentru sarcinile programate
  @Get('scheduled')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(
    'assignment.read_own',
    'assignment.read_location',
    'assignment.read_company',
    'assignment.read_all',
    'order.read',
    'suppliers.create',
  )
  @ApiOperation({ summary: 'Obține toate sarcinile programate' })
  @ApiResponse({ 
    status: 200, 
    description: 'Lista de sarcinile programate',
    type: [TaskAssignment] 
  })
  getScheduledTasks(): Promise<TaskAssignment[]> {
    return this.scheduledTasksService.getScheduledTasks();
  }

  @Get('scheduled/for-date')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(
    'assignment.read_own',
    'assignment.read_location',
    'assignment.read_company',
    'assignment.read_all',
    'order.read',
    'suppliers.create',
  )
  @ApiOperation({ summary: 'Obține sarcinile programate pentru o dată specifică' })
  @ApiQuery({ name: 'date', description: 'Data pentru care să se caute sarcinile programate (YYYY-MM-DD)', required: false })
  @ApiResponse({ 
    status: 200, 
    description: 'Lista de sarcinile programate pentru data specificată',
    type: [TaskAssignment] 
  })
  getScheduledTasksForDate(@Query('date') date?: string): Promise<TaskAssignment[]> {
    const targetDate = date ? new Date(date) : new Date();
    return this.scheduledTasksService.getScheduledTasksForDate(targetDate);
  }

  @Get('overdue')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(
    'assignment.read_own',
    'assignment.read_location',
    'assignment.read_company',
    'assignment.read_all',
    'order.read',
    'suppliers.create',
  )
  @ApiOperation({ summary: 'Obține sarcinile întârziate pentru angajatul curent' })
  @ApiResponse({ 
    status: 200, 
    description: 'Lista de sarcinile întârziate',
    type: [TaskAssignment] 
  })
  getOverdueTasks(@Request() req): Promise<TaskAssignment[]> {
    return this.assignmentService.getOverdueTasks(req.user);
  }

  @Post('scheduled/:id/activate')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('assignment.update')
  @ApiOperation({ summary: 'Activează manual o sarcină programată' })
  @ApiParam({ name: 'id', description: 'ID-ul assignment-ului programat' })
  @ApiResponse({ 
    status: 200, 
    description: 'Sarcina a fost activată cu succes',
    type: TaskAssignment 
  })
  activateScheduledTask(@Param('id', ParseIntPipe) id: number): Promise<TaskAssignment> {
    return this.scheduledTasksService.unscheduleTask(id);
  }

  @Post('scheduled/check-and-update')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('assignment.update')
  @ApiOperation({ summary: 'Verifică și actualizează manual sarcinile programate pentru ziua curentă' })
  @ApiResponse({ 
    status: 200, 
    description: 'Rezultatul verificării sarcinilor programate',
    schema: {
      type: 'object',
      properties: {
        activated: { type: 'number', description: 'Numărul de sarcini activate' },
        total: { type: 'number', description: 'Numărul total de sarcini programate pentru astăzi' }
      }
    }
  })
  checkAndUpdateScheduledTasks(): Promise<{ activated: number; total: number }> {
    return this.scheduledTasksService.checkAndUpdateScheduledTasks();
  }

  @Post('recurring/test')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('assignment.create')
  @ApiOperation({ summary: 'Testează manual sistemul de recurență pentru ziua curentă' })
  @ApiResponse({ 
    status: 200, 
    description: 'Rezultatul testării sistemului de recurență',
    schema: {
      type: 'object',
      properties: {
        processed: { type: 'number', description: 'Numărul de task-uri procesate' },
        created: { type: 'number', description: 'Numărul de task-uri create' },
        errors: { type: 'number', description: 'Numărul de erori întâlnite' }
      }
    }
  })
  testRecurrenceSystem(): Promise<{ processed: number; created: number; errors: number }> {
    return this.scheduledTasksService.testRecurrenceSystem();
  }

  @Post('recurring/test/:date')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('assignment.create')
  @ApiOperation({ summary: 'Testează manual sistemul de recurență pentru o dată specifică (YYYY-MM-DD)' })
  @ApiParam({ 
    name: 'date', 
    description: 'Data pentru care să testezi recurența (format: YYYY-MM-DD)', 
    example: '2024-01-15' 
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Rezultatul testării sistemului de recurență pentru data specificată',
    schema: {
      type: 'object',
      properties: {
        processed: { type: 'number', description: 'Numărul de task-uri procesate' },
        created: { type: 'number', description: 'Numărul de task-uri create' },
        errors: { type: 'number', description: 'Numărul de erori întâlnite' },
        testDate: { type: 'string', description: 'Data pentru care s-a făcut testarea' }
      }
    }
  })
  async testRecurrenceSystemForDate(@Param('date') dateString: string): Promise<{ processed: number; created: number; errors: number; testDate: string }> {
    const testDate = new Date(dateString);
    if (isNaN(testDate.getTime())) {
      throw new Error('Format de dată invalid. Folosește YYYY-MM-DD');
    }
    
    const result = await this.scheduledTasksService.testRecurrenceSystemForDate(testDate);
    return {
      ...result,
      testDate: testDate.toISOString().split('T')[0]
    };
  }

  @Post(':id/accept')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('execution.create', 'assignment.read_own', 'assignment.read_location', 'assignment.read_company', 'assignment.read_all')
  @ApiOperation({ summary: 'Acceptă un task (angajat preia taskul FCFS/loc sau manager atribuie)' })
  @ApiParam({ name: 'id', description: 'ID-ul task-ului de acceptat' })
  @ApiResponse({ 
    status: 200, 
    description: 'Task acceptat cu succes',
    type: TaskAssignment
  })
  async acceptTask(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: any
  ): Promise<TaskAssignment> {
    const userId = req.user?.sub;
    if (!userId) {
      throw new Error('User ID not found in request');
    }

    return this.assignmentService.acceptTask(id, userId);
  }

  @Post(':id/approve')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('assignment.read_location', 'assignment.read_company', 'assignment.read_all')
  @ApiOperation({ summary: 'Aprobă un task cu requires_manager_check și îl finalizează' })
  @ApiParam({ name: 'id', description: 'ID-ul task-ului de aprobat' })
  @ApiResponse({ 
    status: 200, 
    description: 'Task aprobat cu succes',
    type: TaskAssignment
  })
  async approveTask(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: any
  ): Promise<TaskAssignment> {
    const userId = req.user?.sub;
    if (!userId) {
      throw new Error('User ID not found in request');
    }

    return this.assignmentService.approveTask(id, userId);
  }

  @Post(':id/reject')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('assignment.read_location', 'assignment.read_company', 'assignment.read_all')
  @ApiOperation({ summary: 'Marchează task-ul verificat de manager ca nefinalizat pentru eficiență (fără modificare puncte)' })
  @ApiParam({ name: 'id', description: 'ID-ul task-ului de respins' })
  @ApiResponse({ 
    status: 200, 
    description: 'Task respins cu succes',
    type: TaskAssignment
  })
  async rejectTask(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: any
  ): Promise<TaskAssignment> {
    const userId = req.user?.sub;
    if (!userId) {
      throw new Error('User ID not found in request');
    }

    return this.assignmentService.rejectTask(id, userId);
  }

  @Post(':id/postpone')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('execution.create')
  @ApiOperation({ summary: 'Amână un task cu allow_postpone activat' })
  @ApiParam({ name: 'id', description: 'ID-ul task-ului de amânat' })
  @ApiResponse({ 
    status: 200, 
    description: 'Task amânat cu succes',
    type: TaskAssignment
  })
  async postponeTask(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: any
  ): Promise<TaskAssignment> {
    const userId = req.user?.sub;
    if (!userId) {
      throw new Error('User ID not found in request');
    }

    return this.assignmentService.postponeTask(id, userId);
  }

  @Post(':id/start-work')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('execution.create', 'order.read', 'assignment.read_own')
  @ApiOperation({ summary: 'Participant: marchează sarcina proprie ca În lucru' })
  startParticipantWork(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<TaskAssignment> {
    return this.assignmentService.startParticipantWork(
      id,
      req.user,
      req.headers?.authorization as string | undefined,
    );
  }

  @Post(':id/complete-own')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('execution.create', 'order.read', 'assignment.read_own')
  @ApiOperation({ summary: 'Participant: confirmare individuală Am terminat' })
  completeParticipantParticipation(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.assignmentService.completeParticipantParticipation(
      id,
      req.user,
      req.headers?.authorization as string | undefined,
    );
  }

  @Post(':id/cancel')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('assignment.update', 'suppliers.create')
  @ApiOperation({ summary: 'Furnizor/admin: anulează sarcina (grup sau individual)' })
  cancelAssignment(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<TaskAssignment[]> {
    return this.assignmentService.cancelAssignment(
      id,
      req.user,
      req.headers?.authorization as string | undefined,
    );
  }
} 