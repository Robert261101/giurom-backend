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
export declare class LocationsService {
    private readonly workLocationRepository;
    private readonly taskTemplateRepository;
    private readonly departmentsRepository;
    private readonly positionsRepository;
    private readonly revenueRepository;
    private readonly revenuePointsRepository;
    private readonly managerConfigRepository;
    constructor(workLocationRepository: Repository<WorkLocation>, taskTemplateRepository: Repository<WorkLocationTaskTemplate>, departmentsRepository: Repository<WorkLocationDepartments>, positionsRepository: Repository<WorkLocationDepartmentPositions>, revenueRepository: Repository<WorkLocationRevenue>, revenuePointsRepository: Repository<WorkLocationRevenuePoints>, managerConfigRepository: Repository<WorkLocationManagerConfig>);
    createWorkLocation(dto: CreateWorkLocationDto): Promise<WorkLocation>;
    findAllWorkLocations(page?: number, limit?: number, companyId?: number, city?: string, search?: string): Promise<{
        locations: WorkLocation[];
        total: number;
        totalPages: number;
    }>;
    findWorkLocationById(id: number): Promise<WorkLocation>;
    findWorkLocationsByCompany(companyId: number): Promise<WorkLocation[]>;
    updateWorkLocation(id: number, dto: UpdateWorkLocationDto): Promise<WorkLocation>;
    removeWorkLocation(id: number): Promise<void>;
    createTaskTemplateAssignment(dto: CreateTaskTemplateAssignmentDto): Promise<WorkLocationTaskTemplate>;
    findAllTaskTemplateAssignments(page?: number, limit?: number, locationId?: number, templateId?: number, active?: boolean): Promise<{
        assignments: WorkLocationTaskTemplate[];
        total: number;
        totalPages: number;
    }>;
    findTaskTemplateAssignmentById(id: number): Promise<WorkLocationTaskTemplate>;
    findTaskTemplateAssignmentsByLocation(locationId: number): Promise<WorkLocationTaskTemplate[]>;
    findDepartmentsByLocation(locationId: number): Promise<WorkLocationDepartments[]>;
    createDepartment(dto: {
        work_location_id: number;
        name: string;
        code: string;
        description?: string | null;
    }): Promise<WorkLocationDepartments>;
    findPositionsByDepartment(departmentId: number): Promise<WorkLocationDepartmentPositions[]>;
    createDepartmentPosition(dto: {
        department_id: number;
        name: string;
        code: string;
        description?: string | null;
    }): Promise<WorkLocationDepartmentPositions>;
    updateTaskTemplateAssignment(id: number, dto: UpdateTaskTemplateAssignmentDto): Promise<WorkLocationTaskTemplate>;
    removeTaskTemplateAssignment(id: number): Promise<void>;
    deactivateTemplateAssignments(templateId: number): Promise<void>;
    toggleAssignmentStatus(id: number, active: boolean): Promise<WorkLocationTaskTemplate>;
    getLocationStatistics(): Promise<{
        total_locations: number;
        locations_by_company: {
            company_id: number;
            company_name: string;
            count: number;
        }[];
        total_assignments: number;
        active_assignments: number;
    }>;
    setRevenueIntervals(workLocationId: number, intervals: Array<{
        min: number;
        max?: number | null;
        points: number;
    }>): Promise<(DeepPartial<WorkLocationRevenuePoints> & WorkLocationRevenuePoints)[]>;
    getRevenueIntervals(workLocationId: number): Promise<WorkLocationRevenuePoints[]>;
    setManagerPercent(workLocationId: number, managerPercent: number, _fallbackRevenuePerPoint?: number): Promise<WorkLocationManagerConfig>;
    getManagerConfig(workLocationId: number): Promise<WorkLocationManagerConfig>;
    recordRevenue(workLocationId: number, revenueDate: string, revenueAmount: number): Promise<WorkLocationRevenue>;
    listRevenue(workLocationId: number, opts?: {
        startDate?: string;
        endDate?: string;
        page?: number;
        limit?: number;
    }): Promise<{
        revenues: WorkLocationRevenue[];
        total: number;
        totalPages: number;
    }>;
    getManagerPointsForDate(workLocationId: number, revenueDate: string): Promise<any>;
}
