import { PartialType } from '@nestjs/swagger';
import { CreateWorkLocationDepartmentPositionsDto } from './create-work-location-department-positions.dto';

export class UpdateWorkLocationDepartmentPositionsDto extends PartialType(CreateWorkLocationDepartmentPositionsDto) {} 