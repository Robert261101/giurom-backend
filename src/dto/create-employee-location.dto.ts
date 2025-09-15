import { IsNumber, IsNotEmpty } from 'class-validator';

export class CreateEmployeeLocationDto {
  @IsNumber()
  @IsNotEmpty()
  employee_id: number;

  @IsNumber()
  @IsNotEmpty()
  id_location: number;
}