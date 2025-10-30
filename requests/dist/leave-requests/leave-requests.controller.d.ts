import { LeaveRequestsService } from './leave-requests.service';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { UpdateLeaveRequestStatusDto } from './dto/update-leave-request-status.dto';
import { FilterLeaveRequestsDto } from './dto/filter-leave-requests.dto';
import { LeaveRequest } from './entities/leave-request.entity';
export declare class LeaveRequestsController {
    private readonly leaveRequestsService;
    constructor(leaveRequestsService: LeaveRequestsService);
    create(createLeaveRequestDto: CreateLeaveRequestDto, currentUserId?: string): Promise<LeaveRequest>;
    findAll(filters: FilterLeaveRequestsDto, currentUserId?: string): Promise<LeaveRequest[]>;
    findPending(currentUserId?: string): Promise<LeaveRequest[]>;
    findOne(id: number, currentUserId?: string): Promise<LeaveRequest>;
    updateStatus(id: number, updateStatusDto: UpdateLeaveRequestStatusDto, currentUserId?: string): Promise<LeaveRequest>;
    remove(id: number, currentUserId?: string): Promise<void>;
    getEmployeeStats(employeeId: number, year?: number): Promise<any>;
}
