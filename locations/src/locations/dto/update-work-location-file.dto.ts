import { PartialType } from '@nestjs/mapped-types';
import { CreateWorkLocationFileDto } from './create-work-location-file.dto';

export class UpdateWorkLocationFileDto extends PartialType(CreateWorkLocationFileDto) {}
