import { AttendanceService } from './attendance.service';
import { CreateShiftDto } from './dto/create-shift.dto';
import { UpdateShiftDto } from './dto/update-shift.dto';
import { CreatePresenceDto } from './dto/create-presence.dto';
import { UpdatePresenceDto } from './dto/update-presence.dto';
import { CreatePresenceInflexionDto } from './dto/create-presence-inflexion.dto';
import { UpdatePresenceInflexionDto } from './dto/update-presence-inflexion.dto';
export declare class AttendanceMicroController {
    private readonly service;
    constructor(service: AttendanceService);
    createShift(dto: CreateShiftDto): Promise<import("./entities/shift.entity").Shift>;
    findAllShifts(payload: {
        page?: number;
        limit?: number;
        employee_id?: number;
        work_location_id?: number;
        department_id?: number;
    }): Promise<{
        data: import("./entities/shift.entity").Shift[];
        total: number;
        page: number;
        limit: number;
    }>;
    findShift(id: number): Promise<import("./entities/shift.entity").Shift>;
    updateShift(payload: {
        id: number;
        dto: UpdateShiftDto;
    }): Promise<import("./entities/shift.entity").Shift>;
    deleteShift(id: number): Promise<void>;
    createPresence(dto: CreatePresenceDto): Promise<import("./entities/presence.entity").Presence>;
    findAllPresences(payload: {
        page?: number;
        limit?: number;
        shift_id?: number;
        status?: string;
        start_date?: string;
        end_date?: string;
    }): Promise<{
        data: import("./entities/presence.entity").Presence[];
        total: number;
        page: number;
        limit: number;
    }>;
    findPresence(id: number): Promise<import("./entities/presence.entity").Presence>;
    updatePresence(payload: {
        id: number;
        dto: UpdatePresenceDto;
    }): Promise<import("./entities/presence.entity").Presence>;
    deletePresence(id: number): Promise<void>;
    createInflexion(dto: CreatePresenceInflexionDto): Promise<import("./entities/presence-inflexion.entity").PresenceInflexion>;
    findAllInflexions(payload: {
        page?: number;
        limit?: number;
        presence_id?: number;
        type?: string;
    }): Promise<{
        data: import("./entities/presence-inflexion.entity").PresenceInflexion[];
        total: number;
        page: number;
        limit: number;
    }>;
    findInflexion(id: number): Promise<import("./entities/presence-inflexion.entity").PresenceInflexion>;
    updateInflexion(payload: {
        id: number;
        dto: UpdatePresenceInflexionDto;
    }): Promise<import("./entities/presence-inflexion.entity").PresenceInflexion>;
    deleteInflexion(id: number): Promise<void>;
    statistics(payload: {
        employee_id?: number;
        start_date?: string;
        end_date?: string;
    }): Promise<any>;
}
