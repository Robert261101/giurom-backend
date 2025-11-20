import { Response } from 'express';
import { CreateWorkLocationDepartmentsDto } from './locations/dto/create-work-location-departments.dto';
import { LocationsService } from './locations/locations.service';
import { CreateWorkLocationDto } from './locations/dto/create-work-location.dto';
import { UpdateWorkLocationDto } from './locations/dto/update-work-location.dto';
import { CreateTaskTemplateAssignmentDto } from './locations/dto/create-task-template-assignment.dto';
import { UpdateTaskTemplateAssignmentDto } from './locations/dto/update-task-template-assignment.dto';
import { CreateWorkLocationFileDto } from './locations/dto/create-work-location-file.dto';
import { RevenueStatus } from './locations/entity/work-location-revenue.entity';
export declare class LocationsHttpController {
    private readonly service;
    constructor(service: LocationsService);
    create(dto: CreateWorkLocationDto): Promise<import("./locations/entity/work-location.entity").WorkLocation>;
    findAll(page?: string, limit?: string, companyId?: string, city?: string, search?: string, req?: any): Promise<{
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
    findMyCompanies(req?: any): Promise<{
        id: number;
        company_name: string;
    }[]>;
    findOne(id: string, req?: any): Promise<import("./locations/entity/work-location.entity").WorkLocation>;
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
        online_amount: number;
        cash_amount: number;
        card_amount: number;
        total_amount: number;
        status?: RevenueStatus;
        image_url?: string;
    }, req?: any): Promise<import("./locations/entity/work-location-revenue.entity").WorkLocationRevenue>;
    listRevenue(id: string, startDate?: string, endDate?: string, page?: string, limit?: string): Promise<{
        revenues: any[];
        total: number;
        totalPages: number;
    }>;
    managerPoints(id: string, date: string): Promise<any>;
    deleteRevenue(revenueId: string): Promise<void>;
    updateRevenue(revenueId: string, body: {
        revenue_date?: string;
        online_amount?: number;
        cash_amount?: number;
        card_amount?: number;
        total_amount?: number;
        status?: RevenueStatus;
        image_url?: string;
    }): Promise<import("./locations/entity/work-location-revenue.entity").WorkLocationRevenue>;
    getLocationFiles(locationId: number): Promise<import("./locations/entity/work-location-files.entity").WorkLocationFiles[]>;
    getLocationFile(fileId: number, download: string, res: Response): Promise<any>;
    viewLocationFile(fileId: number, res: Response): Promise<any>;
    addLocationFile(locationId: number, body: Omit<CreateWorkLocationFileDto, 'work_location_id'> & {
        work_location_id?: number;
    }): Promise<import("./locations/entity/work-location-files.entity").WorkLocationFiles>;
    addLocationDocumentWithContent(locationId: number, body: {
        documents: Array<{
            fileName: string;
            name?: string;
            size?: number;
            content: string;
            type?: string;
            document_type?: string;
            note?: string;
        }>;
    }): Promise<import("./locations/entity/work-location-files.entity").WorkLocationFiles | {
        message: string;
    }>;
    deleteLocationFile(fileId: number): Promise<{
        message: string;
    }>;
}
