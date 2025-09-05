import { EmployeeService } from './employee.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { Employee } from './entities/employee.entity';
import { Response } from 'express';
import { CreateEmployeeFileDto } from './dto/create-employee-file.dto';
export declare class EmployeeHttpController {
    private readonly employeeService;
    constructor(employeeService: EmployeeService);
    create(createEmployeeDto: CreateEmployeeDto): Promise<Employee>;
    findAll(page?: string, limit?: string, is_active?: string, department?: string, contract_type?: string, work_location_id?: string): Promise<{
        employees: Employee[];
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
    getEmployeeFiles(employeeId: number): Promise<import("./entities/employee-files.entity").EmployeeFiles[]>;
    getFilesByQuery(employee_id?: string): Promise<import("./entities/employee-files.entity").EmployeeFiles[]>;
    findByEmail(email: string): Promise<Employee>;
    findByCNP(cnp: string): Promise<Employee>;
    findOne(id: string): Promise<Employee>;
    update(id: string, updateEmployeeDto: UpdateEmployeeDto): Promise<Employee>;
    toggleActive(id: string): Promise<Employee>;
    remove(id: string): Promise<{
        message: string;
    }>;
    getEmployeeFile(fileId: number, download: string, res: Response): Promise<any>;
    viewEmployeeFile(fileId: number, res: Response): Promise<any>;
    addEmployeeFile(employeeId: number, body: Omit<CreateEmployeeFileDto, 'employee_id'> & {
        employee_id?: number;
    }): Promise<import("./entities/employee-files.entity").EmployeeFiles>;
    addEmployeeDocumentWithContent(employeeId: number, body: {
        documents: Array<{
            fileName: string;
            name?: string;
            size?: number;
            content: string;
            type?: string;
            document_type?: string;
            note?: string;
        }>;
    }): Promise<import("./entities/employee-files.entity").EmployeeFiles | {
        message: string;
    }>;
}
