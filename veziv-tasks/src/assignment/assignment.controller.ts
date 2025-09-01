import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { AssignmentService } from './assignment.service';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { UpdateAssignmentDto } from './dto/update-assignment.dto';
import { TaskAssignment } from './entity/task-assignment.entity';

@ApiTags('Assignments')
@Controller('assignments')
export class AssignmentController {
  constructor(private readonly assignmentService: AssignmentService) {}

  @Post()
  @ApiOperation({ summary: 'Creează un assignment nou cu toate elementele sale' })
  @ApiResponse({ 
    status: 201, 
    description: 'Assignment creat cu succes',
    type: TaskAssignment 
  })
  @ApiResponse({ status: 400, description: 'Date invalide' })
  create(@Body() createAssignmentDto: CreateAssignmentDto): Promise<TaskAssignment> {
    return this.assignmentService.create(createAssignmentDto);
  }

  @Get()
  @ApiOperation({ summary: 'Obține toate assignment-urile cu elementele lor' })
  @ApiResponse({ 
    status: 200, 
    description: 'Lista de assignment-uri',
    type: [TaskAssignment] 
  })
  findAll(): Promise<TaskAssignment[]> {
    return this.assignmentService.findAll();
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

  @Delete(':id')
  @ApiOperation({ summary: 'Șterge un assignment și toate elementele sale' })
  @ApiParam({ name: 'id', description: 'ID-ul assignment-ului' })
  @ApiResponse({ status: 200, description: 'Assignment șters cu succes' })
  @ApiResponse({ status: 404, description: 'Assignment nu a fost găsit' })
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.assignmentService.remove(id);
  }
} 