import { PartialType } from '@nestjs/swagger';
import { CreateRecipeIngredientDto } from './create-recipe-ingredient.dto';

export class UpdateRecipeIngredientDto extends PartialType(CreateRecipeIngredientDto) {} 