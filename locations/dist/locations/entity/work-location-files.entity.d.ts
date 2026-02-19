import { WorkLocation } from './work-location.entity';
import { WorkLocationFolder } from './work-location-folder.entity';
export declare class WorkLocationFiles {
    id: number;
    work_location_id: number;
    folder_id: number | null;
    file_name: string;
    file_type: string;
    file_link: string;
    expire_date: Date | null;
    notes: string | null;
    updated_at: Date;
    workLocation: WorkLocation;
    folder: WorkLocationFolder | null;
}
