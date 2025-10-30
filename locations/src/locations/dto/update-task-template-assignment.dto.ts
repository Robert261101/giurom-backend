import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateTaskTemplateAssignmentDto } from './create-task-template-assignment.dto';

export class UpdateTaskTemplateAssignmentDto extends PartialType(
  OmitType(CreateTaskTemplateAssignmentDto, ['location_id'] as const),
) {} 