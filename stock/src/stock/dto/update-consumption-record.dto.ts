import { PartialType } from '@nestjs/mapped-types';
import { CreateConsumptionRecordDto } from './create-consumption-record.dto';

export class UpdateConsumptionRecordDto extends PartialType(CreateConsumptionRecordDto) {}