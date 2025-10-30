import { InflexionType } from '../entities/presence-inflexion.entity';
export declare class CreatePresenceInflexionDto {
    presence_id: number;
    timestamp: string;
    type: InflexionType;
    gps_lat?: number;
    gps_lng?: number;
    location_description?: string;
    notes?: string;
}
