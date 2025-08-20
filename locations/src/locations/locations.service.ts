import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkLocation } from '../locations/entity/work-location.entity';
import { WorkLocationTaskTemplate } from '../locations/entity/work-location-task-template.entity';
import { CreateWorkLocationDto } from './dto/create-work-location.dto';
import { UpdateWorkLocationDto } from './dto/update-work-location.dto';
import { CreateTaskTemplateAssignmentDto } from './dto/create-task-template-assignment.dto';
import { UpdateTaskTemplateAssignmentDto } from './dto/update-task-template-assignment.dto';

@Injectable()
export class LocationsService {
  constructor(
    @InjectRepository(WorkLocation) private readonly workLocationRepository: Repository<WorkLocation>,
    @InjectRepository(WorkLocationTaskTemplate) private readonly taskTemplateRepository: Repository<WorkLocationTaskTemplate>,
  ) {}

  async createWorkLocation(dto: CreateWorkLocationDto): Promise<WorkLocation> {
    const entity: WorkLocation = this.workLocationRepository.create(
      dto as unknown as Partial<WorkLocation>,
    ) as WorkLocation;
    const saved: WorkLocation = await this.workLocationRepository.save(entity as WorkLocation);
    return saved;
  }

  async findAllWorkLocations(
    page = 1,
    limit = 10,
    companyId?: number,
    city?: string,
    search?: string,
  ): Promise<{ locations: WorkLocation[]; total: number; totalPages: number }> {
    const qb = this.workLocationRepository
      .createQueryBuilder('location')
      .leftJoinAndSelect('location.task_templates', 'task_templates');
    if (companyId) qb.where('location.company_id = :companyId', { companyId });
    if (city) qb.andWhere('location.city = :city', { city });
    if (search)
      qb.andWhere(
        'location.location_name LIKE :search OR location.address LIKE :search',
        { search: `%${search}%` },
      );
    const offset = (page - 1) * limit;
    const [locations, total] = await qb
      .orderBy('location.created_at', 'DESC')
      .skip(offset)
      .take(limit)
      .getManyAndCount();
    return { locations, total, totalPages: Math.ceil(total / limit) };
  }

  async findWorkLocationById(id: number): Promise<WorkLocation> {
    const workLocation = await this.workLocationRepository.findOne({
      where: { id },
      relations: ['task_templates', 'company'],
    });
    if (!workLocation)
      throw new NotFoundException(`Locația cu ID-ul ${id} nu a fost găsită`);
    return workLocation;
  }

  async findWorkLocationsByCompany(companyId: number): Promise<WorkLocation[]> {
    return await this.workLocationRepository.find({
      where: { company_id: companyId },
      relations: ['task_templates', 'company'],
      order: { id: 'DESC' },
    });
  }

  async updateWorkLocation(id: number, dto: UpdateWorkLocationDto): Promise<WorkLocation> {
    const workLocation = await this.findWorkLocationById(id);
    Object.assign(workLocation, dto);
    return await this.workLocationRepository.save(workLocation as WorkLocation);
  }

  async removeWorkLocation(id: number): Promise<void> {
    const workLocation = await this.findWorkLocationById(id);
    await this.workLocationRepository.remove(workLocation as WorkLocation);
  }

  async createTaskTemplateAssignment(
    dto: CreateTaskTemplateAssignmentDto,
  ): Promise<WorkLocationTaskTemplate> {
    await this.findWorkLocationById(dto.location_id);
    const existing = await this.taskTemplateRepository.findOne({
      where: {
        location_id: dto.location_id,
        template_id: dto.template_id || 1,
        active: true,
      },
    });
    if (existing)
      throw new BadRequestException(
        `Template-ul ${dto.template_id || 1} este deja atribuit activ la această locație`,
      );
    const assignment: WorkLocationTaskTemplate = this.taskTemplateRepository.create({
      ...dto,
      assigned_at: new Date(),
    }) as WorkLocationTaskTemplate;
    return await this.taskTemplateRepository.save(
      assignment as WorkLocationTaskTemplate,
    );
  }

  async findAllTaskTemplateAssignments(
    page = 1,
    limit = 10,
    locationId?: number,
    templateId?: number,
    active?: boolean,
  ): Promise<{ assignments: WorkLocationTaskTemplate[]; total: number; totalPages: number }> {
    const qb = this.taskTemplateRepository
      .createQueryBuilder('assignment')
      .leftJoinAndSelect('assignment.work_location', 'work_location');
    if (locationId) qb.where('assignment.location_id = :locationId', { locationId });
    if (templateId) qb.andWhere('assignment.template_id = :templateId', { templateId });
    if (active !== undefined) qb.andWhere('assignment.active = :active', { active });
    const offset = (page - 1) * limit;
    const [assignments, total] = await qb
      .orderBy('assignment.assigned_at', 'DESC')
      .skip(offset)
      .take(limit)
      .getManyAndCount();
    return { assignments, total, totalPages: Math.ceil(total / limit) };
  }

  async findTaskTemplateAssignmentById(
    id: number,
  ): Promise<WorkLocationTaskTemplate> {
    const assignment = await this.taskTemplateRepository.findOne({
      where: { id },
      relations: ['work_location'],
    });
    if (!assignment)
      throw new NotFoundException(
        `Atribuirea cu ID-ul ${id} nu a fost găsită`,
      );
    return assignment;
  }

  async findTaskTemplateAssignmentsByLocation(
    locationId: number,
  ): Promise<WorkLocationTaskTemplate[]> {
    await this.findWorkLocationById(locationId);
    return await this.taskTemplateRepository.find({
      where: { location_id: locationId },
      relations: ['work_location'],
      order: { assigned_at: 'DESC' },
    });
  }

  async updateTaskTemplateAssignment(
    id: number,
    dto: UpdateTaskTemplateAssignmentDto,
  ): Promise<WorkLocationTaskTemplate> {
    const assignment = await this.findTaskTemplateAssignmentById(id);
    Object.assign(assignment, dto);
    return await this.taskTemplateRepository.save(
      assignment as WorkLocationTaskTemplate,
    );
  }

  async removeTaskTemplateAssignment(id: number): Promise<void> {
    const assignment = await this.findTaskTemplateAssignmentById(id);
    await this.taskTemplateRepository.remove(assignment as WorkLocationTaskTemplate);
  }

  async deactivateTemplateAssignments(templateId: number): Promise<void> {
    await this.taskTemplateRepository.update(
      { template_id: templateId },
      { active: false },
    );
  }

  async toggleAssignmentStatus(
    id: number,
    active: boolean,
  ): Promise<WorkLocationTaskTemplate> {
    const assignment = await this.findTaskTemplateAssignmentById(id);
    assignment.active = active;
    return await this.taskTemplateRepository.save(
      assignment as WorkLocationTaskTemplate,
    );
  }

  async getLocationStatistics(): Promise<{
    total_locations: number;
    locations_by_company: { company_id: number; company_name: string; count: number }[];
    total_assignments: number;
    active_assignments: number;
  }> {
    const total_locations = await this.workLocationRepository.count();
    const total_assignments = await this.taskTemplateRepository.count();
    const active_assignments = await this.taskTemplateRepository.count({
      where: { active: true },
    });
    return {
      total_locations,
      locations_by_company: [],
      total_assignments,
      active_assignments,
    };
  }
} 