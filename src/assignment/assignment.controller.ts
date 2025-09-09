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

  @Get()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('assignment.read_own', 'assignment.read_location', 'assignment.read_company', 'assignment.read_all')
  @ApiOperation({ summary: 'Obține assignment-urile în funcție de permisiuni' })
  @ApiResponse({ 
    status: 200, 
    description: 'Lista de assignment-uri filtrată după permisiuni',
    type: [TaskAssignment] 
  })
  findAll(@Request() req): Promise<TaskAssignment[]> {
    console.log('🔍 [assignment.controller] GET /assignments - Request primit')
    console.log('🔍 [assignment.controller] User din request:', req.user ? 'EXISTĂ' : 'LIPSEȘTE')
    if (req.user) {
      console.log('🔍 [assignment.controller] User ID:', req.user.sub || req.user.id)
      console.log('🔍 [assignment.controller] User permissions:', req.user.permissions)
    }
    return this.assignmentService.findAllWithPermissions(req.user);
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
  @Permissions('assignment.update')
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
} 