import { PartialType, OmitType, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { CreateCalendarEventDto } from './create-calendar-event.dto';

export class UpdateCalendarEventDto extends PartialType(
  OmitType(CreateCalendarEventDto, ['participant_employee_ids'] as const),
) {
  @ApiPropertyOptional({ enum: ['active', 'cancelled'] })
  @IsOptional()
  @IsIn(['active', 'cancelled'])
  status?: 'active' | 'cancelled';
}
