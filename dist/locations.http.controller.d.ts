import { CreateWorkLocationDepartmentsDto } from './locations/dto/create-work-location-departments.dto';
import { LocationsService } from './locations/locations.service';
import { CreateWorkLocationDto } from './locations/dto/create-work-location.dto';
import { UpdateWorkLocationDto } from './locations/dto/update-work-location.dto';
import { CreateTaskTemplateAssignmentDto } from './locations/dto/create-task-template-assignment.dto';
import { UpdateTaskTemplateAssignmentDto } from './locations/dto/update-task-template-assignment.dto';
export declare class LocationsHttpController {
    private readonly service;
    constructor(service: LocationsService);
    create(dto: CreateWorkLocationDto): Promise<import("./locations/entity/work-location.entity").WorkLocation>;
    findAll(page?: string, limit?: string, companyId?: string, city?: string, search?: string): Promise<{
        locations: import("./locations/entity/work-location.entity").WorkLocation[];
        total: number;
        totalPages: number;
    }>;
    stats(): Promise<{
        total_locations: number;
        locations_by_company: {
            company_id: number;
            company_name: string;
            count: number;
        }[];
        total_assignments: number;
        active_assignments: number;
    }>;
    findOne(id: string): Promise<import("./locations/entity/work-location.entity").WorkLocation>;
    findByCompany(companyId: string): Promise<import("./locations/entity/work-location.entity").WorkLocation[]>;
    update(id: string, dto: UpdateWorkLocationDto): Promise<import("./locations/entity/work-location.entity").WorkLocation>;
    remove(id: string): Promise<void>;
    createAssignment(dto: CreateTaskTemplateAssignmentDto): Promise<import("./locations/entity/work-location-task-template.entity").WorkLocationTaskTemplate>;
    findAllAssignments(page?: string, limit?: string, locationId?: string, templateId?: string, active?: string): Promise<{
        assignments: import("./locations/entity/work-location-task-template.entity").WorkLocationTaskTemplate[];
        total: number;
        totalPages: number;
    }>;
    findAssignment(id: string): Promise<import("./locations/entity/work-location-task-template.entity").WorkLocationTaskTemplate>;
    findAssignmentsByLocation(locationId: string): Promise<import("./locations/entity/work-location-task-template.entity").WorkLocationTaskTemplate[]>;
    findDepartmentsByLocation(locationId: string): Promise<import("./locations/entity/work-location-departments.entity").WorkLocationDepartments[]>;
    createDepartment(locationId: string, body: Omit<CreateWorkLocationDepartmentsDto, 'work_location_id'> & {
        work_location_id?: number;
    }): Promise<import("./locations/entity/work-location-departments.entity").WorkLocationDepartments>;
    findPositions(departmentId: string): Promise<import("./locations/entity/work-location-department-positions.entity").WorkLocationDepartmentPositions[]>;
    createPosition(departmentId: string, body: {
        name: string;
        code: string;
        description?: string;
    }): Promise<import("./locations/entity/work-location-department-positions.entity").WorkLocationDepartmentPositions>;
    updateAssignment(id: string, dto: UpdateTaskTemplateAssignmentDto): Promise<import("./locations/entity/work-location-task-template.entity").WorkLocationTaskTemplate>;
    toggleAssignment(id: string, active?: string): Promise<import("./locations/entity/work-location-task-template.entity").WorkLocationTaskTemplate>;
    deactivateTemplate(templateId: string): Promise<void>;
    removeAssignment(id: string): Promise<void>;
    setIntervals(id: string, body: {
        intervals: Array<{
            min: number;
            max?: number | null;
            points: number;
        }>;
    }): Promise<(import("typeorm").DeepPartial<import("./locations/entity/work-location-revenue-points.entity").WorkLocationRevenuePoints> & import("./locations/entity/work-location-revenue-points.entity").WorkLocationRevenuePoints)[]>;
    getIntervals(id: string): Promise<import("./locations/entity/work-location-revenue-points.entity").WorkLocationRevenuePoints[]>;
    setManagerPercent(id: string, body: {
        manager_percent: number;
        fallback_revenue_per_point?: number;
    }): Promise<import("./locations/entity/work-location-manager-config.entity").WorkLocationManagerConfig>;
    getManagerConfig(id: string): Promise<import("./locations/entity/work-location-manager-config.entity").WorkLocationManagerConfig>;
    recordRevenue(id: string, body: {
        revenue_date: string;
        revenue_amount: number;
    }): Promise<import("./locations/entity/work-location-revenue.entity").WorkLocationRevenue>;
    listRevenue(id: string, startDate?: string, endDate?: string, page?: string, limit?: string): Promise<{
        revenues: import("./locations/entity/work-location-revenue.entity").WorkLocationRevenue[];
        total: number;
        totalPages: number;
    }>;
    managerPoints(id: string, date: string): Promise<any>;
}
