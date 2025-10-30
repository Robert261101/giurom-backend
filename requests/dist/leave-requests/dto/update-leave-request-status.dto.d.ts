import { LeaveStatus } from '../entities/leave-request.entity';
export declare class UpdateLeaveRequestStatusDto {
    status: LeaveStatus;
    reviewed_by_id: number;
    review_comment?: string;
}
