import { PresenceStatus } from '../entities/presence.entity';
export declare class CreatePresenceDto {
    shift_id: number;
    date: string;
    status: PresenceStatus;
    check_in?: string;
    check_out?: string;
    total_hours?: number;
    gps_exit_flag?: boolean;
    notes?: string;
}
