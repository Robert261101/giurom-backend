import { PartialType } from '@nestjs/swagger';
import { CreateRecipeProductDto } from './create-recipe-product.dto';

export class UpdateRecipeProductDto extends PartialType(CreateRecipeProductDto) {}


