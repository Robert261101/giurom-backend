import { PartialType } from '@nestjs/swagger';
import { CreateEmployeeFileDto } from './create-employee-file.dto';
 
export class UpdateEmployeeFileDto extends PartialType(CreateEmployeeFileDto) {}