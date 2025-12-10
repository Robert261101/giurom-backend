import { Injectable, NotFoundException, BadRequestException, Inject, ConflictException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Repository, DataSource, In } from 'typeorm';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import * as path from 'path';
import * as fs from 'fs';
import axios from 'axios';
import { WorkLocation } from '../locations/entity/work-location.entity';
import { WorkLocationTaskTemplate } from '../locations/entity/work-location-task-template.entity';
import { WorkLocationDepartments } from '../locations/entity/work-location-departments.entity';
import { WorkLocationDepartmentPositions } from '../locations/entity/work-location-department-positions.entity';
import { CreateWorkLocationDto } from './dto/create-work-location.dto';
import { UpdateWorkLocationDto } from './dto/update-work-location.dto';
import { CreateTaskTemplateAssignmentDto } from './dto/create-task-template-assignment.dto';
import { UpdateTaskTemplateAssignmentDto } from './dto/update-task-template-assignment.dto';
import { WorkLocationRevenue, RevenueStatus } from './entity/work-location-revenue.entity';
import { WorkLocationRevenuePoints } from './entity/work-location-revenue-points.entity';
import { WorkLocationManagerConfig } from './entity/work-location-manager-config.entity';
import { WorkLocationFiles } from './entity/work-location-files.entity';
import { CreateWorkLocationFileDto } from './dto/create-work-location-file.dto';

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
    @InjectRepository(WorkLocationFiles) private readonly filesRepository: Repository<WorkLocationFiles>,
    @Inject('NOTIFICATIONS_RMQ') private readonly notificationsClient: ClientProxy,
    @Inject(DataSource) private readonly dataSource: DataSource,
  ) {}

  private getLocationsFilesRootDir(): string {
    // Resolve to giurom root (one level above giurom-backend)
    // __dirname is .../giurom-backend/locations/src (dev with ts-node) or .../giurom-backend/locations/dist (prod)
    const repoRoot = path.resolve(__dirname, '../../../..');
    return path.join(repoRoot, 'files', 'locations');
  }

  private getRepoRoot(): string {
    // Resolve repo root relative to this file location
    // __dirname is .../giurom-backend/locations/src/locations (dev with ts-node) or .../giurom-backend/locations/dist/locations (prod)
    // Pentru locations/dist/locations: ../../.. merge la repo root (giurom-backend sau giurombitap)
    // Similar cu stock care folosește ../../.. pentru că stock/dist/stock este la același nivel
    const repoRoot = path.resolve(__dirname, '../../..');
    return repoRoot;
  }

  private async sendLocationNotification(
    type: string,
    title: string,
    description: string,
    locationId: number,
    metadata?: any,
    target_url?: string
  ): Promise<void> {
    try {
      console.log(`🔍 [LOCATIONS SERVICE] Sending notification - Type: ${type}, Location ID: ${locationId}`);
      await firstValueFrom(
        this.notificationsClient.emit({ cmd: 'locations.notification' }, {
          type,
          title,
          description,
          entity_id: locationId,
          entity_type: 'location',
          metadata,
          priority: 'medium',
          target_url,
        })
      );
      console.log(`✅ [LOCATIONS SERVICE] Notification sent successfully - Type: ${type}, Location ID: ${locationId}`);
    } catch (error) {
      console.error('Failed to send location notification:', error);
    }
  }

  async createWorkLocation(dto: CreateWorkLocationDto): Promise<WorkLocation> {
    const entity: WorkLocation = this.workLocationRepository.create(
      dto as unknown as Partial<WorkLocation>,
    ) as WorkLocation;
    const saved: WorkLocation = await this.workLocationRepository.save(entity as WorkLocation);
    
    // Send notification for new location
    await this.sendLocationNotification(
      'location_created',
      'Locatie noua adaugata',
      `A fost adaugata o noua locatie: ${saved.location_name}`,
      saved.id,
      { locationName: saved.location_name },
      `/locatii/${saved.id}`
    );
    
    return saved;
  }

  async findAllWorkLocations(
    page = 1,
    limit = 10,
    companyId?: number,
    city?: string,
    search?: string,
    user?: any,
  ): Promise<{ locations: WorkLocation[]; total: number; totalPages: number }> {
    const hasLocationReadPermission = user?.permissions?.includes('locations.read');
    
    // Dacă are permisiunea locations.read, returnează toate locațiile
    if (hasLocationReadPermission) {
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

    // Dacă nu are permisiunea, returnează doar locațiile din employees_locations
    const employeeId = user?.id || user?.employee_id || user?.userId;
    if (!employeeId) {
      return { locations: [], total: 0, totalPages: 0 };
    }
    
    // Log pentru debugging - verifică ce câmpuri sunt disponibile în JWT
    console.log(`🔍 [findAllWorkLocations] Employee ID: ${employeeId}, JWT fields:`, {
      work_location_id: user?.work_location_id,
      work_location_default_id: user?.work_location_default_id,
      hasPermissions: !!user?.permissions,
    });
    
    // Obține locațiile angajatului din employees_locations
    let employeeLocationIds: number[] = [];
    try {
      const employeesUrl = process.env.EMPLOYEES_HTTP_URL || 'http://giurom.bitap.ro:3001';
      const response = await axios.get(`${employeesUrl}/employees/${employeeId}/locations`, {
        headers: {
          'x-internal-service': 'locations',
          'x-service-secret': process.env.SERVICE_SECRET || 'default-service-secret',
          'Content-Type': 'application/json',
        },
        timeout: 3000,
      });
      
      const employeeLocations = Array.isArray(response.data) ? response.data : [];
      employeeLocationIds = employeeLocations.map((el: any) => {
        return el.idLocation || el.id_location || el.locationId || el.location_id;
      }).filter((id: any) => id != null).map((id: any) => parseInt(id, 10)).filter((id: number) => !isNaN(id));
      
      // Adaugă și work_location_id sau work_location_default_id dacă există
      const workLocationId = user.work_location_id || user.work_location_default_id;
      if (workLocationId) {
        const workLocId = parseInt(String(workLocationId), 10);
        if (!isNaN(workLocId)) {
          employeeLocationIds.push(workLocId);
        }
      }
      
      // Elimină duplicatele
      employeeLocationIds = [...new Set(employeeLocationIds)];
    } catch (error: any) {
      // Nu mai logăm eroarea - avem fallback la query direct la DB
      // Dacă microserviciul employees nu este accesibil, încercăm să folosim work_location_id sau work_location_default_id din JWT
      if (error.code !== 'ECONNREFUSED' && error.code !== 'ETIMEDOUT') {
        // Logăm doar erorile care nu sunt de conexiune
        console.error(`Failed to fetch employee locations: ${error.message}`);
      }
      const workLocationId = user.work_location_id || user.work_location_default_id;
      if (workLocationId) {
        const workLocId = parseInt(String(workLocationId), 10);
        if (!isNaN(workLocId)) {
          employeeLocationIds = [workLocId];
          console.warn(`⚠️ Employees microservice not accessible, using work_location_id from JWT: ${workLocId}`);
        }
      }
      
      if (employeeLocationIds.length === 0) {
        // Dacă nici work_location_id nu există, încercăm să interogăm direct baza de date employees_locations
        // NOTĂ: Aceasta presupune că ambele microservicii folosesc aceeași bază de date sau că locations poate accesa employees DB
        try {
          // Încearcă să interogeze tabelul employees_locations din baza de date employees
          // Folosim numele complet al bazei de date în query
          const employeesDbName = process.env.EMPLOYEES_DB_NAME || 'giurombitap_employees';
          const result = await this.dataSource.query(
            `SELECT id_location FROM ${employeesDbName}.employees_locations WHERE employee_id = ?`,
            [employeeId]
          );
          if (result && result.length > 0) {
            employeeLocationIds = result.map((row: any) => row.id_location || row.idLocation)
              .filter((id: any) => id != null)
              .map((id: any) => parseInt(id, 10))
              .filter((id: number) => !isNaN(id));
            console.log(`✅ Found ${employeeLocationIds.length} locations in employees_locations via direct DB query (employee ${employeeId}): [${employeeLocationIds.join(', ')}]`);
          } else {
            console.warn(`⚠️ No locations found in employees_locations for employee ${employeeId}`);
            return { locations: [], total: 0, totalPages: 0 };
          }
        } catch (dbError: any) {
          // Dacă tabelul nu există în această bază de date, înseamnă că este în altă bază de date
          // SOLUȚIE TEMPORARĂ: Permitem accesul la toate locațiile pentru utilizatorii autentificați
          // când microserviciul employees nu este accesibil
          // NOTĂ: Aceasta este o soluție temporară - în producție, microserviciul employees trebuie să fie accesibil
          console.error(`❌ Failed to query employees_locations directly: ${dbError.message}`);
          console.warn(`⚠️ Cannot access employees_locations - allowing access to all locations for authenticated user (temporary solution)`);
          
          // Returnăm toate locațiile (fără filtrare) când microserviciul employees nu este accesibil
          // Aceasta este o soluție temporară până când microserviciul employees devine accesibil
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
      }
    }
    
    if (employeeLocationIds.length === 0) {
      return { locations: [], total: 0, totalPages: 0 };
    }
    
    // Filtrează locațiile după ID-urile din employees_locations
    const qb = this.workLocationRepository
      .createQueryBuilder('location')
      .leftJoinAndSelect('location.task_templates', 'task_templates')
      .where('location.id IN (:...locationIds)', { locationIds: employeeLocationIds });
    
    if (companyId) qb.andWhere('location.company_id = :companyId', { companyId });
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

  // Obține companiile asociate cu locațiile angajatului
  async getEmployeeCompanies(user?: any): Promise<Array<{ id: number; company_name: string }>> {
    const employeeId = user?.id || user?.employee_id || user?.userId;
    if (!employeeId) {
      return [];
    }

    // Obține locațiile angajatului
    let employeeLocationIds: number[] = [];
    try {
      const employeesUrl = process.env.EMPLOYEES_HTTP_URL || 'http://giurom.bitap.ro:3001';
      const response = await axios.get(`${employeesUrl}/employees/${employeeId}/locations`, {
        headers: {
          'x-internal-service': 'locations',
          'x-service-secret': process.env.SERVICE_SECRET || 'default-service-secret',
          'Content-Type': 'application/json',
        },
        timeout: 3000,
      });
      
      const employeeLocations = Array.isArray(response.data) ? response.data : [];
      employeeLocationIds = employeeLocations.map((el: any) => {
        return el.idLocation || el.id_location || el.locationId || el.location_id;
      }).filter((id: any) => id != null).map((id: any) => parseInt(id, 10)).filter((id: number) => !isNaN(id));
      
      const workLocationId = user.work_location_id || user.work_location_default_id;
      if (workLocationId) {
        const workLocId = parseInt(String(workLocationId), 10);
        if (!isNaN(workLocId)) {
          employeeLocationIds.push(workLocId);
        }
      }
      
      employeeLocationIds = [...new Set(employeeLocationIds)];
    } catch (error: any) {
      // Fallback la query direct la DB
      const workLocationId = user.work_location_id || user.work_location_default_id;
      if (workLocationId) {
        employeeLocationIds = [workLocationId];
      } else {
        try {
          const employeesDbName = process.env.EMPLOYEES_DB_NAME || 'giurombitap_employees';
          const result = await this.dataSource.query(
            `SELECT id_location FROM ${employeesDbName}.employees_locations WHERE employee_id = ?`,
            [employeeId]
          );
          if (result && result.length > 0) {
            employeeLocationIds = result.map((row: any) => row.id_location || row.idLocation)
              .filter((id: any) => id != null)
              .map((id: any) => parseInt(id, 10))
              .filter((id: number) => !isNaN(id));
          }
        } catch (dbError: any) {
          // Dacă nu putem obține locațiile, returnăm lista goală
          return [];
        }
      }
    }

    if (employeeLocationIds.length === 0) {
      return [];
    }

    // Obține company_id-urile din locații
    const locations = await this.workLocationRepository.find({
      where: { id: In(employeeLocationIds) },
      select: ['id', 'company_id'],
    });

    const companyIds = [...new Set(locations.map(loc => loc.company_id).filter(id => id != null))];
    
    if (companyIds.length === 0) {
      return [];
    }

    // Obține numele companiilor din companies microservice
    const companies: Array<{ id: number; company_name: string }> = [];
    const companiesUrl = process.env.COMPANIES_HTTP_URL || 'http://giurom.bitap.ro:3003';
    const serviceSecret = process.env.SERVICE_SECRET || 'default-service-secret';
    
    for (const companyId of companyIds) {
      try {
        const requestHeaders = {
          'x-internal-service': 'locations',
          'x-service-secret': serviceSecret,
          'Content-Type': 'application/json',
        };
        console.log(`🔍 [getEmployeeCompanies] Requesting company ${companyId} from ${companiesUrl}/companies/${companyId} with headers:`, requestHeaders);
        const response = await axios.get(`${companiesUrl}/companies/${companyId}`, {
          headers: requestHeaders,
          timeout: 3000,
        });
        
        if (response.data && response.data.company_name) {
          companies.push({
            id: companyId,
            company_name: response.data.company_name,
          });
        }
      } catch (error: any) {
        // Dacă nu putem obține numele companiei, continuăm cu următoarea
        console.warn(`⚠️ Nu am putut obține numele companiei ${companyId}: ${error.message}`);
      }
    }

    return companies;
  }

  async findWorkLocationById(id: number, user?: any): Promise<WorkLocation> {
    const workLocation = await this.workLocationRepository.findOne({
      where: { id },
      relations: ['task_templates'],
    });
    if (!workLocation)
      throw new NotFoundException(`Locația cu ID-ul ${id} nu a fost găsită`);
    
    // Dacă utilizatorul nu are permisiunea locations.read, verifică dacă locația este în lista sa
    const hasLocationReadPermission = user?.permissions?.includes('locations.read');
    if (!hasLocationReadPermission && user) {
      const employeeId = user.id || user.employee_id || user.userId;
      const userWorkLocationId = user.work_location_id;
      
      // Verificare 1: Dacă work_location_id se potrivește
      if (userWorkLocationId && userWorkLocationId === id) {
        return workLocation;
      }
      
      // Verificare 2: Verifică în employees_locations
      if (employeeId) {
        try {
          const employeesUrl = process.env.EMPLOYEES_HTTP_URL || 'http://giurom.bitap.ro:3001';
          const response = await axios.get(`${employeesUrl}/employees/${employeeId}/locations`, {
            headers: {
              'x-internal-service': 'locations',
              'x-service-secret': process.env.SERVICE_SECRET || 'default-service-secret',
              'Content-Type': 'application/json',
            },
            timeout: 3000,
          });
          
          const employeeLocations = Array.isArray(response.data) ? response.data : [];
          const hasAccess = employeeLocations.some((el: any) => {
            const elLocationId = el.idLocation || el.id_location || el.locationId || el.location_id;
            return elLocationId === id || String(elLocationId) === String(id);
          });
          
          if (hasAccess) {
            return workLocation;
          }
        } catch (error: any) {
          // Dacă microserviciul nu este accesibil, încercăm query direct la baza de date
          if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
            try {
              // Verifică work_location_id sau work_location_default_id din JWT
              const workLocationId = user.work_location_id || user.work_location_default_id;
              if (workLocationId && workLocationId === id) {
                return workLocation;
              }
              
              // Încearcă query direct la baza de date employees
              const employeesDbName = process.env.EMPLOYEES_DB_NAME || 'giurombitap_employees';
              const result = await this.dataSource.query(
                `SELECT id_location FROM ${employeesDbName}.employees_locations WHERE employee_id = ? AND id_location = ?`,
                [employeeId, id]
              );
              
              if (result && result.length > 0) {
                console.log(`✅ Found location ${id} in employees_locations via direct DB query for employee ${employeeId}`);
                return workLocation;
              }
              
              // Dacă nu găsește, aruncă eroare de permisiuni
              throw new ForbiddenException('Nu ai acces la această locație');
            } catch (dbError: any) {
              console.error(`❌ Failed to query employees_locations directly: ${dbError.message}`);
              // Dacă query-ul direct eșuează, verifică doar work_location_id
              const workLocationId = user.work_location_id || user.work_location_default_id;
              if (workLocationId && workLocationId === id) {
                return workLocation;
              }
              throw new ForbiddenException('Nu ai acces la această locație');
            }
          }
        }
      }
      
      // Dacă nu are acces, aruncă eroare
      throw new ForbiddenException('Nu ai acces la această locație');
    }
    
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
    const oldName = workLocation.location_name;
    Object.assign(workLocation, dto);
    const updatedLocation = await this.workLocationRepository.save(workLocation as WorkLocation);
    
    // Send notification for updated location
    await this.sendLocationNotification(
      'location_updated',
      'Locatie modificata',
      `Locatia ${oldName} a fost modificata`,
      updatedLocation.id,
      { 
        oldName,
        newName: updatedLocation.location_name,
        updatedFields: Object.keys(dto)
      },
      `/locatii/${updatedLocation.id}`
    );
    
    return updatedLocation;
  }

  async removeWorkLocation(id: number): Promise<void> {
    const workLocation = await this.findWorkLocationById(id);
    const locationName = workLocation.location_name;
    
    // Get related departments count
    const departmentsCount = await this.departmentsRepository.count({ 
      where: { work_location_id: id } as any 
    });
    
    // Get related revenue points count
    const revenuePointsCount = await this.revenuePointsRepository.count({ 
      where: { work_location_id: id } as any 
    });
    
    // Send notification for deleted location
    await this.sendLocationNotification(
      'location_deleted',
      'Locatie stearsa',
      `Locatia ${locationName} a fost stearsa (Departamente: ${departmentsCount}, Puncte: ${revenuePointsCount}, Angajati afectati)`,
      id,
      { 
        locationName,
        departmentsCount,
        revenuePointsCount
      },
      `/locatii/${id}`  // Add target_url
    );
    
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

  async recordRevenue(workLocationId: number, revenueDate: string, onlineAmount: number, cashAmount: number, cardAmount: number, totalAmount: number, status?: RevenueStatus, imageUrl?: string, userId?: number | null) {
    // Always insert a new revenue row (allow multiple entries per day)
    await this.findWorkLocationById(workLocationId);
    
    // Validare STRICTĂ: employee_id este OBLIGATORIU și trebuie să fie un număr valid
    if (!userId || userId === 0 || isNaN(Number(userId))) {
      console.error('❌ [recordRevenue Service] Invalid employee_id:', userId);
      throw new Error('Employee ID is required and must be a valid number');
    }
    
    const employeeId = Number(userId);
    
    // Log pentru debugging
    console.log('🔍 [recordRevenue Service] Saving revenue with:', {
      workLocationId,
      revenueDate,
      employeeId,
      userId: employeeId
    });
    
    const row = this.revenueRepository.create({
      work_location_id: workLocationId,
      revenue_date: revenueDate,
      online_amount: onlineAmount as any,
      cash_amount: cashAmount as any,
      card_amount: cardAmount as any,
      total_amount: totalAmount as any,
      status: status,
      image_url: imageUrl,
      employee_id: employeeId, // OBLIGATORIU - nu poate fi null sau undefined
    } as Partial<WorkLocationRevenue> as WorkLocationRevenue);
    
    const saved = await this.revenueRepository.save(row);
    console.log('✅ [recordRevenue Service] Revenue saved successfully with employee_id:', saved.employee_id);
    return saved;
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
    
    // Obține employee_id pentru fiecare revenue cu user_id
    // Trebuie să obținem id_employee din users bazat pe user_id
    const authDbName = process.env.AUTH_DB_NAME || 'giurombitap_auth';
    const employeesDbName = process.env.EMPLOYEES_DB_NAME || 'giurombitap_employees';
    
    const revenuesWithEmployeeId = await Promise.all(items.map(async (rev: any) => {
      if (!rev.employee_id) {
        return { ...rev, employee_id: null, employee_first_name: null, employee_last_name: null };
      }
      
      try {
        // Obține first_name și last_name direct din employees folosind employee_id
          const employeeResult = await this.dataSource.query(
            `SELECT first_name, last_name FROM ${employeesDbName}.employees WHERE id = ?`,
          [rev.employee_id]
          );
          
          if (employeeResult && employeeResult.length > 0) {
            return {
              ...rev,
            employee_id: Number(rev.employee_id),
              employee_first_name: employeeResult[0].first_name || null,
              employee_last_name: employeeResult[0].last_name || null,
            };
          }
          
        return { ...rev, employee_id: Number(rev.employee_id), employee_first_name: null, employee_last_name: null };
      } catch (error: any) {
        console.error(`❌ Error fetching employee data for employee_id ${rev.employee_id}:`, error.message);
        return { ...rev, employee_id: Number(rev.employee_id), employee_first_name: null, employee_last_name: null };
      }
    }));
    
    return { revenues: revenuesWithEmployeeId, total, totalPages: Math.ceil(total / limit) };
  }

  async deleteRevenue(revenueId: number): Promise<void> {
    const revenue = await this.revenueRepository.findOne({ where: { id: revenueId } as any });
    if (!revenue) throw new NotFoundException(`Încasarea cu ID-ul ${revenueId} nu a fost găsită`);
    await this.revenueRepository.remove(revenue as WorkLocationRevenue);
  }

  async updateRevenue(revenueId: number, data: { revenue_date?: string; online_amount?: number; cash_amount?: number; card_amount?: number; total_amount?: number; status?: RevenueStatus; image_url?: string }): Promise<WorkLocationRevenue> {
    const revenue = await this.revenueRepository.findOne({ where: { id: revenueId } as any });
    if (!revenue) throw new NotFoundException(`Încasarea cu ID-ul ${revenueId} nu a fost găsită`);
    
    // Track if status is changing to approved (trigger for bonus calculation)
    const wasApproved = revenue.status === RevenueStatus.Approved;
    const becomingApproved = data.status === RevenueStatus.Approved;
    const shouldCalculateBonuses = becomingApproved && !wasApproved;
    // Use revenue_date from the revenue record (date when revenue was created), not approval date
    const revenueDateRaw = data.revenue_date || revenue.revenue_date;
    // Normalize date: extract only YYYY-MM-DD part (remove time if present)
    const revenueDate = revenueDateRaw ? revenueDateRaw.toString().split(' ')[0].split('T')[0] : null;
    
    if (data.revenue_date) revenue.revenue_date = data.revenue_date;
    if (data.online_amount !== undefined) revenue.online_amount = data.online_amount as any;
    if (data.cash_amount !== undefined) revenue.cash_amount = data.cash_amount as any;
    if (data.card_amount !== undefined) revenue.card_amount = data.card_amount as any;
    if (data.total_amount !== undefined) revenue.total_amount = data.total_amount as any;
    if (data.status !== undefined) revenue.status = data.status;
    if (data.image_url !== undefined) revenue.image_url = data.image_url;
    
    const savedRevenue = await this.revenueRepository.save(revenue as WorkLocationRevenue);
    
    // Trigger bonus calculation when revenue becomes approved
    // IMPORTANT: Calculate bonuses based on revenue_date (date when revenue was created), 
    // NOT the approval date. If revenue is approved tomorrow, bonuses are still calculated for revenue_date.
    if (shouldCalculateBonuses && revenueDate) {
      console.log(`🔔 [BONUS TRIGGER] Revenue ${revenueId} approved. Calculating bonuses for revenue_date: ${revenueDate} (date of revenue, not approval date)`);
      // Calculate bonuses asynchronously (don't block the response)
      this.calculateEmployeeBonusesForDate(revenue.work_location_id, revenueDate).catch(err => {
        console.error(`❌ [BONUS TRIGGER] Error calculating bonuses for revenue ${revenueId}:`, err);
      });
    }
    
    return savedRevenue;
  }

  // Calculate bonuses for all employees in a location for a specific date based on approved revenues
  // IMPORTANT: revenueDate is the date when revenue was created (revenue_date), not the approval date
  private async calculateEmployeeBonusesForDate(locationId: number, revenueDate: string): Promise<void> {
    try {
      // Normalize date to YYYY-MM-DD format for consistent querying
      const normalizedDate = revenueDate.toString().split(' ')[0].split('T')[0];
      console.log(`🔍 [BONUS CALC] Starting bonus calculation for location ${locationId}, revenue_date: ${normalizedDate}`);
      
      // Get all approved revenues for this revenue_date (date when revenue was created)
      // Query uses LIKE to match dates that start with normalizedDate (handles datetime format)
      const approvedRevenues = await this.revenueRepository
        .createQueryBuilder('revenue')
        .where('revenue.work_location_id = :locationId', { locationId })
        .andWhere('DATE(revenue.revenue_date) = :revenueDate', { revenueDate: normalizedDate })
        .andWhere('revenue.status = :status', { status: RevenueStatus.Approved })
        .getMany();
      
      if (!approvedRevenues || approvedRevenues.length === 0) {
        console.log(`⚠️ [BONUS CALC] No approved revenues found for location ${locationId}, date ${revenueDate}`);
        return;
      }
      
      // Get revenue intervals for this location
      const intervals = await this.revenuePointsRepository.find({
        where: { work_location_id: locationId } as any,
        order: { min_revenue: 'ASC' } as any
      });
      
      // Get manager config (fallback_revenue_per_point was removed from entity, use 0 as default)
      const managerCfg = await this.managerConfigRepository.findOne({
        where: { work_location_id: locationId } as any
      });
      // fallback_revenue_per_point is no longer in the entity, use 0 as default fallback
      const fallback = 0;
      
      // Get all employees from this location
      const employeesUrl = process.env.EMPLOYEES_HTTP_URL || 'http://giurom.bitap.ro:3001';
      let employees: any[] = [];
      try {
        const response = await axios.get(`${employeesUrl}/locations/${locationId}/employees`, {
          headers: { 'Content-Type': 'application/json' }
        });
        employees = Array.isArray(response.data) ? response.data : Array.isArray(response.data?.data) ? response.data.data : [];
        console.log(`👥 [BONUS CALC] Found ${employees.length} employees in location ${locationId}`);
      } catch (error) {
        console.error(`❌ [BONUS CALC] Failed to fetch employees for location ${locationId}:`, error);
        return;
      }
      
      // Helper function to find multiplier for a revenue amount
      const pickMultiplier = (totalAmount: number): number => {
        for (const intv of intervals) {
          const minOk = totalAmount >= Number(intv.min_revenue);
          const maxOk = intv.max_revenue == null ? true : totalAmount <= Number(intv.max_revenue);
          if (minOk && maxOk) {
            // Use 'points' property from WorkLocationRevenuePoints entity
            return Number(intv.points);
          }
        }
        return fallback;
      };
      
      // For each employee, calculate bonus based on their daily points and approved revenues
      const tasksApiUrl = process.env.TASKS_API_BASE || 'http://giurom.bitap.ro:3008';
      const workDate = new Date(revenueDate);
      workDate.setHours(0, 0, 0, 0);
      
      for (const employee of employees) {
        try {
          const employeeId = Number(employee.id || employee.employee_id);
          if (!employeeId) continue;
          
          // Get employee daily points for this revenue_date (date when revenue was created, not approval date)
          let employeePoints = 0;
          try {
            const pointsUrl = `${tasksApiUrl}/executions/daily-points/${employeeId}/${normalizedDate}`;
            const pointsResponse = await axios.get(pointsUrl, {
              headers: { 'Content-Type': 'application/json' }
            });
            const pointsData = pointsResponse.data;
            employeePoints = Number(pointsData?.total_points || pointsData?.data?.total_points || 0);
          } catch (error) {
            console.log(`⚠️ [BONUS CALC] Could not fetch points for employee ${employeeId}, revenue_date: ${normalizedDate}`);
            // Try alternative endpoint
            try {
              const rangeUrl = `${tasksApiUrl}/executions/employee-points/${employeeId}?startDate=${normalizedDate}&endDate=${normalizedDate}`;
              const rangeResponse = await axios.get(rangeUrl, {
                headers: { 'Content-Type': 'application/json' }
              });
              const rangeData = Array.isArray(rangeResponse.data) ? rangeResponse.data : Array.isArray(rangeResponse.data?.data) ? rangeResponse.data.data : [];
              if (rangeData.length > 0) {
                employeePoints = Number(rangeData[0]?.total_points || rangeData[0]?.points || 0);
              }
            } catch (rangeError) {
              console.log(`⚠️ [BONUS CALC] Could not fetch points from range endpoint for employee ${employeeId}, revenue_date: ${normalizedDate}`);
            }
          }
          
          if (employeePoints <= 0) {
            console.log(`⚠️ [BONUS CALC] Employee ${employeeId} has no points for revenue_date: ${normalizedDate}, skipping`);
            continue;
          }
          
          // Calculate bonus for each approved revenue individually
          let totalBonus = 0;
          for (const revenue of approvedRevenues) {
            const totalAmount = Number(revenue.total_amount);
            const multiplier = pickMultiplier(totalAmount);
            const bonusForThisRevenue = employeePoints * multiplier;
            totalBonus += bonusForThisRevenue;
            
            console.log(`💰 [BONUS CALC] Employee ${employeeId}: ${employeePoints} points × ${multiplier} (revenue ${totalAmount}) = ${bonusForThisRevenue.toFixed(2)} RON`);
          }
          
          console.log(`✅ [BONUS CALC] Employee ${employeeId} total bonus for revenue_date ${normalizedDate}: ${totalBonus.toFixed(2)} RON`);
          
          // Note: The bonus is calculated but not stored in a separate table
          // It will be calculated on-the-fly when requested via the /api/employees/[id]/money endpoint
          
        } catch (employeeError) {
          console.error(`❌ [BONUS CALC] Error processing employee ${employee.id}:`, employeeError);
        }
      }
      
      console.log(`✅ [BONUS CALC] Finished bonus calculation for location ${locationId}, revenue_date: ${normalizedDate}`);
    } catch (error) {
      console.error(`❌ [BONUS CALC] Error in calculateEmployeeBonusesForDate:`, error);
    }
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
        const minOk = Number(rev.total_amount) >= Number(intv.min_revenue);
        const maxOk = intv.max_revenue == null ? true : Number(rev.total_amount) <= Number(intv.max_revenue);
        if (minOk && maxOk) { pointsPerUnit = Number(intv.points); matched = { min: Number(intv.min_revenue), max: intv.max_revenue == null ? null : Number(intv.max_revenue) }; break; }
      }
      if (!pointsPerUnit || pointsPerUnit <= 0) continue;
      // Interpret pointsPerUnit as "amount per 1 point"
      const amount = Number(rev.total_amount);
      const pts = amount / pointsPerUnit;
      totalPoints += pts;
      const managerPts = pts * (Number(cfg.manager_percent) / 100);
      totalManagerPoints += managerPts;
      breakdown.push({ amount, pointsPerUnit, interval: matched as any, points: pts, managerShare: managerPts });
    }
    return { totalPoints, managerPoints: totalManagerPoints, managerPercent: Number(cfg.manager_percent), breakdown } as any;
  }

  // ==================== LOCATION FILES METHODS ====================

  // Creează un nou fișier pentru locație
  async createFile(createFileDto: CreateWorkLocationFileDto & { expire_date?: string }): Promise<WorkLocationFiles> {
    console.log('📥 Received createFileDto:', {
      work_location_id: createFileDto.work_location_id,
      file_name: createFileDto.file_name,
      file_type: createFileDto.file_type,
      has_content: !!createFileDto.file_content,
      content_length: createFileDto.file_content?.length || 0
    });
    
    // Verifică dacă locația există
    const location = await this.workLocationRepository.findOne({
      where: { id: createFileDto.work_location_id }
    });

    if (!location) {
      throw new NotFoundException(`Locația cu ID-ul ${createFileDto.work_location_id} nu a fost găsită`);
    }

    // Generate unique filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const fileExtension = createFileDto.file_name.split('.').pop() || 'txt';
    const baseFileName = createFileDto.file_name.replace(/\.[^/.]+$/, "") || 'file';
    const uniqueFileName = `${baseFileName}_${timestamp}.${fileExtension}`;

    console.log(`📝 Original: ${createFileDto.file_name}, Generated: ${uniqueFileName}`);

    // Update the file_link to use the unique filename
    const updatedFileLink = createFileDto.file_link.replace(createFileDto.file_name, uniqueFileName);

    // Create the directory if it doesn't exist
    const locationId = createFileDto.work_location_id?.toString() || 'unknown';
    console.log(`📁 Creating directory for location ID: ${locationId}`);
    const baseDir = this.getLocationsFilesRootDir();
    const fileDir = path.join(baseDir, locationId);
    if (!fs.existsSync(fileDir)) {
      fs.mkdirSync(fileDir, { recursive: true });
    }

    // If file content is provided (base64), save it to disk
    if (createFileDto.file_content) {
      try {
        const filePath = path.join(fileDir, uniqueFileName);
        
        // Extract base64 content from data URL (remove data:type;base64, prefix)
        let base64Data = createFileDto.file_content;
        if (base64Data.includes(',')) {
          base64Data = base64Data.split(',')[1];
        }
        
        console.log(`💾 Saving file with ${base64Data.length} base64 characters`);
        const buffer = Buffer.from(base64Data, 'base64');
        fs.writeFileSync(filePath, buffer);
        console.log(`✅ File saved to disk: ${filePath} (${buffer.length} bytes)`);
      } catch (error) {
        console.error('❌ Error saving file to disk:', error);
      }
    }

    // Verifică dacă există deja un fișier cu același nume pentru aceeași locație
    const existingFile = await this.filesRepository.findOne({
      where: {
        work_location_id: createFileDto.work_location_id,
        file_name: uniqueFileName
      }
    });

    if (existingFile) {
      throw new ConflictException(`Un fișier cu numele "${uniqueFileName}" există deja pentru această locație`);
    }

    // Create the file record with unique filename
    const file = this.filesRepository.create({
      ...createFileDto,
      file_name: uniqueFileName,
      file_link: updatedFileLink,
      expire_date: createFileDto.expire_date ? new Date(createFileDto.expire_date) : null
    });

    const savedFile = await this.filesRepository.save(file);
    console.log(`✅ File record saved to database with ID: ${savedFile.id}`);
    
    return savedFile;
  }

  // Găsește un fișier după ID
  async findOneFile(id: number): Promise<WorkLocationFiles> {
    const file = await this.filesRepository.findOne({
      where: { id },
      relations: ['workLocation'],
    });

    if (!file) {
      throw new NotFoundException(`Fișierul cu ID-ul ${id} nu a fost găsit`);
    }

    return file;
  }

  // Găsește toate fișierele unei locații
  async findFilesByLocation(work_location_id: number): Promise<WorkLocationFiles[]> {
    const location = await this.workLocationRepository.findOne({
      where: { id: work_location_id }
    });

    if (!location) {
      throw new NotFoundException(`Locația cu ID-ul ${work_location_id} nu a fost găsită`);
    }

    return await this.filesRepository.find({
      where: { work_location_id },
      relations: ['workLocation'],
      order: { updated_at: 'DESC' },
    });
  }

  // Servește fișierul de pe disk
  async serveFile(file_id: number, forceDownload: boolean = false): Promise<{ data: string; mimeType: string; fileName: string; disposition: 'inline' | 'attachment' }> {
    try {
      console.log(`🔍 [serveFile] Starting to serve file with ID: ${file_id}, forceDownload: ${forceDownload}`);
      
      const file = await this.findOneFile(file_id);
      console.log(`📄 [serveFile] File metadata retrieved:`, {
        id: file.id,
        name: file.file_name,
        work_location_id: file.work_location_id,
        file_link: file.file_link
      });
      
      const baseDir = this.getLocationsFilesRootDir();
      console.log(`📁 [serveFile] Base directory: ${baseDir}`);
      
      const filePath = path.join(baseDir, file.work_location_id.toString(), file.file_name);
      console.log(`📁 [serveFile] Full file path: ${filePath}`);
      console.log(`📁 [serveFile] Path exists check: ${fs.existsSync(filePath)}`);
      
      // Check if directory exists
      const fileDir = path.join(baseDir, file.work_location_id.toString());
      console.log(`📁 [serveFile] Directory path: ${fileDir}`);
      console.log(`📁 [serveFile] Directory exists: ${fs.existsSync(fileDir)}`);
      
      if (fs.existsSync(fileDir)) {
        const filesInDir = fs.readdirSync(fileDir);
        console.log(`📁 [serveFile] Files in directory:`, filesInDir);
      }
      
      if (!fs.existsSync(filePath)) {
        console.error(`❌ [serveFile] File not found on disk: ${filePath}`);
        throw new NotFoundException(`Fișierul nu a fost găsit pe disk la calea: ${filePath}`);
      }
      
      const mimeType = this.getMimeType(file.file_name);
      console.log(`📋 [serveFile] MIME type determined: ${mimeType}`);
      
      const fileBuffer = fs.readFileSync(filePath);
      console.log(`✅ [serveFile] File read successfully: ${file.file_name} (${fileBuffer.length} bytes)`);

      return {
        data: fileBuffer.toString('base64'),
        mimeType,
        fileName: file.file_name,
        disposition: forceDownload ? 'attachment' : 'inline',
      };
    } catch (error) {
      console.error(`❌ [serveFile] Error serving file ${file_id}:`, error);
      console.error(`❌ [serveFile] Error message:`, error.message);
      console.error(`❌ [serveFile] Error stack:`, error.stack);
      throw error;
    }
  }

  // Determină tipul MIME bazat pe extensia fișierului
  private getMimeType(fileName: string): string {
    const extension = fileName.split('.').pop()?.toLowerCase();
    
    const mimeTypes: { [key: string]: string } = {
      'pdf': 'application/pdf',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'txt': 'text/plain',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'xls': 'application/vnd.ms-excel',
    };
    
    return mimeTypes[extension || ''] || 'application/octet-stream';
  }

  // Șterge un fișier
  async removeFile(id: number): Promise<{ message: string }> {
    const file = await this.findOneFile(id);
    await this.filesRepository.delete(id);
    
    return {
      message: `Fișierul "${file.file_name}" al locației ${file.workLocation.location_name} a fost șters cu succes`,
    };
  }

  // Find files expiring on a specific date
  async findExpiringFiles(targetDate: string): Promise<WorkLocationFiles[]> {
    console.log(`[LOCATIONS SERVICE] Finding files expiring on ${targetDate}`);
    // Format the date to match the database format (YYYY-MM-DD)
    const formattedDate = new Date(targetDate);
    formattedDate.setHours(0, 0, 0, 0);
    
    const files = await this.filesRepository
      .createQueryBuilder('file')
      .where('DATE(file.expire_date) = :targetDate', { targetDate })
      .leftJoinAndSelect('file.workLocation', 'location')
      .getMany();
    
    console.log(`[LOCATIONS SERVICE] Found ${files.length} files expiring on ${targetDate}`);
    return files;
  }

  // Find files that have already expired
  async findExpiredFiles(): Promise<WorkLocationFiles[]> {
    console.log(`[LOCATIONS SERVICE] Finding expired files`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const files = await this.filesRepository
      .createQueryBuilder('file')
      .where('file.expire_date < :today', { today })
      .andWhere('file.expire_date IS NOT NULL')
      .leftJoinAndSelect('file.workLocation', 'location')
      .getMany();
    
    console.log(`[LOCATIONS SERVICE] Found ${files.length} expired files`);
    return files;
  }

  /**
   * Upload imagine cashing - salvează pe server în images/cashing
   */
  async uploadCashingImage(fileName: string, base64Content: string): Promise<string> {
    try {
      // Extract base64 content from data URL (remove data:type;base64, prefix)
      let base64Data = base64Content;
      if (base64Data.includes(',')) {
        base64Data = base64Data.split(',')[1];
      }

      // Generate unique filename with timestamp
      const timestamp = Date.now();
      const fileExtension = fileName.split('.').pop() || 'jpg';
      const baseFileName = fileName.replace(/\.[^/.]+$/, '') || 'image';
      const uniqueFileName = `${timestamp}_${baseFileName}.${fileExtension}`;

      // Save to images/cashing directory on server
      const repoRoot = this.getRepoRoot();
      const imagesDir = path.join(repoRoot, 'images');
      const cashingDir = path.join(imagesDir, 'cashing');
      
      // Create images/cashing directory if it doesn't exist
      if (!fs.existsSync(cashingDir)) {
        fs.mkdirSync(cashingDir, { recursive: true });
        console.log(`📁 Created images/cashing directory: ${cashingDir}`);
        console.log(`📁 Repo root: ${repoRoot}`);
        console.log(`📁 Images dir: ${imagesDir}`);
      }

      const filePath = path.join(cashingDir, uniqueFileName);
      const buffer = Buffer.from(base64Data, 'base64');
      
      fs.writeFileSync(filePath, buffer);
      console.log(`✅ Cashing image saved: ${filePath} (${buffer.length} bytes)`);
      console.log(`✅ File exists check: ${fs.existsSync(filePath)}`);

      // Return the URL path (with cashing subfolder)
      return `/api/images/cashing/${uniqueFileName}`;
    } catch (error: any) {
      console.error(`❌ Error uploading cashing image: ${error}`);
      throw new BadRequestException(`Eroare la salvarea imaginii: ${error?.message || 'Unknown error'}`);
    }
  }

  /**
   * Servește imaginea unui cashing
   */
  async serveCashingImage(fileName: string): Promise<{ buffer: Buffer; mimeType: string }> {
    try {
      const repoRoot = this.getRepoRoot();
      const imagesDir = path.join(repoRoot, 'images', 'cashing');
      const filePath = path.join(imagesDir, fileName);

      if (!fs.existsSync(filePath)) {
        throw new NotFoundException(`Imaginea ${fileName} nu a fost găsită`);
      }

      const buffer = fs.readFileSync(filePath);
      
      // Determină tipul MIME
      const extension = fileName.split('.').pop()?.toLowerCase() || 'jpg';
      let mimeType = 'image/jpeg';
      
      switch (extension) {
        case 'png':
          mimeType = 'image/png';
          break;
        case 'gif':
          mimeType = 'image/gif';
          break;
        case 'webp':
          mimeType = 'image/webp';
          break;
        case 'svg':
          mimeType = 'image/svg+xml';
          break;
        case 'jfif':
          mimeType = 'image/jpeg';
          break;
      }

      return { buffer, mimeType };
    } catch (error: any) {
      console.error(`❌ Error serving cashing image: ${error}`);
      throw error;
    }
  }

  /**
   * Șterge imaginea unui cashing de pe server
   */
  async deleteCashingImage(imageUrl: string): Promise<void> {
    try {
      // Extrage numele fișierului din URL
      // URL-ul este de forma: /api/images/cashing/{fileName}
      const urlParts = imageUrl.split('/');
      const fileName = urlParts[urlParts.length - 1];
      
      if (!fileName) {
        throw new BadRequestException('URL-ul imaginii nu este valid');
      }

      const repoRoot = this.getRepoRoot();
      const imagesDir = path.join(repoRoot, 'images', 'cashing');
      const filePath = path.join(imagesDir, fileName);

      if (!fs.existsSync(filePath)) {
        console.warn(`⚠️ Cashing image not found for deletion: ${filePath}`);
        // Nu aruncăm eroare dacă fișierul nu există, doar logăm
        return;
      }

      fs.unlinkSync(filePath);
      console.log(`✅ Cashing image deleted: ${filePath}`);
    } catch (error: any) {
      console.error(`❌ Error deleting cashing image: ${error}`);
      throw new BadRequestException(`Eroare la ștergerea imaginii: ${error?.message || 'Unknown error'}`);
    }
  }
} 