import { DeepPartial, Repository, DataSource } from "typeorm";
import { ClientProxy } from "@nestjs/microservices";
import { WorkLocation } from "../locations/entity/work-location.entity";
import { WorkLocationTaskTemplate } from "../locations/entity/work-location-task-template.entity";
import { WorkLocationDepartments } from "../locations/entity/work-location-departments.entity";
import { WorkLocationDepartmentPositions } from "../locations/entity/work-location-department-positions.entity";
import { CreateWorkLocationDto } from "./dto/create-work-location.dto";
import { UpdateWorkLocationDto } from "./dto/update-work-location.dto";
import { CreateTaskTemplateAssignmentDto } from "./dto/create-task-template-assignment.dto";
import { UpdateTaskTemplateAssignmentDto } from "./dto/update-task-template-assignment.dto";
import { WorkLocationRevenue, RevenueStatus } from "./entity/work-location-revenue.entity";
import { WorkLocationRevenuePoints } from "./entity/work-location-revenue-points.entity";
import { WorkLocationManagerConfig } from "./entity/work-location-manager-config.entity";
import { WorkLocationFiles } from "./entity/work-location-files.entity";
import { WorkLocationFolder } from "./entity/work-location-folder.entity";
import { CreateWorkLocationFileDto } from "./dto/create-work-location-file.dto";
export declare class LocationsService {
    private readonly workLocationRepository;
    private readonly taskTemplateRepository;
    private readonly departmentsRepository;
    private readonly positionsRepository;
    private readonly revenueRepository;
    private readonly revenuePointsRepository;
    private readonly managerConfigRepository;
    private readonly filesRepository;
    private readonly folderRepository;
    private readonly notificationsClient;
    private readonly dataSource;
    constructor(workLocationRepository: Repository<WorkLocation>, taskTemplateRepository: Repository<WorkLocationTaskTemplate>, departmentsRepository: Repository<WorkLocationDepartments>, positionsRepository: Repository<WorkLocationDepartmentPositions>, revenueRepository: Repository<WorkLocationRevenue>, revenuePointsRepository: Repository<WorkLocationRevenuePoints>, managerConfigRepository: Repository<WorkLocationManagerConfig>, filesRepository: Repository<WorkLocationFiles>, folderRepository: Repository<WorkLocationFolder>, notificationsClient: ClientProxy, dataSource: DataSource);
    private getEmployeeLocationIdsForAccess;
    findWorkLocationsByIds(ids: number[], user?: any): Promise<WorkLocation[]>;
    private getLocationsFilesRootDir;
    private getRepoRoot;
    private getFilesCompaniesRoot;
    private getCompanyNameForLocation;
    private getLocationBasePath;
    private createLocationFolderStructure;
    private sendLocationNotification;
    createWorkLocation(dto: CreateWorkLocationDto): Promise<WorkLocation>;
    findAllWorkLocations(page?: number, limit?: number, companyId?: number, city?: string, search?: string, user?: any): Promise<{
        locations: WorkLocation[];
        total: number;
        totalPages: number;
    }>;
    getEmployeeCompanies(user?: any): Promise<Array<{
        id: number;
        company_name: string;
    }>>;
    findWorkLocationById(id: number, user?: any): Promise<WorkLocation & {
        company_name?: string;
    }>;
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
    recordRevenue(workLocationId: number, revenueDate: string, onlineAmount: number, cashAmount: number, cardAmount: number, totalAmount: number, status?: RevenueStatus, imageUrl?: string, userId?: number | null): Promise<WorkLocationRevenue>;
    listRevenue(workLocationId: number, opts?: {
        startDate?: string;
        endDate?: string;
        page?: number;
        limit?: number;
    }): Promise<{
        revenues: any[];
        total: number;
        totalPages: number;
    }>;
    deleteRevenue(revenueId: number): Promise<void>;
    updateRevenue(revenueId: number, data: {
        revenue_date?: string;
        online_amount?: number;
        cash_amount?: number;
        card_amount?: number;
        total_amount?: number;
        status?: RevenueStatus;
        image_url?: string;
    }): Promise<WorkLocationRevenue>;
    private calculateEmployeeBonusesForDate;
    getManagerPointsForDate(workLocationId: number, revenueDate: string): Promise<any>;
    createFile(createFileDto: CreateWorkLocationFileDto & {
        expire_date?: string;
        notes?: string;
    }): Promise<WorkLocationFiles>;
    findOneFile(id: number): Promise<WorkLocationFiles>;
    findFilesByLocation(work_location_id: number): Promise<WorkLocationFiles[]>;
    findFoldersByLocation(work_location_id: number): Promise<WorkLocationFolder[]>;
    createFolder(locationId: number, body: {
        description: string;
        parent_id?: number | null;
    }): Promise<WorkLocationFolder>;
    updateFolder(locationId: number, folderId: number, body: {
        description: string;
    }): Promise<WorkLocationFolder>;
    removeFolder(locationId: number, folderId: number): Promise<void>;
    serveFile(file_id: number, forceDownload?: boolean): Promise<{
        data: string;
        mimeType: string;
        fileName: string;
        disposition: "inline" | "attachment";
    }>;
    private getMimeType;
    removeFile(id: number): Promise<{
        message: string;
    }>;
    findExpiringFiles(targetDate: string): Promise<WorkLocationFiles[]>;
    findExpiredFiles(): Promise<WorkLocationFiles[]>;
    uploadCashingImage(fileName: string, base64Content: string): Promise<string>;
    serveCashingImage(fileName: string): Promise<{
        buffer: Buffer;
        mimeType: string;
    }>;
    deleteCashingImage(imageUrl: string): Promise<void>;
}
