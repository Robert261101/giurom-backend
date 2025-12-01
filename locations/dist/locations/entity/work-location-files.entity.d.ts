import { WorkLocation } from './work-location.entity';
export declare class WorkLocationFiles {
    id: number;
    work_location_id: number;
    file_name: string;
    file_type: string;
    file_link: string;
    updated_at: Date;
    workLocation: WorkLocation;
}
