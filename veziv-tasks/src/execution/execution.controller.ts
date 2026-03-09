import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe, Query, UseGuards, Request, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody, ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';
import { ExecutionService } from './execution.service';
import { CreateExecutionDto } from './dto/create-execution.dto';
import { UpdateExecutionDto } from './dto/update-execution.dto';
import { CreateEmployeeDailyPointsDto } from './dto/create-employee-daily-points.dto';
import { CreateEmployeeDailyTaskPointsDto } from './dto/create-employee-daily-task-points.dto';
import { TaskExecution } from './entity/task-execution.entity';
import { EmployeeDailyPoints } from './entity/employee-daily-points.entity';
import { EmployeeDailyTaskPoints } from './entity/employee-daily-task-points.entity';
import { ManagerDailyPayout } from './entity/manager-daily-payout.entity';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { PermissionsGuard } from '../guards/permissions.guard';
import { Permissions } from '../permissions/permissions.decorator';

@ApiTags('Executions')
@Controller('executions')
export class ExecutionController {
  constructor(private readonly executionService: ExecutionService) {}

  @Post()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('execution.create')
  @ApiOperation({ summary: 'Creează o execuție nouă' })
  @ApiBody({
    description: 'Datele pentru crearea execuției',
    examples: {
      example1: {
        summary: 'Execuție completă cu answers',
        value: {
          task_assignment_id: 1,
          employee_id: 5,
          started_at: '2024-01-15T09:00:00Z',
          completed_at: '2024-01-15T11:30:00Z',
          comment: 'Sarcina a fost finalizată cu succes',
          is_verified_by_manager: false,
          verification_date: null,
          total_score: 85,
          answers: [
            {
              task_element_id: 1,
              value: 'true',
              score_awarded: 5
            },
            {
              task_element_id: 2,
              value: 'false',
              score_awarded: 0
            },
            {
              task_element_id: 3,
              value: 'https://example.com/photo1.jpg'
            },
            {
              task_element_id: 4,
              value: 'Observații despre execuție'
            }
          ]
        }
      },
      example2: {
        summary: 'Execuție simplă',
        value: {
          task_assignment_id: 2,
          employee_id: 3,
          started_at: '2024-01-15T14:00:00Z'
        }
      }
    }
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Execuție creată cu succes',
    type: TaskExecution 
  })
  @ApiResponse({ status: 400, description: 'Date invalide' })
  @ApiResponse({ status: 401, description: 'Neautorizat' })
  @ApiResponse({ status: 403, description: 'Fără permisiuni' })
  create(@Body() createExecutionDto: CreateExecutionDto): Promise<{ execution: TaskExecution; points: number; isOverdue: boolean; message: string }> {
    return this.executionService.create(createExecutionDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('execution.read_own', 'execution.read_location', 'execution.read_company', 'execution.read_all')
  @ApiOperation({ summary: 'Obține execuțiile în funcție de permisiuni' })
  @ApiResponse({ 
    status: 200, 
    description: 'Lista de execuții filtrată după permisiuni',
    type: [TaskExecution] 
  })
  @ApiResponse({ status: 401, description: 'Neautorizat' })
  @ApiResponse({ status: 403, description: 'Fără permisiuni' })
  findAll(
    @Request() req, 
    @Query('include_assignment') includeAssignment?: string, 
    @Query('location_id') location_id?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('assignment_id') assignment_id?: string
  ): Promise<TaskExecution[]> {
    const locationId = location_id ? parseInt(location_id, 10) : undefined;
    const sd = startDate ? new Date(startDate) : undefined;
    const ed = endDate ? new Date(endDate) : undefined;
    const assignmentId = assignment_id ? parseInt(assignment_id, 10) : undefined;
    return this.executionService.findAll(req.user, includeAssignment === 'true', locationId, sd, ed, assignmentId);
  }

  @Get('daily-task-points-list')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('execution.read_location', 'execution.read_company', 'execution.read_all')
  @ApiOperation({ summary: 'Listă înregistrări Employee Daily Task Points pentru rapoarte' })
  @ApiQuery({ name: 'startDate', required: false, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'endDate', required: false, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'employee_id', required: false, description: 'Filtru angajat' })
  @ApiQuery({ name: 'location_id', required: false, description: 'Filtru locație (rapoarte pe locație)' })
  getDailyTaskPointsList(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('employee_id') employeeId?: string,
    @Query('location_id') locationId?: string,
  ) {
    const empId = employeeId ? parseInt(employeeId, 10) : undefined;
    const locId = locationId ? parseInt(locationId, 10) : undefined;
    return this.executionService.listDailyTaskPoints(
      startDate,
      endDate,
      Number.isFinite(empId) ? empId : undefined,
      Number.isFinite(locId) ? locId : undefined,
    );
  }

  @Get('manager-daily-payouts')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('execution.read_location', 'execution.read_company', 'execution.read_all')
  @ApiOperation({ summary: 'Listă înregistrări punctaj manager (manager_daily_payout) pentru rapoarte' })
  @ApiQuery({ name: 'work_location_id', required: false, description: 'Filtru locație' })
  @ApiQuery({ name: 'start_date', required: false, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'end_date', required: false, description: 'YYYY-MM-DD' })
  @ApiResponse({
    status: 200,
    description: 'Lista înregistrărilor manager_daily_payout',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'number' },
          work_location_id: { type: 'number' },
          work_date: { type: 'string', format: 'date' },
          manager_employee_id: { type: 'number' },
          total_points: { type: 'number' },
          manager_points: { type: 'number' },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
    },
  })
  getManagerDailyPayouts(
    @Query('work_location_id') workLocationId?: string,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
  ): Promise<ManagerDailyPayout[]> {
    const locId = workLocationId != null && workLocationId !== '' ? parseInt(workLocationId, 10) : undefined;
    const validLocId = locId != null && !isNaN(locId) ? locId : undefined;
    return this.executionService.findManagerDailyPayouts(validLocId, startDate, endDate);
  }

  @Get(':id')
  // @UseGuards(JwtAuthGuard, PermissionsGuard)
  // @Permissions('execution.read_own', 'execution.read_location', 'execution.read_company', 'execution.read_all')
  @ApiOperation({ summary: 'Obține o execuție specifică' })
  @ApiParam({ name: 'id', description: 'ID-ul execuției' })
  @ApiResponse({ 
    status: 200, 
    description: 'Execuție găsită',
    type: TaskExecution 
  })
  @ApiResponse({ status: 404, description: 'Execuția nu a fost găsită' })
  @ApiResponse({ status: 401, description: 'Neautorizat' })
  @ApiResponse({ status: 403, description: 'Fără permisiuni' })
  findOne(@Param('id', ParseIntPipe) id: number): Promise<TaskExecution> {
    return this.executionService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('execution.update')
  @ApiOperation({ summary: 'Actualizează o execuție' })
  @ApiParam({ name: 'id', description: 'ID-ul execuției' })
  @ApiBody({
    description: 'Datele pentru actualizarea execuției',
    examples: {
      example1: {
        summary: 'Finalizare execuție cu answers',
        value: {
          completed_at: '2024-01-15T16:00:00Z',
          comment: 'Sarcina finalizată cu succes',
          answers: [
            {
              task_element_id: 3,
              value: 'true',
              score_awarded: 7
            },
            {
              task_element_id: 4,
              value: 'https://example.com/photo2.jpg'
            }
          ]
        }
      },
      example2: {
        summary: 'Verificare de manager prin elemente',
        value: {
          comment: 'Task verificat și aprobat de manager'
        }
      },
      example3: {
        summary: 'Actualizare answers',
        value: {
          answers: [
            {
              task_element_id: 1,
              value: 'false',
              score_awarded: 0
            }
          ]
        }
      }
    }
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Execuție actualizată cu succes',
    type: TaskExecution 
  })
  @ApiResponse({ status: 404, description: 'Execuția nu a fost găsită' })
  @ApiResponse({ status: 401, description: 'Neautorizat' })
  @ApiResponse({ status: 403, description: 'Fără permisiuni' })
  update(
    @Param('id', ParseIntPipe) id: number, 
    @Body() updateExecutionDto: UpdateExecutionDto,
  ): Promise<TaskExecution> {
    return this.executionService.update(id, updateExecutionDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('execution.delete')
  @ApiOperation({ summary: 'Șterge o execuție' })
  @ApiParam({ name: 'id', description: 'ID-ul execuției' })
  @ApiResponse({ status: 200, description: 'Execuție ștearsă cu succes' })
  @ApiResponse({ status: 404, description: 'Execuția nu a fost găsită' })
  @ApiResponse({ status: 401, description: 'Neautorizat' })
  @ApiResponse({ status: 403, description: 'Fără permisiuni' })
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.executionService.remove(id);
  }

  @Post(':id/reactivate')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('execution.update', 'execution.delete')
  @ApiOperation({ summary: 'Reactivează o execuție (respinge și reactivează assignment-ul)' })
  @ApiParam({ name: 'id', description: 'ID-ul execuției care trebuie reactivată' })
  @ApiResponse({ 
    status: 200, 
    description: 'Execuția a fost reactivată cu succes (assignment-ul a fost reactivat)',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        executionId: { type: 'number' },
        assignmentId: { type: 'number' }
      }
    }
  })
  @ApiResponse({ status: 404, description: 'Execuția nu a fost găsită' })
  @ApiResponse({ status: 401, description: 'Neautorizat' })
  @ApiResponse({ status: 403, description: 'Fără permisiuni' })
  reactivateExecution(@Param('id', ParseIntPipe) id: number): Promise<{ message: string; executionId: number; assignmentId: number }> {
    return this.executionService.reactivateExecution(id);
  }

  @Post(':id/approve')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('execution.update', 'execution.delete')
  @ApiOperation({ summary: 'Aprobă o execuție finalizată (marchează assignment-ul ca completed)' })
  @ApiParam({ name: 'id', description: 'ID-ul execuției care trebuie aprobată' })
  @ApiResponse({ 
    status: 200, 
    description: 'Execuția a fost aprobată cu succes',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        executionId: { type: 'number' },
        assignmentId: { type: 'number' }
      }
    }
  })
  @ApiResponse({ status: 404, description: 'Execuția nu a fost găsită' })
  @ApiResponse({ status: 401, description: 'Neautorizat' })
  @ApiResponse({ status: 403, description: 'Fără permisiuni' })
  approveExecution(@Param('id', ParseIntPipe) id: number, @Request() req): Promise<{ message: string; executionId: number; assignmentId: number; approvedBy: string }> {
    return this.executionService.approveExecution(id, req.user);
  }

  // ===== ENDPOINT-URI PENTRU PUNCTAJ ZILNIC =====

  @Post('daily-points')
  @ApiOperation({ summary: 'Creează punctaj zilnic pentru un angajat' })
  @ApiResponse({ 
    status: 201, 
    description: 'Punctaj zilnic creat cu succes',
    type: EmployeeDailyPoints 
  })
  @ApiResponse({ status: 400, description: 'Date invalide sau punctaj existent' })
  createDailyPoints(@Body() createDto: CreateEmployeeDailyPointsDto): Promise<EmployeeDailyPoints> {
    return this.executionService.createEmployeeDailyPoints(createDto);
  }

  @Get('daily-points/:employeeId/:workDate')
  @ApiOperation({ summary: 'Obține punctajul zilnic pentru un angajat' })
  @ApiParam({ name: 'employeeId', description: 'ID-ul angajatului' })
  @ApiParam({ name: 'workDate', description: 'Data de lucru (YYYY-MM-DD)' })
  @ApiResponse({ 
    status: 200, 
    description: 'Punctaj zilnic găsit',
    type: EmployeeDailyPoints 
  })
  @ApiResponse({ status: 404, description: 'Punctajul nu a fost găsit' })
  getDailyPoints(
    @Param('employeeId', ParseIntPipe) employeeId: number,
    @Param('workDate') workDate: string
  ): Promise<EmployeeDailyPoints> {
    return this.executionService.getEmployeeDailyPoints(employeeId, workDate);
  }

  @Post('daily-task-points')
  @ApiOperation({ summary: 'Adaugă punctaj pentru un task în punctajul zilnic' })
  @ApiResponse({ 
    status: 201, 
    description: 'Punctaj pentru task adăugat cu succes',
    type: EmployeeDailyTaskPoints 
  })
  @ApiResponse({ status: 400, description: 'Date invalide sau punctaj existent' })
  addTaskPoints(@Body() createDto: CreateEmployeeDailyTaskPointsDto): Promise<EmployeeDailyTaskPoints> {
    return this.executionService.addTaskPointsToDailyPoints(createDto);
  }

  @Get('employee-points/:employeeId')
  @ApiOperation({ summary: 'Obține punctajul unui angajat pentru o perioadă' })
  @ApiParam({ name: 'employeeId', description: 'ID-ul angajatului' })
  @ApiResponse({ 
    status: 200, 
    description: 'Punctajul pentru perioada specificată',
    type: [EmployeeDailyPoints] 
  })
  getEmployeePointsForRange(
    @Param('employeeId', ParseIntPipe) employeeId: number,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string
  ): Promise<EmployeeDailyPoints[]> {
    return this.executionService.getEmployeePointsForDateRange(employeeId, startDate, endDate);
  }

  @Get('employee-total-points/:employeeId')
  @ApiOperation({ summary: 'Calculează punctajul total al unui angajat pentru o perioadă' })
  @ApiParam({ name: 'employeeId', description: 'ID-ul angajatului' })
  @ApiResponse({ 
    status: 200, 
    description: 'Punctajul total pentru perioada specificată',
    schema: { type: 'number' }
  })
  getEmployeeTotalPoints(
    @Param('employeeId', ParseIntPipe) employeeId: number,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string
  ): Promise<number> {
    return this.executionService.calculateTotalPointsForEmployee(employeeId, startDate, endDate);
  }

  @Post('process-overdue-tasks')
  @ApiOperation({ summary: 'Procesează task-urile întârziate și nefinalizate pentru o dată specifică' })
  @ApiBody({
    description: 'Data pentru care se procesează task-urile întârziate',
    examples: {
      example1: {
        summary: 'Procesare pentru astăzi',
        value: {
          date: '2024-01-15'
        }
      }
    }
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Task-urile întârziate au fost procesate cu succes',
    schema: { 
      type: 'object',
      properties: {
        processedTasks: { type: 'number' },
        totalPointsDeducted: { type: 'number' }
      }
    }
  })
  processOverdueTasks(@Body() body: { date: string }): Promise<{ processedTasks: number; totalPointsDeducted: number }> {
    return this.executionService.processOverdueTasks(body.date);
  }

  // ===== AGREGAȚI PUNCTE PE LOCAȚIE/ANGAJAT ÎNTR-UN INTERVAL =====
  @Get('location-total-points')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('execution.read_location', 'execution.read_company', 'execution.read_all')
  @ApiOperation({ summary: 'Puncte totale pe locație într-un interval' })
  @ApiResponse({ status: 200, description: 'Total puncte', schema: { type: 'number' } })
  getLocationTotalPoints(
    @Query('location_id') location_id?: string,
    @Query('locationId') locationId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<number> {
    const rawLocation = (location_id ?? locationId ?? '').toString();
    const locId = parseInt(rawLocation, 10);
    if (isNaN(locId)) {
      throw new (require('@nestjs/common').BadRequestException)('location_id este obligatoriu și trebuie să fie numeric');
    }
    return this.executionService.calculateTotalPointsForLocation(locId, startDate, endDate);
  }

  @Get('location-employee-points')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('execution.read_location', 'execution.read_company', 'execution.read_all')
  @ApiOperation({ summary: 'Puncte pe angajat pentru o locație într-un interval' })
  @ApiResponse({ 
    status: 200, 
    description: 'Lista cu punctele per angajat',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          employee_id: { type: 'number' },
          total_points: { type: 'number' }
        }
      }
    } 
  })
  getLocationEmployeePoints(
    @Query('location_id') location_id?: string,
    @Query('locationId') locationId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<Array<{ employee_id: number; total_points: number }>> {
    const rawLocation = (location_id ?? locationId ?? '').toString();
    const locId = parseInt(rawLocation, 10);
    if (isNaN(locId)) {
      throw new (require('@nestjs/common').BadRequestException)('location_id este obligatoriu și trebuie să fie numeric');
    }
    return this.executionService.calculatePointsByEmployeeForLocation(locId, startDate, endDate);
  }

  // === TASK IMAGE UPLOAD ===
  @Post('upload-image')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('execution.create')
  async uploadTaskImage(@Body() payload: { fileName: string; content: string }) {
    const imageUrl = await this.executionService.uploadTaskImage(payload.fileName, payload.content);
    return { imageUrl };
  }

  // === TASK IMAGE SERVE ===
  @Get('image/:fileName')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('execution.read_own', 'execution.read_location', 'execution.read_company', 'execution.read_all', 'execution.read')
  async serveTaskImage(@Param('fileName') fileName: string, @Res() res: Response) {
    const { buffer, mimeType } = await this.executionService.serveTaskImage(fileName);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Cache-Control', 'public, max-age=3600, must-revalidate');
    res.send(buffer);
  }

  // === TASK IMAGE DELETE ===
  @Post('delete-image')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('execution.update')
  async deleteTaskImage(@Body() payload: { imageUrl: string }) {
    await this.executionService.deleteTaskImage(payload.imageUrl);
    return { success: true, message: 'Imaginea a fost ștearsă cu succes' };
  }
} 