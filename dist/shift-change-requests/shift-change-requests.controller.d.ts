import { ShiftChangeRequestsService } from './shift-change-requests.service';
import { CreateShiftChangeRequestDto } from './dto/create-shift-change-request.dto';
import { UpdateShiftChangeStatusDto } from './dto/update-shift-change-status.dto';
import { FilterShiftChangeRequestsDto } from './dto/filter-shift-change-requests.dto';
import { ShiftChangeRequest } from './entities/shift-change-request.entity';
export declare class ShiftChangeRequestsController {
    private readonly shiftChangeRequestsService;
    constructor(shiftChangeRequestsService: ShiftChangeRequestsService);
    create(createShiftChangeRequestDto: CreateShiftChangeRequestDto, currentUserId?: string): Promise<ShiftChangeRequest>;
    findAll(filters: FilterShiftChangeRequestsDto, currentUserId?: string): Promise<ShiftChangeRequest[]>;
    findPending(currentUserId?: string): Promise<ShiftChangeRequest[]>;
    findOne(id: number, currentUserId?: string): Promise<ShiftChangeRequest>;
    updateStatus(id: number, updateStatusDto: UpdateShiftChangeStatusDto, currentUserId?: string): Promise<ShiftChangeRequest>;
    remove(id: number, currentUserId?: string): Promise<void>;
    getEmployeeStats(employeeId: number, year?: number): Promise<any>;
    findByEmployee(employeeId: number, currentUserId?: string): Promise<ShiftChangeRequest[]>;
}
