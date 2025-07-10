import { PartialType } from '@nestjs/swagger';
import { CreateLocatorDto } from './create-locator.dto';

export class UpdateLocatorDto extends PartialType(CreateLocatorDto) {} 