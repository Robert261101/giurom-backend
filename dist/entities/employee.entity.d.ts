import { EmployeeWorkLocationHistory } from './employee-work-location-history.entity';
import { EmployeeFiles } from './employee-files.entity';
import { GeneratedDocuments } from './generated-documents.entity';
export declare class Employee {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    personal_number: string | null;
    birth_date: Date | null;
    gender: string | null;
    marital_status: string;
    nationality: string;
    address: string;
    hire_date: Date | null;
    termination_date: Date | null;
    position_default_id: number | null;
    department_default_id: number | null;
    work_location_default_id: number | null;
    contract_type: string | null;
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
    workLocationHistory: EmployeeWorkLocationHistory[];
    employeeFiles: EmployeeFiles[];
    generatedDocuments: GeneratedDocuments[];
}
