import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe, Request, UseGuards, Query } from '@nestjs/common';
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
  @Permissions('assignment.create')
  @ApiOperation({ summary: 'Creează un assignment nou cu toate elementele sale' })
  @ApiResponse({ 
    status: 201, 
    description: 'Assignment creat cu succes',
    type: TaskAssignment 
  })
  @ApiResponse({ status: 400, description: 'Date invalide' })
  @ApiResponse({ status: 401, description: 'Neautorizat' })
  @ApiResponse({ status: 403, description: 'Fără permisiuni' })
  create(@Body() createAssignmentDto: CreateAssignmentDto): Promise<TaskAssignment> {
    return this.assignmentService.create(createAssignmentDto);
  }

  @Post('batch')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('assignment.create')
  @ApiOperation({ summary: 'Creează mai multe assignments într-o singură tranzacție (batch)' })
  @ApiResponse({ 
    status: 201, 
    description: 'Assignments create cu succes',
    type: [TaskAssignment] 
  })
  @ApiResponse({ status: 400, description: 'Date invalide' })
  @ApiResponse({ status: 401, description: 'Neautorizat' })
  @ApiResponse({ status: 403, description: 'Fără permisiuni' })
  createBatch(@Body() createAssignmentDtos: CreateAssignmentDto[]): Promise<TaskAssignment[]> {
    return this.assignmentService.createBatch(createAssignmentDtos);
  }

  @Get()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('assignment.read_own', 'assignment.read_location', 'assignment.read_company', 'assignment.read_all')
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
    return this.assignmentService.findAllWithPermissions(req.user, locationId, sd, ed);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obține un assignment specific cu elementele sale' })
  @ApiParam({ name: 'id', description: 'ID-ul assignment-ului' })
  @ApiResponse({ 
    status: 200, 
    description: 'Assignment găsit',
    type: TaskAssignment 
  })
  @ApiResponse({ status: 404, description: 'Assignment nu a fost găsit' })
  findOne(@Param('id', ParseIntPipe) id: number): Promise<TaskAssignment> {
    return this.assignmentService.findOne(id);
  }
  
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('assignment.update', 'execution.create', 'assignment.read_own')
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
    @Param('id', ParseIntPipe) id: number,
    @Body() updateAssignmentDto: UpdateAssignmentDto,
  ): Promise<TaskAssignment> {
    return this.assignmentService.update(id, updateAssignmentDto);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('assignment.delete')
  @Delete(':id')
  @ApiOperation({ summary: 'Șterge un assignment și toate elementele sale' })
  @ApiParam({ name: 'id', description: 'ID-ul assignment-ului' })
  @ApiResponse({ status: 200, description: 'Assignment șters cu succes' })
  @ApiResponse({ status: 404, description: 'Assignment nu a fost găsit' })
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.assignmentService.remove(id);
  }

  // Endpoint-uri pentru sarcinile programate
  @Get('scheduled')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('assignment.read_own', 'assignment.read_location', 'assignment.read_company', 'assignment.read_all')
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
  @Permissions('assignment.read_own', 'assignment.read_location', 'assignment.read_company', 'assignment.read_all')
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
  @Permissions('assignment.read_own', 'assignment.read_location', 'assignment.read_company', 'assignment.read_all')
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
  @ApiOperation({ summary: 'Respinge un task cu requires_manager_check și îl returnează la status assigned' })
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
} 