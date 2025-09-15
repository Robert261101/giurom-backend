import { HttpService } from '@nestjs/axios';
import { Repository } from 'typeorm';
import { ShiftChangeRequest } from './entities/shift-change-request.entity';
import { CreateShiftChangeRequestDto } from './dto/create-shift-change-request.dto';
import { UpdateShiftChangeStatusDto } from './dto/update-shift-change-status.dto';
import { FilterShiftChangeRequestsDto } from './dto/filter-shift-change-requests.dto';
export declare class ShiftChangeRequestsService {
    private readonly shiftChangeRepo;
    private readonly httpService;
    private readonly logger;
    constructor(shiftChangeRepo: Repository<ShiftChangeRequest>, httpService: HttpService);
    create(dto: CreateShiftChangeRequestDto, currentUserId?: number): Promise<ShiftChangeRequest>;
    findAll(filters: FilterShiftChangeRequestsDto, currentUserId?: number): Promise<ShiftChangeRequest[]>;
    findPending(currentUserId?: number): Promise<ShiftChangeRequest[]>;
    findOne(id: number, currentUserId?: number): Promise<ShiftChangeRequest>;
    updateStatus(id: number, dto: UpdateShiftChangeStatusDto, currentUserId?: number): Promise<ShiftChangeRequest>;
    remove(id: number, currentUserId?: number): Promise<void>;
    getEmployeeStats(employeeId: number, year?: number): Promise<any>;
    private isManager;
    findRequestsForApproval(managerId: number): Promise<ShiftChangeRequest[]>;
    findByEmployee(employeeId: number, currentUserId?: number): Promise<ShiftChangeRequest[]>;
}
