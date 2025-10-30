import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateWorkLocationDto } from './create-work-location.dto';

export class UpdateWorkLocationDto extends PartialType(
  OmitType(CreateWorkLocationDto, ['company_id'] as const),
) {} 