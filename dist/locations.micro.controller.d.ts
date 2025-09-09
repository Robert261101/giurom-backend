import { LocationsService } from './locations/locations.service';
import { CreateWorkLocationDto } from './locations/dto/create-work-location.dto';
import { UpdateWorkLocationDto } from './locations/dto/update-work-location.dto';
import { CreateTaskTemplateAssignmentDto } from './locations/dto/create-task-template-assignment.dto';
import { UpdateTaskTemplateAssignmentDto } from './locations/dto/update-task-template-assignment.dto';
export declare class LocationsMicroController {
    private readonly locationsService;
    constructor(locationsService: LocationsService);
    create(dto: CreateWorkLocationDto): Promise<import("./locations/entity/work-location.entity").WorkLocation>;
    findAll(payload: {
        page: number;
        limit: number;
        companyId?: number;
        city?: string;
        search?: string;
    }): Promise<{
        locations: import("./locations/entity/work-location.entity").WorkLocation[];
        total: number;
        totalPages: number;
    }>;
    statistics(): Promise<{
        total_locations: number;
        locations_by_company: {
            company_id: number;
            company_name: string;
            count: number;
        }[];
        total_assignments: number;
        active_assignments: number;
    }>;
    findByCompany(companyId: number): Promise<import("./locations/entity/work-location.entity").WorkLocation[]>;
    findById(id: number): Promise<import("./locations/entity/work-location.entity").WorkLocation>;
    update(payload: {
        id: number;
        dto: UpdateWorkLocationDto;
    }): Promise<import("./locations/entity/work-location.entity").WorkLocation>;
    remove(id: number): Promise<void>;
    createAssignment(dto: CreateTaskTemplateAssignmentDto): Promise<import("./locations/entity/work-location-task-template.entity").WorkLocationTaskTemplate>;
    findAllAssignments(payload: {
        page: number;
        limit: number;
        locationId?: number;
        templateId?: number;
        active?: boolean;
    }): Promise<{
        assignments: import("./locations/entity/work-location-task-template.entity").WorkLocationTaskTemplate[];
        total: number;
        totalPages: number;
    }>;
    findAssignmentsByLocation(locationId: number): Promise<import("./locations/entity/work-location-task-template.entity").WorkLocationTaskTemplate[]>;
    findAssignmentById(assignmentId: number): Promise<import("./locations/entity/work-location-task-template.entity").WorkLocationTaskTemplate>;
    updateAssignment(payload: {
        assignmentId: number;
        dto: UpdateTaskTemplateAssignmentDto;
    }): Promise<import("./locations/entity/work-location-task-template.entity").WorkLocationTaskTemplate>;
    toggleAssignment(payload: {
        assignmentId: number;
        active: boolean;
    }): Promise<import("./locations/entity/work-location-task-template.entity").WorkLocationTaskTemplate>;
    removeAssignment(assignmentId: number): Promise<void>;
    deactivateTemplateAssignments(templateId: number): Promise<void>;
}
