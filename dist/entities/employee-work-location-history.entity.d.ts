import { Employee } from './employee.entity';
export declare class EmployeeWorkLocationHistory {
    id: number;
    employee_id: number;
    work_location_id: number;
    description: string;
    created_at: Date;
    updated_at: Date;
    employee: Employee;
}
