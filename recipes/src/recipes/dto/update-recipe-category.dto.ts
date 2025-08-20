import { PartialType } from '@nestjs/swagger';
import { CreateRecipeCategoryDto } from './create-recipe-category.dto';

export class UpdateRecipeCategoryDto extends PartialType(CreateRecipeCategoryDto) {}


