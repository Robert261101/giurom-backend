import { PartialType } from '@nestjs/swagger';
import { CreateWorkLocationDepartmentsDto } from './create-work-location-departments.dto';

export class UpdateWorkLocationDepartmentsDto extends PartialType(CreateWorkLocationDepartmentsDto) {} 