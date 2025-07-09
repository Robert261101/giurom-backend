import { PartialType } from '@nestjs/swagger';
import { CreateRecipeUsageDto } from './create-recipe-usage.dto';

export class UpdateRecipeUsageDto extends PartialType(CreateRecipeUsageDto) {} 