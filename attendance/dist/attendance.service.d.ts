import { OnModuleInit } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Repository } from 'typeorm';
import { Shift } from './entities/shift.entity';
import { Presence, PresenceStatus } from './entities/presence.entity';
import { PresenceInflexion, InflexionType } from './entities/presence-inflexion.entity';
import { CreateShiftDto } from './dto/create-shift.dto';
import { UpdateShiftDto } from './dto/update-shift.dto';
import { CreatePresenceDto } from './dto/create-presence.dto';
import { UpdatePresenceDto } from './dto/update-presence.dto';
import { CreatePresenceInflexionDto } from './dto/create-presence-inflexion.dto';
import { UpdatePresenceInflexionDto } from './dto/update-presence-inflexion.dto';
export declare class AttendanceService implements OnModuleInit {
    private readonly shiftRepository;
    private readonly presenceRepository;
    private readonly presenceInflexionRepository;
    private readonly notificationsClient;
    constructor(shiftRepository: Repository<Shift>, presenceRepository: Repository<Presence>, presenceInflexionRepository: Repository<PresenceInflexion>, notificationsClient: ClientProxy);
    onModuleInit(): Promise<void>;
    private sendAttendanceNotification;
    private sendShiftNotification;
    createShift(createShiftDto: CreateShiftDto): Promise<Shift>;
    findAllShifts(page?: number, limit?: number, employee_id?: number, work_location_id?: number, department_id?: number): Promise<{
        data: Shift[];
        total: number;
        page: number;
        limit: number;
    }>;
    findShiftById(id: number): Promise<Shift>;
    updateShift(id: number, updateShiftDto: UpdateShiftDto): Promise<Shift>;
    deleteShift(id: number): Promise<void>;
    createPresence(createPresenceDto: CreatePresenceDto): Promise<Presence>;
    findAllPresences(page?: number, limit?: number, shift_id?: number, status?: PresenceStatus, start_date?: string, end_date?: string): Promise<{
        data: Presence[];
        total: number;
        page: number;
        limit: number;
    }>;
    findPresenceById(id: number): Promise<Presence>;
    updatePresence(id: number, updatePresenceDto: UpdatePresenceDto): Promise<Presence>;
    deletePresence(id: number): Promise<void>;
    createPresenceInflexion(createInflexionDto: CreatePresenceInflexionDto): Promise<PresenceInflexion>;
    findAllPresenceInflexions(page?: number, limit?: number, presence_id?: number, type?: InflexionType): Promise<{
        data: PresenceInflexion[];
        total: number;
        page: number;
        limit: number;
    }>;
    findPresenceInflexionById(id: number): Promise<PresenceInflexion>;
    updatePresenceInflexion(id: number, updateInflexionDto: UpdatePresenceInflexionDto): Promise<PresenceInflexion>;
    deletePresenceInflexion(id: number): Promise<void>;
    getAttendanceStatistics(employee_id?: number, start_date?: string, end_date?: string): Promise<any>;
}
