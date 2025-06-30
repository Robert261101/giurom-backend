import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkLocation } from './entity/work-location.entity';
import { WorkLocationTaskTemplate } from './entity/work-location-task-template.entity';
import { CreateWorkLocationDto } from './dto/create-work-location.dto';
import { UpdateWorkLocationDto } from './dto/update-work-location.dto';
import { CreateTaskTemplateAssignmentDto } from './dto/create-task-template-assignment.dto';
import { UpdateTaskTemplateAssignmentDto } from './dto/update-task-template-assignment.dto';

@Injectable()
export class LocationsService {
  constructor(
    @InjectRepository(WorkLocation)
    private readonly workLocationRepository: Repository<WorkLocation>,
    @InjectRepository(WorkLocationTaskTemplate)
    private readonly taskTemplateRepository: Repository<WorkLocationTaskTemplate>,
  ) {}

  // ===================== WORK LOCATION OPERATIONS =====================

  /**
   * Creează o nouă locație de lucru
   */
  async createWorkLocation(
    createWorkLocationDto: CreateWorkLocationDto,
  ): Promise<WorkLocation> {
    const workLocation = this.workLocationRepository.create(createWorkLocationDto);
    return await this.workLocationRepository.save(workLocation);
  }

  /**
   * Returnează toate locațiile cu opțiune de filtrare
   */
  async findAllWorkLocations(
    page: number = 1,
    limit: number = 10,
    companyId?: number,
    city?: string,
    search?: string,
  ): Promise<{ locations: WorkLocation[]; total: number; totalPages: number }> {
    const queryBuilder = this.workLocationRepository
      .createQueryBuilder('location')
      .leftJoinAndSelect('location.company', 'company')
      .leftJoinAndSelect('location.task_templates', 'task_templates');

    // Aplicarea filtrărilor
    if (companyId) {
      queryBuilder.where('location.company_id = :companyId', { companyId });
    }

    if (city) {
      queryBuilder.andWhere('location.city = :city', { city });
    }

    if (search) {
      queryBuilder.andWhere(
        'location.location_name LIKE :search OR location.address LIKE :search',
        { search: `%${search}%` },
      );
    }

    // Paginarea
    const offset = (page - 1) * limit;
    queryBuilder.skip(offset).take(limit);

    // Ordonarea
    queryBuilder.orderBy('location.created_at', 'DESC');

    const [locations, total] = await queryBuilder.getManyAndCount();
    const totalPages = Math.ceil(total / limit);

    return { locations, total, totalPages };
  }

  /**
   * Returnează o locație după ID
   */
  async findWorkLocationById(id: number): Promise<WorkLocation> {
    const workLocation = await this.workLocationRepository.findOne({
      where: { id },
      relations: ['company', 'task_templates'],
    });

    if (!workLocation) {
      throw new NotFoundException(`Locația cu ID-ul ${id} nu a fost găsită`);
    }

    return workLocation;
  }

  /**
   * Returnează locațiile unei companii
   */
  async findWorkLocationsByCompany(companyId: number): Promise<WorkLocation[]> {
    return await this.workLocationRepository.find({
      where: { company_id: companyId },
      relations: ['company', 'task_templates'],
      order: { id: 'DESC' },
    });
  }

  /**
   * Actualizează o locație
   */
  async updateWorkLocation(
    id: number,
    updateWorkLocationDto: UpdateWorkLocationDto,
  ): Promise<WorkLocation> {
    const workLocation = await this.findWorkLocationById(id);

    Object.assign(workLocation, updateWorkLocationDto);
    return await this.workLocationRepository.save(workLocation);
  }

  /**
   * Șterge o locație
   */
  async removeWorkLocation(id: number): Promise<void> {
    const workLocation = await this.findWorkLocationById(id);
    await this.workLocationRepository.remove(workLocation);
  }

  // ===================== TASK TEMPLATE ASSIGNMENT OPERATIONS =====================

  /**
   * Atribuie un template de sarcină la o locație
   */
  async createTaskTemplateAssignment(
    createAssignmentDto: CreateTaskTemplateAssignmentDto,
  ): Promise<WorkLocationTaskTemplate> {
    // Verifică dacă locația există
    await this.findWorkLocationById(createAssignmentDto.location_id);

    // Verifică dacă există deja o atribuire activă pentru același template și locație
    const existingAssignment = await this.taskTemplateRepository.findOne({
      where: {
        location_id: createAssignmentDto.location_id,
        template_id: createAssignmentDto.template_id || 1,
        active: true,
      },
    });

    if (existingAssignment) {
      throw new BadRequestException(
        `Template-ul ${createAssignmentDto.template_id || 1} este deja atribuit activ la această locație`,
      );
    }

    const assignment = this.taskTemplateRepository.create({
      ...createAssignmentDto,
      assigned_at: new Date(),
    });

    return await this.taskTemplateRepository.save(assignment);
  }

  /**
   * Returnează toate atribuirile cu opțiuni de filtrare
   */
  async findAllTaskTemplateAssignments(
    page: number = 1,
    limit: number = 10,
    locationId?: number,
    templateId?: number,
    active?: boolean,
  ): Promise<{
    assignments: WorkLocationTaskTemplate[];
    total: number;
    totalPages: number;
  }> {
    const queryBuilder = this.taskTemplateRepository
      .createQueryBuilder('assignment')
      .leftJoinAndSelect('assignment.work_location', 'work_location')
      .leftJoinAndSelect('work_location.company', 'company');

    // Aplicarea filtrărilor
    if (locationId) {
      queryBuilder.where('assignment.location_id = :locationId', { locationId });
    }

    if (templateId) {
      queryBuilder.andWhere('assignment.template_id = :templateId', {
        templateId,
      });
    }

    if (active !== undefined) {
      queryBuilder.andWhere('assignment.active = :active', { active });
    }

    // Paginarea
    const offset = (page - 1) * limit;
    queryBuilder.skip(offset).take(limit);

    // Ordonarea
    queryBuilder.orderBy('assignment.assigned_at', 'DESC');

    const [assignments, total] = await queryBuilder.getManyAndCount();
    const totalPages = Math.ceil(total / limit);

    return { assignments, total, totalPages };
  }

  /**
   * Returnează o atribuire după ID
   */
  async findTaskTemplateAssignmentById(
    id: number,
  ): Promise<WorkLocationTaskTemplate> {
    const assignment = await this.taskTemplateRepository.findOne({
      where: { id },
      relations: ['work_location', 'work_location.company'],
    });

    if (!assignment) {
      throw new NotFoundException(`Atribuirea cu ID-ul ${id} nu a fost găsită`);
    }

    return assignment;
  }

  /**
   * Returnează atribuirile unei locații
   */
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

  /**
   * Actualizează o atribuire
   */
  async updateTaskTemplateAssignment(
    id: number,
    updateAssignmentDto: UpdateTaskTemplateAssignmentDto,
  ): Promise<WorkLocationTaskTemplate> {
    const assignment = await this.findTaskTemplateAssignmentById(id);

    Object.assign(assignment, updateAssignmentDto);
    return await this.taskTemplateRepository.save(assignment);
  }

  /**
   * Șterge o atribuire
   */
  async removeTaskTemplateAssignment(id: number): Promise<void> {
    const assignment = await this.findTaskTemplateAssignmentById(id);
    await this.taskTemplateRepository.remove(assignment);
  }

  /**
   * Dezactivează toate atribuirile pentru un template
   */
  async deactivateTemplateAssignments(templateId: number): Promise<void> {
    await this.taskTemplateRepository.update(
      { template_id: templateId },
      { active: false },
    );
  }

  /**
   * Activează/dezactivează o atribuire
   */
  async toggleAssignmentStatus(
    id: number,
    active: boolean,
  ): Promise<WorkLocationTaskTemplate> {
    const assignment = await this.findTaskTemplateAssignmentById(id);
    assignment.active = active;
    return await this.taskTemplateRepository.save(assignment);
  }

  /**
   * Returnează statistici despre locații
   */
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

    // Statistici pe companii
    const locations_by_company = await this.workLocationRepository
      .createQueryBuilder('location')
      .select([
        'location.company_id as company_id',
        'company.company_name as company_name',
        'COUNT(location.id) as count',
      ])
      .leftJoin('location.company', 'company')
      .groupBy('location.company_id')
      .addGroupBy('company.company_name')
      .getRawMany();

    return {
      total_locations,
      locations_by_company: locations_by_company.map((item) => ({
        company_id: item.company_id,
        company_name: item.company_name,
        count: parseInt(item.count),
      })),
      total_assignments,
      active_assignments,
    };
  }
} 