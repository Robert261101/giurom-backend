import { PartialType } from '@nestjs/swagger';
import { CreateWasteRecordDto } from './create-waste-record.dto';

export class UpdateWasteRecordDto extends PartialType(CreateWasteRecordDto) {}