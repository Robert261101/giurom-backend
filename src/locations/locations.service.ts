import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Repository } from 'typeorm';
import { WorkLocation } from '../locations/entity/work-location.entity';
import { WorkLocationTaskTemplate } from '../locations/entity/work-location-task-template.entity';
import { WorkLocationDepartments } from '../locations/entity/work-location-departments.entity';
import { WorkLocationDepartmentPositions } from '../locations/entity/work-location-department-positions.entity';
import { CreateWorkLocationDto } from './dto/create-work-location.dto';
import { UpdateWorkLocationDto } from './dto/update-work-location.dto';
import { CreateTaskTemplateAssignmentDto } from './dto/create-task-template-assignment.dto';
import { UpdateTaskTemplateAssignmentDto } from './dto/update-task-template-assignment.dto';
import { WorkLocationRevenue } from './entity/work-location-revenue.entity';
import { WorkLocationRevenuePoints } from './entity/work-location-revenue-points.entity';
import { WorkLocationManagerConfig } from './entity/work-location-manager-config.entity';

@Injectable()
export class LocationsService {
  constructor(
    @InjectRepository(WorkLocation) private readonly workLocationRepository: Repository<WorkLocation>,
    @InjectRepository(WorkLocationTaskTemplate) private readonly taskTemplateRepository: Repository<WorkLocationTaskTemplate>,
    @InjectRepository(WorkLocationDepartments) private readonly departmentsRepository: Repository<WorkLocationDepartments>,
    @InjectRepository(WorkLocationDepartmentPositions) private readonly positionsRepository: Repository<WorkLocationDepartmentPositions>,
    @InjectRepository(WorkLocationRevenue) private readonly revenueRepository: Repository<WorkLocationRevenue>,
    @InjectRepository(WorkLocationRevenuePoints) private readonly revenuePointsRepository: Repository<WorkLocationRevenuePoints>,
    @InjectRepository(WorkLocationManagerConfig) private readonly managerConfigRepository: Repository<WorkLocationManagerConfig>,
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
      relations: ['task_templates'],
    });
    if (!workLocation)
      throw new NotFoundException(`Locația cu ID-ul ${id} nu a fost găsită`);
    return workLocation;
  }

  async findWorkLocationsByCompany(companyId: number): Promise<WorkLocation[]> {
    return await this.workLocationRepository.find({
      where: { company_id: companyId },
      relations: ['task_templates'],
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

  // --- Departments ---
  async findDepartmentsByLocation(locationId: number): Promise<WorkLocationDepartments[]> {
    // Return departments directly; do not enforce location existence to avoid 404s when data is partially seeded
    return this.departmentsRepository.find({ where: { work_location_id: locationId } as any, order: { name: 'ASC' } as any });
  }

  async createDepartment(dto: { work_location_id: number; name: string; code: string; description?: string | null }) {
    const row = this.departmentsRepository.create({
      work_location_id: dto.work_location_id,
      name: dto.name,
      code: dto.code,
      description: dto.description ?? null,
    } as Partial<WorkLocationDepartments> as WorkLocationDepartments);
    return this.departmentsRepository.save(row);
  }

  async updateDepartment(departmentId: number, dto: { name?: string; code?: string; description?: string | null }) {
    const department = await this.departmentsRepository.findOne({ where: { id: departmentId } as any });
    if (!department) {
      throw new Error('Departamentul nu a fost găsit');
    }
    
    Object.assign(department, dto);
    return this.departmentsRepository.save(department);
  }

  async deleteDepartment(departmentId: number) {
    const department = await this.departmentsRepository.findOne({ where: { id: departmentId } as any });
    if (!department) {
      throw new Error('Departamentul nu a fost găsit');
    }
    
    await this.departmentsRepository.remove(department);
    return { message: 'Departamentul a fost șters cu succes' };
  }

  async findPositionsByDepartment(departmentId: number): Promise<WorkLocationDepartmentPositions[]> {
    return this.positionsRepository.find({ where: { department_id: departmentId } as any, order: { name: 'ASC' } as any });
  }

  async createDepartmentPosition(dto: { department_id: number; name: string; code: string; description?: string | null }) {
    const row = this.positionsRepository.create({
      department_id: dto.department_id,
      name: dto.name,
      code: dto.code,
      description: dto.description ?? null,
    } as Partial<WorkLocationDepartmentPositions> as WorkLocationDepartmentPositions);
    return this.positionsRepository.save(row);
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

  // --- Revenue points management ---
  async setRevenueIntervals(workLocationId: number, intervals: Array<{ min: number; max?: number | null; points: number }>) {
    const wl = await this.findWorkLocationById(workLocationId);
    await this.revenuePointsRepository.delete({ work_location_id: workLocationId } as any);
    const rows: DeepPartial<WorkLocationRevenuePoints>[] = intervals.map(i => ({
      work_location_id: workLocationId,
      min_revenue: i.min as any,
      max_revenue: (i.max ?? null) as any,
      points: i.points as any,
    }));
    return this.revenuePointsRepository.save(rows);
  }

  async getRevenueIntervals(workLocationId: number) {
    await this.findWorkLocationById(workLocationId);
    return this.revenuePointsRepository.find({
      where: { work_location_id: workLocationId } as any,
      order: { min_revenue: 'ASC' } as any,
    });
  }

  async setManagerPercent(workLocationId: number, managerPercent: number, _fallbackRevenuePerPoint?: number) {
    let cfg = await this.managerConfigRepository.findOne({ where: { work_location_id: workLocationId } as any });
    if (!cfg) {
      cfg = this.managerConfigRepository.create({
        work_location_id: workLocationId,
        manager_percent: managerPercent as any,
      } as Partial<WorkLocationManagerConfig> as WorkLocationManagerConfig);
    } else {
      cfg.manager_percent = managerPercent as any;
    }
    return this.managerConfigRepository.save(cfg);
  }

  async getManagerConfig(workLocationId: number) {
    await this.findWorkLocationById(workLocationId);
    return this.managerConfigRepository.findOne({ where: { work_location_id: workLocationId } as any });
  }

  async recordRevenue(workLocationId: number, revenueDate: string, revenueAmount: number) {
    // Always insert a new revenue row (allow multiple entries per day)
    await this.findWorkLocationById(workLocationId);
    const row = this.revenueRepository.create({
      work_location_id: workLocationId,
      revenue_date: revenueDate,
      revenue_amount: revenueAmount as any,
    } as Partial<WorkLocationRevenue> as WorkLocationRevenue);
    return this.revenueRepository.save(row);
  }

  async listRevenue(
    workLocationId: number,
    opts?: { startDate?: string; endDate?: string; page?: number; limit?: number },
  ) {
    await this.findWorkLocationById(workLocationId);
    const page = Math.max(1, Number(opts?.page || 1));
    const limit = Math.max(1, Math.min(200, Number(opts?.limit || 50)));
    const qb = this.revenueRepository
      .createQueryBuilder('rev')
      .where('rev.location_id = :workLocationId', { workLocationId })
      .orderBy('rev.revenue_date', 'DESC');

    if (opts?.startDate) qb.andWhere('rev.revenue_date >= :startDate', { startDate: opts.startDate });
    if (opts?.endDate) qb.andWhere('rev.revenue_date <= :endDate', { endDate: opts.endDate });

    const offset = (page - 1) * limit;
    const [items, total] = await qb.skip(offset).take(limit).getManyAndCount();
    return { revenues: items, total, totalPages: Math.ceil(total / limit) };
  }

  async getManagerPointsForDate(workLocationId: number, revenueDate: string) {
    const cfg = await this.managerConfigRepository.findOne({ where: { work_location_id: workLocationId } as any });
    if (!cfg) return { totalPoints: 0, managerPoints: 0, managerPercent: 0, breakdown: [] } as any;
    const revs = await this.revenueRepository.find({ where: { work_location_id: workLocationId, revenue_date: revenueDate } as any });
    if (!revs || revs.length === 0) return { totalPoints: 0, managerPoints: 0, managerPercent: Number(cfg.manager_percent), breakdown: [] } as any;
    const intervals = await this.revenuePointsRepository.find({ where: { work_location_id: workLocationId } as any, order: { min_revenue: 'ASC' } as any });
    let totalPoints = 0;
    let totalManagerPoints = 0;
    const breakdown: Array<{ amount: number; pointsPerUnit: number; interval: { min: number; max: number | null }; points: number; managerShare: number }> = [];
    for (const rev of revs) {
      let pointsPerUnit: number | null = null;
      let matched: { min: number; max: number | null } | null = null;
      for (const intv of intervals) {
        const minOk = Number(rev.revenue_amount) >= Number(intv.min_revenue);
        const maxOk = intv.max_revenue == null ? true : Number(rev.revenue_amount) <= Number(intv.max_revenue);
        if (minOk && maxOk) { pointsPerUnit = Number(intv.points); matched = { min: Number(intv.min_revenue), max: intv.max_revenue == null ? null : Number(intv.max_revenue) }; break; }
      }
      if (!pointsPerUnit || pointsPerUnit <= 0) continue;
      // Interpret pointsPerUnit as "amount per 1 point"
      const amount = Number(rev.revenue_amount);
      const pts = amount / pointsPerUnit;
      totalPoints += pts;
      const managerPts = pts * (Number(cfg.manager_percent) / 100);
      totalManagerPoints += managerPts;
      breakdown.push({ amount, pointsPerUnit, interval: matched as any, points: pts, managerShare: managerPts });
    }
    return { totalPoints, managerPoints: totalManagerPoints, managerPercent: Number(cfg.manager_percent), breakdown } as any;
  }
} 