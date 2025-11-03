import { Shift } from './shift.entity';
import { PresenceInflexion } from './presence-inflexion.entity';
export declare enum PresenceStatus {
    PRESENT_FULL = "present_full",
    PRESENT_PARTIAL = "present_partial",
    ABSENT = "absent"
}
export declare class Presence {
    id: number;
    shift_id: number;
    date: Date;
    status: PresenceStatus;
    check_in: Date;
    check_out: Date;
    total_hours: number;
    gps_exit_flag: boolean;
    notes: string;
    created_at: Date;
    updated_at: Date;
    shift: Shift;
    inflexions: PresenceInflexion[];
}
