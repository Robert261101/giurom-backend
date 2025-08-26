import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody } from '@nestjs/swagger';
import { ExecutionService } from './execution.service';
import { CreateExecutionDto } from './dto/create-execution.dto';
import { UpdateExecutionDto } from './dto/update-execution.dto';
import { CreateEmployeeDailyPointsDto } from './dto/create-employee-daily-points.dto';
import { CreateEmployeeDailyTaskPointsDto } from './dto/create-employee-daily-task-points.dto';
import { TaskExecution } from './entity/task-execution.entity';
import { EmployeeDailyPoints } from './entity/employee-daily-points.entity';
import { EmployeeDailyTaskPoints } from './entity/employee-daily-task-points.entity';

@ApiTags('Executions')
@Controller('executions')
export class ExecutionController {
  constructor(private readonly executionService: ExecutionService) {}

  @Post()
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
  create(@Body() createExecutionDto: CreateExecutionDto): Promise<TaskExecution> {
    return this.executionService.create(createExecutionDto);
  }

  @Get()
  @ApiOperation({ summary: 'Obține toate execuțiile' })
  @ApiResponse({ 
    status: 200, 
    description: 'Lista de execuții',
    type: [TaskExecution] 
  })
  findAll(@Query('include_assignment') includeAssignment?: string): Promise<TaskExecution[]> {
    return this.executionService.findAll(includeAssignment === 'true');
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obține o execuție specifică' })
  @ApiParam({ name: 'id', description: 'ID-ul execuției' })
  @ApiResponse({ 
    status: 200, 
    description: 'Execuție găsită',
    type: TaskExecution 
  })
  @ApiResponse({ status: 404, description: 'Execuția nu a fost găsită' })
  findOne(@Param('id', ParseIntPipe) id: number): Promise<TaskExecution> {
    return this.executionService.findOne(id);
  }

  @Patch(':id')
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
          total_score: 90,
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
        summary: 'Verificare de manager',
        value: {
          is_verified_by_manager: true,
          verification_date: '2024-01-15T17:00:00Z',
          total_score: 95
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
  update(
    @Param('id', ParseIntPipe) id: number, 
    @Body() updateExecutionDto: UpdateExecutionDto,
  ): Promise<TaskExecution> {
    return this.executionService.update(id, updateExecutionDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Șterge o execuție' })
  @ApiParam({ name: 'id', description: 'ID-ul execuției' })
  @ApiResponse({ status: 200, description: 'Execuție ștearsă cu succes' })
  @ApiResponse({ status: 404, description: 'Execuția nu a fost găsită' })
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.executionService.remove(id);
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
} 