import { PartialType } from '@nestjs/swagger';
import { CreateWorkLocationHistoryDto } from './create-work-location-history.dto';
 
export class UpdateWorkLocationHistoryDto extends PartialType(CreateWorkLocationHistoryDto) {} 