import { Presence } from './presence.entity';
export declare enum InflexionType {
    EXIT = "exit",
    ENTRY = "entry"
}
export declare class PresenceInflexion {
    id: number;
    presence_id: number;
    timestamp: Date;
    type: InflexionType;
    gps_lat: number;
    gps_lng: number;
    location_description: string;
    notes: string;
    presence: Presence;
}
