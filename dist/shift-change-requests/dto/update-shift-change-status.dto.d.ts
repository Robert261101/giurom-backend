import { ShiftChangeStatus } from '../entities/shift-change-request.entity';
export declare class UpdateShiftChangeStatusDto {
    status: ShiftChangeStatus;
    reviewed_by_id: number;
    review_comment?: string;
}
