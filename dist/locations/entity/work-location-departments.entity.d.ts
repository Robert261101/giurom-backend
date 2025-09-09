import { WorkLocation } from './work-location.entity';
import { WorkLocationDepartmentPositions } from './work-location-department-positions.entity';
export declare class WorkLocationDepartments {
    id: number;
    name: string;
    code: string;
    description: string | null;
    work_location_id: number;
    created_at: Date;
    updated_at: Date;
    work_location: WorkLocation;
    positions: WorkLocationDepartmentPositions[];
}
