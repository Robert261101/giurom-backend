import { WorkLocation } from '../entity/work-location.entity';
export declare class WorkLocationTaskTemplate {
    id: number;
    location_id: number;
    template_id: number;
    assigned_at: Date | null;
    active: boolean;
    notes: string | null;
    work_location: WorkLocation;
}
