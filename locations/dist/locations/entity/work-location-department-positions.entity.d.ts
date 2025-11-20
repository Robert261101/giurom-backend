import { WorkLocationDepartments } from './work-location-departments.entity';
export declare class WorkLocationDepartmentPositions {
    id: number;
    name: string;
    code: string;
    description: string | null;
    department_id: number;
    created_at: Date;
    updated_at: Date;
    department: WorkLocationDepartments;
}
