import { WorkLocationTaskTemplate } from '../entity/work-location-task-template.entity';
import { WorkLocationDepartments } from '../entity/work-location-departments.entity';
export declare class WorkLocation {
    id: number;
    company_id: number;
    location_name: string;
    address: string;
    city: string;
    county: string;
    postal_code: string | null;
    country: string;
    phone_number: string | null;
    email: string | null;
    created_at: Date | null;
    employee_id: number | null;
    notes: string | null;
    gps_lat: number | null;
    gps_lng: number | null;
    gps_radius_m: number | null;
    task_templates: WorkLocationTaskTemplate[];
    departments: WorkLocationDepartments[];
}
