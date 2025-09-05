import { EmployeeService } from './employee.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
export declare class EmployeeMicroController {
    private readonly employeeService;
    constructor(employeeService: EmployeeService);
    create(createEmployeeDto: CreateEmployeeDto): Promise<import("./entities/employee.entity").Employee>;
    findAll(payload: {
        page: number;
        limit: number;
        is_active?: boolean;
        department?: number;
        contract_type?: string;
    }): Promise<{
        employees: import("./entities/employee.entity").Employee[];
        total: number;
        totalPages: number;
    }>;
    getStatistics(): Promise<{
        total: number;
        active: number;
        inactive: number;
        byContractType: {
            [key: string]: number;
        };
        byGender: {
            [key: string]: number;
        };
        hiredThisMonth: number;
    }>;
    findByEmail(email: string): Promise<import("./entities/employee.entity").Employee>;
    findByCNP(cnp: string): Promise<import("./entities/employee.entity").Employee>;
    findOne(id: number): Promise<import("./entities/employee.entity").Employee>;
    update(payload: {
        id: number;
        dto: UpdateEmployeeDto;
    }): Promise<import("./entities/employee.entity").Employee>;
    toggleActive(id: number): Promise<import("./entities/employee.entity").Employee>;
    remove(id: number): Promise<{
        message: string;
    }>;
    createFile(createFileDto: any): Promise<import("./entities/employee-files.entity").EmployeeFiles>;
    findOneFile(id: number): Promise<import("./entities/employee-files.entity").EmployeeFiles>;
    findFilesByEmployee(employee_id: number): Promise<import("./entities/employee-files.entity").EmployeeFiles[]>;
    serveFile(payload: {
        file_id: number;
        forceDownload: boolean;
    }): Promise<{
        data: string;
        mimeType: string;
        fileName: string;
        disposition: "inline" | "attachment";
    }>;
    removeFile(id: number): Promise<{
        message: string;
    }>;
    filesFindAll(payload: {
        page?: number;
        limit?: number;
        employee_id?: number;
        file_type?: string;
    }): any;
    filesStatistics(): any;
    filesFindByType(file_type: string): any;
    filesUpdate(payload: {
        id: number;
        dto: any;
    }): any;
    filesRemoveAllByEmployee(employee_id: number): any;
    filesValidateAccess(payload: {
        file_id: number;
        employee_id?: number;
    }): any;
    createDocument(dto: any): any;
    documentsFindAll(payload: {
        page: number;
        limit: number;
        employee_id?: number;
        status?: string;
        doc_id?: number;
    }): any;
    documentFindOne(id: number): any;
    documentsFindByEmployee(employee_id: number): any;
    documentsFindByStatus(status: string): any;
    documentsFindByDocId(doc_id: number): any;
    documentsFindExpired(): any;
    documentsUpdate(payload: {
        id: number;
        dto: any;
    }): any;
    documentsSign(id: number): any;
    documentsCancel(id: number): any;
    documentsRemove(id: number): any;
    documentsStatistics(): any;
    createWorkHistory(dto: any): any;
    workHistoryFindAll(payload: {
        page: number;
        limit: number;
        employee_id?: number;
        work_location_id?: number;
    }): any;
    workHistoryFindOne(id: number): any;
    workHistoryFindByEmployee(employee_id: number): any;
    workHistoryFindByWorkLocation(work_location_id: number): any;
    workHistoryUpdate(payload: {
        id: number;
        dto: any;
    }): any;
    workHistoryRemove(id: number): any;
    workHistoryStatistics(): any;
}
