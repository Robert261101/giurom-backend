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
  UseGuards,
  HttpStatus,
  ParseBoolPipe,
  Inject,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';
import { CreateWorkLocationDto } from './dto/create-work-location.dto';
import { UpdateWorkLocationDto } from './dto/update-work-location.dto';
import { CreateTaskTemplateAssignmentDto } from './dto/create-task-template-assignment.dto';
import { UpdateTaskTemplateAssignmentDto } from './dto/update-task-template-assignment.dto';
import { WorkLocation } from './entity/work-location.entity';
import { WorkLocationTaskTemplate } from './entity/work-location-task-template.entity';

@ApiTags('locations')
@Controller('locations')
@UseGuards(ThrottlerGuard)
@ApiBearerAuth()
export class LocationsController {
  constructor(@Inject('LOCATIONS_SERVICE') private readonly locationsClient: ClientProxy) {}

  @Post()
  @ApiOperation({ summary: 'Creează o nouă locație de lucru' })
  @ApiResponse({ status: HttpStatus.CREATED, type: WorkLocation })
  async createWorkLocation(@Body() dto: CreateWorkLocationDto): Promise<WorkLocation> {
    return await lastValueFrom(this.locationsClient.send<WorkLocation>('locations.create', dto));
  }

  @Get()
  @ApiOperation({ summary: 'Lista locațiilor de lucru' })
  @ApiResponse({ status: HttpStatus.OK })
  async findAllWorkLocations(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('companyId') companyId?: number,
    @Query('city') city?: string,
    @Query('search') search?: string,
  ): Promise<{ locations: WorkLocation[]; total: number; totalPages: number }> {
    return await lastValueFrom(
      this.locationsClient.send('locations.findAll', {
        page: page || 1,
        limit: limit || 10,
        companyId,
        city,
        search,
      }),
    );
  }

  @Get('statistics')
  @ApiOperation({ summary: 'Statistici locații' })
  @ApiResponse({ status: HttpStatus.OK })
  async getLocationStatistics(): Promise<{
    total_locations: number;
    locations_by_company: { company_id: number; company_name: string; count: number }[];
    total_assignments: number;
    active_assignments: number;
  }> {
    return await lastValueFrom(this.locationsClient.send('locations.statistics', {}));
  }

  @Get('company/:companyId')
  @ApiOperation({ summary: 'Locațiile unei companii' })
  @ApiParam({ name: 'companyId', type: Number })
  async findWorkLocationsByCompany(@Param('companyId', ParseIntPipe) companyId: number): Promise<WorkLocation[]> {
    return await lastValueFrom(this.locationsClient.send<WorkLocation[]>('locations.findByCompany', companyId));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Locație după ID' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: HttpStatus.OK, type: WorkLocation })
  async findWorkLocationById(@Param('id', ParseIntPipe) id: number): Promise<WorkLocation> {
    return await lastValueFrom(this.locationsClient.send<WorkLocation>('locations.findById', id));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizează locație' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: HttpStatus.OK, type: WorkLocation })
  async updateWorkLocation(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateWorkLocationDto,
  ): Promise<WorkLocation> {
    return await lastValueFrom(this.locationsClient.send<WorkLocation>('locations.update', { id, dto }));
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Șterge locație' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: HttpStatus.OK })
  async removeWorkLocation(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return await lastValueFrom(this.locationsClient.send<void>('locations.remove', id));
  }

  @Post('assignments')
  @ApiOperation({ summary: 'Atribuie template' })
  @ApiResponse({ status: HttpStatus.CREATED, type: WorkLocationTaskTemplate })
  async createTaskTemplateAssignment(
    @Body() dto: CreateTaskTemplateAssignmentDto,
  ): Promise<WorkLocationTaskTemplate> {
    return await lastValueFrom(this.locationsClient.send<WorkLocationTaskTemplate>('locations.assignments.create', dto));
  }

  @Get('assignments')
  @ApiOperation({ summary: 'Lista atribuirilor' })
  @ApiResponse({ status: HttpStatus.OK })
  async findAllTaskTemplateAssignments(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('locationId') locationId?: number,
    @Query('templateId') templateId?: number,
    @Query('active', ParseBoolPipe) active?: boolean,
  ): Promise<{ assignments: WorkLocationTaskTemplate[]; total: number; totalPages: number }> {
    return await lastValueFrom(
      this.locationsClient.send('locations.assignments.findAll', {
        page: page || 1,
        limit: limit || 10,
        locationId,
        templateId,
        active,
      }),
    );
  }

  @Get(':locationId/assignments')
  @ApiOperation({ summary: 'Atribuiri pentru o locație' })
  @ApiParam({ name: 'locationId', type: Number })
  async findTaskTemplateAssignmentsByLocation(
    @Param('locationId', ParseIntPipe) locationId: number,
  ): Promise<WorkLocationTaskTemplate[]> {
    return await lastValueFrom(this.locationsClient.send<WorkLocationTaskTemplate[]>('locations.assignments.findByLocation', locationId));
  }

  @Get('assignments/:assignmentId')
  @ApiOperation({ summary: 'Atribuire după ID' })
  @ApiParam({ name: 'assignmentId', type: Number })
  async findTaskTemplateAssignmentById(
    @Param('assignmentId', ParseIntPipe) assignmentId: number,
  ): Promise<WorkLocationTaskTemplate> {
    return await lastValueFrom(this.locationsClient.send<WorkLocationTaskTemplate>('locations.assignments.findById', assignmentId));
  }

  @Patch('assignments/:assignmentId')
  @ApiOperation({ summary: 'Actualizează atribuire' })
  @ApiParam({ name: 'assignmentId', type: Number })
  async updateTaskTemplateAssignment(
    @Param('assignmentId', ParseIntPipe) assignmentId: number,
    @Body() dto: UpdateTaskTemplateAssignmentDto,
  ): Promise<WorkLocationTaskTemplate> {
    return await lastValueFrom(this.locationsClient.send<WorkLocationTaskTemplate>('locations.assignments.update', { assignmentId, dto }));
  }

  @Patch('assignments/:assignmentId/toggle')
  @ApiOperation({ summary: 'Toggle atribuire' })
  @ApiParam({ name: 'assignmentId', type: Number })
  @ApiQuery({ name: 'active', type: Boolean })
  async toggleAssignmentStatus(
    @Param('assignmentId', ParseIntPipe) assignmentId: number,
    @Query('active', ParseBoolPipe) active: boolean,
  ): Promise<WorkLocationTaskTemplate> {
    return await lastValueFrom(this.locationsClient.send<WorkLocationTaskTemplate>('locations.assignments.toggle', { assignmentId, active }));
  }

  @Delete('assignments/:assignmentId')
  @ApiOperation({ summary: 'Șterge atribuire' })
  @ApiParam({ name: 'assignmentId', type: Number })
  async removeTaskTemplateAssignment(@Param('assignmentId', ParseIntPipe) assignmentId: number): Promise<void> {
    return await lastValueFrom(this.locationsClient.send<void>('locations.assignments.remove', assignmentId));
  }

  @Patch('templates/:templateId/deactivate')
  @ApiOperation({ summary: 'Dezactivează toate atribuirile unui template' })
  @ApiParam({ name: 'templateId', type: Number })
  async deactivateTemplateAssignments(@Param('templateId', ParseIntPipe) templateId: number): Promise<void> {
    return await lastValueFrom(this.locationsClient.send<void>('locations.templates.deactivate', templateId));
  }
} 