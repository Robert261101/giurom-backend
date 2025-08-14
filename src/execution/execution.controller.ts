import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody } from '@nestjs/swagger';
import { ExecutionService } from './execution.service';
import { CreateExecutionDto } from './dto/create-execution.dto';
import { UpdateExecutionDto } from './dto/update-execution.dto';
import { TaskExecution } from './entity/task-execution.entity';

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
} 