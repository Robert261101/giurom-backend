import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { LocationsService } from './locations/locations.service';
import { CreateWorkLocationDto } from './locations/dto/create-work-location.dto';
import { UpdateWorkLocationDto } from './locations/dto/update-work-location.dto';
import { CreateTaskTemplateAssignmentDto } from './locations/dto/create-task-template-assignment.dto';
import { UpdateTaskTemplateAssignmentDto } from './locations/dto/update-task-template-assignment.dto';

@Controller()
export class LocationsMicroController {
  constructor(private readonly locationsService: LocationsService) {}

  @MessagePattern('locations.create')
  create(@Payload() dto: CreateWorkLocationDto) {
    return this.locationsService.createWorkLocation(dto);
  }

  @MessagePattern('locations.findAll')
  findAll(
    @Payload()
    payload: {
      page: number;
      limit: number;
      companyId?: number;
      city?: string;
      search?: string;
      includeInactive?: boolean;
    },
  ) {
    return this.locationsService.findAllWorkLocations(
      payload.page,
      payload.limit,
      payload.companyId,
      payload.city,
      payload.search,
      undefined,
      payload.includeInactive === true,
    );
  }

  @MessagePattern('locations.statistics')
  statistics() {
    return this.locationsService.getLocationStatistics();
  }

  @MessagePattern('locations.findByCompany')
  findByCompany(
    @Payload() payload: number | { companyId: number; includeInactive?: boolean },
  ) {
    if (typeof payload === 'number') {
      return this.locationsService.findWorkLocationsByCompany(payload);
    }
    return this.locationsService.findWorkLocationsByCompany(
      payload.companyId,
      undefined,
      payload.includeInactive === true,
    );
  }

  @MessagePattern('locations.findById')
  findById(@Payload() id: number) {
    return this.locationsService.findWorkLocationById(id);
  }

  @MessagePattern('locations.update')
  update(@Payload() payload: { id: number; dto: UpdateWorkLocationDto }) {
    return this.locationsService.updateWorkLocation(payload.id, payload.dto);
  }

  @MessagePattern('locations.remove')
  remove(@Payload() id: number) {
    return this.locationsService.removeWorkLocation(id);
  }

  @MessagePattern('locations.assignments.create')
  createAssignment(@Payload() dto: CreateTaskTemplateAssignmentDto) {
    return this.locationsService.createTaskTemplateAssignment(dto);
  }

  @MessagePattern('locations.assignments.findAll')
  findAllAssignments(
    @Payload()
    payload: { page: number; limit: number; locationId?: number; templateId?: number; active?: boolean },
  ) {
    return this.locationsService.findAllTaskTemplateAssignments(
      payload.page,
      payload.limit,
      payload.locationId,
      payload.templateId,
      payload.active,
    );
  }

  @MessagePattern('locations.assignments.findByLocation')
  findAssignmentsByLocation(@Payload() locationId: number) {
    return this.locationsService.findTaskTemplateAssignmentsByLocation(locationId);
  }

  @MessagePattern('locations.assignments.findById')
  findAssignmentById(@Payload() assignmentId: number) {
    return this.locationsService.findTaskTemplateAssignmentById(assignmentId);
  }

  @MessagePattern('locations.assignments.update')
  updateAssignment(
    @Payload() payload: { assignmentId: number; dto: UpdateTaskTemplateAssignmentDto },
  ) {
    return this.locationsService.updateTaskTemplateAssignment(
      payload.assignmentId,
      payload.dto,
    );
  }

  @MessagePattern('locations.assignments.toggle')
  toggleAssignment(@Payload() payload: { assignmentId: number; active: boolean }) {
    return this.locationsService.toggleAssignmentStatus(payload.assignmentId, payload.active);
  }

  @MessagePattern('locations.assignments.remove')
  removeAssignment(@Payload() assignmentId: number) {
    return this.locationsService.removeTaskTemplateAssignment(assignmentId);
  }

  @MessagePattern('locations.templates.deactivate')
  deactivateTemplateAssignments(@Payload() templateId: number) {
    return this.locationsService.deactivateTemplateAssignments(templateId);
  }
}