import { Repository } from 'typeorm';
import { Employee } from './entities/employee.entity';
import { EmployeeFiles } from './entities/employee-files.entity';
import { GeneratedDocuments } from './entities/generated-documents.entity';
import { EmployeeWorkLocationHistory } from './entities/employee-work-location-history.entity';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { CreateEmployeeFileDto } from './dto/create-employee-file.dto';
import { UpdateEmployeeFileDto } from './dto/update-employee-file.dto';
export declare class EmployeeService {
    private employeeRepository;
    private filesRepository;
    private documentsRepository;
    private workLocationHistoryRepository;
    constructor(employeeRepository: Repository<Employee>, filesRepository: Repository<EmployeeFiles>, documentsRepository: Repository<GeneratedDocuments>, workLocationHistoryRepository: Repository<EmployeeWorkLocationHistory>);
    private getEmployeesFilesRootDir;
    create(createEmployeeDto: CreateEmployeeDto): Promise<Employee>;
    findAll(page?: number, limit?: number, is_active?: boolean, department?: number, contract_type?: string, work_location_id?: number): Promise<{
        employees: Employee[];
        total: number;
        totalPages: number;
    }>;
    findOne(id: number): Promise<Employee>;
    findByEmail(email: string): Promise<Employee>;
    findByCNP(cnp: string): Promise<Employee>;
    update(id: number, updateEmployeeDto: UpdateEmployeeDto): Promise<Employee>;
    remove(id: number): Promise<{
        message: string;
    }>;
    toggleActive(id: number): Promise<Employee>;
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
    createFile(createFileDto: CreateEmployeeFileDto): Promise<EmployeeFiles>;
    findOneFile(id: number): Promise<EmployeeFiles>;
    findFilesByEmployee(employee_id: number): Promise<EmployeeFiles[]>;
    serveFile(file_id: number, forceDownload?: boolean): Promise<{
        data: string;
        mimeType: string;
        fileName: string;
        disposition: 'inline' | 'attachment';
    }>;
    private getMimeType;
    removeFile(id: number): Promise<{
        message: string;
    }>;
    createDocument(createDocumentDto: any): Promise<GeneratedDocuments>;
    documentsFindAll(params: {
        page?: number;
        limit?: number;
        employee_id?: number;
        status?: string;
        doc_id?: number;
    }): Promise<{
        documents: GeneratedDocuments[];
        total: number;
        totalPages: number;
    }>;
    documentFindOne(id: number): Promise<GeneratedDocuments>;
    documentsFindByEmployee(employee_id: number): Promise<GeneratedDocuments[]>;
    documentsFindByStatus(status: string): Promise<GeneratedDocuments[]>;
    documentsFindByDocId(doc_id: number): Promise<GeneratedDocuments[]>;
    documentsFindExpired(): Promise<GeneratedDocuments[]>;
    documentsUpdate(id: number, updateDocumentDto: any): Promise<GeneratedDocuments>;
    documentsSign(id: number): Promise<GeneratedDocuments>;
    documentsCancel(id: number): Promise<GeneratedDocuments>;
    documentsRemove(id: number): Promise<{
        message: string;
    }>;
    documentsStatistics(): Promise<{
        total: number;
        byStatus: {
            [key: string]: number;
        };
        byEmployee: {
            [key: string]: number;
        };
        expiringSoon: number;
        recentlySigned: number;
        byDocType: {
            [key: string]: number;
        };
    }>;
    createWorkHistory(createHistoryDto: any): Promise<EmployeeWorkLocationHistory>;
    workHistoryFindAll(params: {
        page?: number;
        limit?: number;
        employee_id?: number;
        work_location_id?: number;
    }): Promise<{
        history: EmployeeWorkLocationHistory[];
        total: number;
        totalPages: number;
    }>;
    workHistoryFindOne(id: number): Promise<EmployeeWorkLocationHistory>;
    workHistoryFindByEmployee(employee_id: number): Promise<EmployeeWorkLocationHistory[]>;
    workHistoryFindByWorkLocation(work_location_id: number): Promise<EmployeeWorkLocationHistory[]>;
    workHistoryUpdate(id: number, updateHistoryDto: any): Promise<EmployeeWorkLocationHistory>;
    workHistoryRemove(id: number): Promise<{
        message: string;
    }>;
    workHistoryStatistics(): Promise<{
        total: number;
        byEmployee: {
            [key: string]: number;
        };
        byWorkLocation: {
            [key: string]: number;
        };
        recentChanges: number;
    }>;
    findAllFiles(page?: number, limit?: number, employee_id?: number, file_type?: string): Promise<{
        files: EmployeeFiles[];
        total: number;
        totalPages: number;
    }>;
    filesStatistics(): Promise<{
        total: number;
        byFileType: {
            [key: string]: number;
        };
        byEmployee: {
            [key: string]: number;
        };
        recentUploads: number;
        averageFilesPerEmployee: number;
    }>;
    findFilesByType(file_type: string): Promise<EmployeeFiles[]>;
    updateFile(id: number, updateFileDto: UpdateEmployeeFileDto): Promise<EmployeeFiles>;
    removeAllFilesByEmployee(employee_id: number): Promise<{
        message: string;
        deletedCount: number;
    }>;
    validateFileAccess(file_id: number, employee_id?: number): Promise<boolean>;
}
