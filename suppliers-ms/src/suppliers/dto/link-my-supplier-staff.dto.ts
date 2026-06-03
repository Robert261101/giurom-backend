import { IsIn, IsInt, IsPositive } from 'class-validator';

export class LinkMySupplierStaffDto {
  @IsInt()
  @IsPositive()
  employee_id: number;

  @IsIn(['magazioner', 'sofer'])
  staff_type: 'magazioner' | 'sofer';
}
