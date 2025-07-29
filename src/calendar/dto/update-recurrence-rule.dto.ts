import { PartialType } from '@nestjs/swagger';
import { CreateRecurrenceRuleDto } from './create-recurrence-rule.dto';

export class UpdateRecurrenceRuleDto extends PartialType(CreateRecurrenceRuleDto) {}