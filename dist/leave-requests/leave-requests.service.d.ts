import { OnModuleInit } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { Repository } from 'typeorm';
import { LeaveRequest } from './entities/leave-request.entity';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { UpdateLeaveRequestStatusDto } from './dto/update-leave-request-status.dto';
import { FilterLeaveRequestsDto } from './dto/filter-leave-requests.dto';
export declare class LeaveRequestsService implements OnModuleInit {
    private readonly leaveRequestRepo;
    private readonly httpService;
    private readonly logger;
    private notificationsClient;
    constructor(leaveRequestRepo: Repository<LeaveRequest>, httpService: HttpService);
    onModuleInit(): void;
    create(dto: CreateLeaveRequestDto, currentUserId?: number): Promise<LeaveRequest>;
    findAll(filters: FilterLeaveRequestsDto, currentUserId?: number): Promise<LeaveRequest[]>;
    findPending(currentUserId?: number): Promise<LeaveRequest[]>;
    findOne(id: number, currentUserId?: number): Promise<LeaveRequest>;
    updateStatus(id: number, dto: UpdateLeaveRequestStatusDto, currentUserId?: number): Promise<LeaveRequest>;
    remove(id: number, currentUserId?: number): Promise<void>;
    getEmployeeStats(employeeId: number, year?: number): Promise<any>;
    private isManager;
    findRequestsForApproval(managerId: number): Promise<LeaveRequest[]>;
}
