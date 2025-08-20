import { PartialType } from '@nestjs/swagger';
import { CreateRecipePreparationDto } from './create-recipe-preparation.dto';

export class UpdateRecipePreparationDto extends PartialType(CreateRecipePreparationDto) {}


